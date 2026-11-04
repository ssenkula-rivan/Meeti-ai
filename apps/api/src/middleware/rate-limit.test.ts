import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { rateLimit, configureRateLimitStore } from './rate-limit';
import { MemoryRateLimitStore } from '../lib/rate-limit-store';
import { config } from '../config';

/**
 * Minimal stand-ins for the Express req/res so we can exercise the limiter as a
 * pure unit — no HTTP server, no extra dependencies. The middleware is now async
 * (the counting backend may be Redis), so every call is awaited.
 */
function makeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: null as unknown,
    setHeader(key: string, value: string) {
      headers[key] = String(value);
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return { res, headers };
}

function makeReq(ip: string, opts: { forwarded?: string; token?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.forwarded) headers['x-forwarded-for'] = opts.forwarded;
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  return { ip, headers, socket: {} } as any;
}

describe('rateLimit middleware', () => {
  beforeEach(() => {
    // Isolate from any boot-configured shared store; also fake the clock so the
    // fixed-window reset is deterministic.
    configureRateLimitStore(null);
    vi.useFakeTimers({ now: Date.now() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets requests under the limit through and reports the remaining budget', async () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3 });
    const next = vi.fn();
    const { res, headers } = makeRes();

    await mw(makeReq('10.0.0.1'), res, next);
    await mw(makeReq('10.0.0.1'), res, next);
    await mw(makeReq('10.0.0.1'), res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(headers['X-RateLimit-Limit']).toBe('3');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('blocks the request that crosses the limit with 429 + Retry-After', async () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, message: 'slow down' });
    const next = vi.fn();

    await mw(makeReq('10.0.0.2'), makeRes().res, next);
    await mw(makeReq('10.0.0.2'), makeRes().res, next);

    const { res, headers } = makeRes();
    await mw(makeReq('10.0.0.2'), res, next);

    expect(next).toHaveBeenCalledTimes(2); // third must NOT proceed
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'slow down', status: 429 });
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });

  it('keys on the trusted req.ip and ignores a spoofed X-Forwarded-For', async () => {
    // req.ip is what Express derives from `trust proxy`; the raw header must not
    // let an attacker mint a fresh bucket per request to evade the limit.
    const mw = rateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn();

    await mw(makeReq('203.0.113.9', { forwarded: '1.1.1.1' }), makeRes().res, next);
    const blocked = makeRes();
    await mw(makeReq('203.0.113.9', { forwarded: '9.9.9.9' }), blocked.res, next);

    // Same real IP, different forged header -> still the same bucket -> blocked.
    expect(blocked.res.statusCode).toBe(429);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('separates an authenticated user from IP traffic into its own bucket', async () => {
    const token = jwt.sign({ userId: 'user-123' }, config.jwt.secret);
    const mw = rateLimit({ windowMs: 60_000, max: 1, name: 'auth' });
    const next = vi.fn();

    // Consume the per-IP budget.
    await mw(makeReq('198.51.100.1'), makeRes().res, next);
    // A different client on the same IP but authenticated has its own budget, so
    // it is not blocked by the IP bucket being used up.
    const userRes = makeRes();
    await mw(makeReq('198.51.100.1', { token }), userRes.res, next);

    expect(userRes.res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('reopens the budget once the window elapses', async () => {
    const mw = rateLimit({ windowMs: 1_000, max: 1 });
    const next = vi.fn();

    await mw(makeReq('10.0.0.3'), makeRes().res, next);
    const blocked = makeRes();
    await mw(makeReq('10.0.0.3'), blocked.res, next);
    expect(blocked.res.statusCode).toBe(429);

    vi.advanceTimersByTime(1_500);

    const after = makeRes();
    await mw(makeReq('10.0.0.3'), after.res, next);
    expect(after.res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('omits standard rate headers when standardHeaders is false', async () => {
    const mw = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: false });
    const { res, headers } = makeRes();
    await mw(makeReq('10.0.0.4'), res, vi.fn());
    expect(headers['X-RateLimit-Limit']).toBeUndefined();
    expect(headers['X-RateLimit-Remaining']).toBeUndefined();
  });

  it('fails closed with 503 when the store errors and failOpen is false', async () => {
    const failing = { increment: () => Promise.reject(new Error('redis down')) };
    const mw = rateLimit({ windowMs: 60_000, max: 1, failOpen: false, store: failing as any });
    const next = vi.fn();
    const { res, headers } = makeRes();

    await mw(makeReq('10.0.0.5'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(headers['Retry-After']).toBe('1');
  });

  it('fails open when the store errors on general traffic', async () => {
    const failing = { increment: () => Promise.reject(new Error('redis down')) };
    const mw = rateLimit({ windowMs: 60_000, max: 1, failOpen: true, store: failing as any });
    const next = vi.fn();

    await mw(makeReq('10.0.0.6'), makeRes().res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps named tiers isolated even when they share one store', async () => {
    const shared = new MemoryRateLimitStore();
    const upload = rateLimit({ windowMs: 60_000, max: 1, name: 'upload', store: shared });
    const general = rateLimit({ windowMs: 60_000, max: 1, name: 'global', store: shared });
    const next = vi.fn();

    await upload(makeReq('10.0.0.7'), makeRes().res, next);
    const second = makeRes();
    await upload(makeReq('10.0.0.7'), second.res, next);
    expect(second.res.statusCode).toBe(429);

    // The general tier has its own namespace -> unaffected by the upload bucket.
    const gen = makeRes();
    await general(makeReq('10.0.0.7'), gen.res, next);
    expect(gen.res.statusCode).toBe(200);
  });
});
