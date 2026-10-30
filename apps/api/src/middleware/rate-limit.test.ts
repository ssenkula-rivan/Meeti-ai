import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit } from './rate-limit';

/**
 * Minimal stand-ins for the Express req/res so we can exercise the limiter as a
 * pure unit — no HTTP server, no extra dependencies (mirrors how the middleware
 * itself deliberately avoids express-rate-limit).
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

function makeReq(ip: string, forwarded?: string) {
  const headers: Record<string, string> = {};
  if (forwarded) headers['x-forwarded-for'] = forwarded;
  return { ip, headers } as any;
}

describe('rateLimit middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets requests through under the limit and reports remaining budget', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3 });
    const next = vi.fn();
    const { res, headers } = makeRes();

    mw(makeReq('10.0.0.1'), res, next);
    mw(makeReq('10.0.0.1'), res, next);
    mw(makeReq('10.0.0.1'), res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(headers['X-RateLimit-Limit']).toBe('3');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('blocks the request that crosses the limit with 429 + Retry-After', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, message: 'slow down' });
    const next = vi.fn();

    mw(makeReq('10.0.0.2'), makeRes().res, next);
    mw(makeReq('10.0.0.2'), makeRes().res, next);

    const { res, headers } = makeRes();
    mw(makeReq('10.0.0.2'), res, next);

    expect(next).toHaveBeenCalledTimes(2); // third call must NOT proceed
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'slow down', status: 429 });
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });

  it('isolates buckets per client IP (first X-Forwarded-For hop wins)', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn();

    // Exhaust attacker A's bucket.
    mw(makeReq('ignored', '1.1.1.1, 2.2.2.2'), makeRes().res, next);
    const blocked = makeRes();
    mw(makeReq('ignored', '1.1.1.1, 2.2.2.2'), blocked.res, next);
    expect(blocked.res.statusCode).toBe(429);

    // Innocent client B is unaffected.
    const ok = makeRes();
    mw(makeReq('ignored', '9.9.9.9'), ok.res, next);
    expect(ok.res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('reopens the budget once the window elapses', () => {
    const mw = rateLimit({ windowMs: 1_000, max: 1 });
    const next = vi.fn();

    mw(makeReq('10.0.0.3'), makeRes().res, next);
    const blocked = makeRes();
    mw(makeReq('10.0.0.3'), blocked.res, next);
    expect(blocked.res.statusCode).toBe(429);

    vi.advanceTimersByTime(1_500);

    const after = makeRes();
    mw(makeReq('10.0.0.3'), after.res, next);
    expect(after.res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('omits standard rate headers when standardHeaders is false', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: false });
    const { headers } = makeRes();
    mw(makeReq('10.0.0.4'), makeRes().res, vi.fn());
    expect(headers['X-RateLimit-Limit']).toBeUndefined();
    expect(headers['X-RateLimit-Remaining']).toBeUndefined();
  });
});
