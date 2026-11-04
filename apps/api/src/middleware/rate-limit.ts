import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import IORedis from 'ioredis';
import { config } from '../config';
import {
  RateLimitStore,
  MemoryRateLimitStore,
  RedisRateLimitStore,
} from '../lib/rate-limit-store';

/**
 * Production rate limiter, decoupled from its counting backend.
 *
 * Design decisions (grounded in the current single-node deployment):
 *   - Client identity comes from `req.ip`, which Express derives using the
 *     configured `trust proxy` setting. We deliberately do NOT read the raw
 *     `x-forwarded-for` header: its leftmost value is attacker-controlled, so
 *     trusting it lets an abuser forge a new identity per request and evade the
 *     limit entirely.
 *   - Authenticated traffic is bucketed per user (a shared NAT/office exit IP
 *     can't let one abuser exhaust everyone's budget, and per-user limits are
 *     meaningful); everyone else is bucketed per IP.
 *   - Each named tier gets its own bucket namespace, so a strict "auth" or
 *     "upload" limit never bleeds into the general API budget.
 *   - Fixed-window counting (simple, cheap, good anti-abuse ceiling). The
 *     sliding-window/token-bucket tradeoff is documented in the architecture
 *     notes; fixed window is the right default for these abuse patterns.
 *   - If the counting backend is unavailable we fail OPEN on general traffic
 *     (a cache outage must not take the API down) but fail CLOSED (503) on the
 *     tiers that exist purely to stop abuse, so a store failure can't be used
 *     to bypass brute-force protection.
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Bucket namespace so tiers don't share counts. Default "default". */
  name?: string;
  message?: string;
  /** Emit RateLimit / X-RateLimit headers. Default true. */
  standardHeaders?: boolean;
  /** When the store errors, allow the request (true) or reject with 503 (false). */
  failOpen?: boolean;
  store?: RateLimitStore;
}

let configuredStore: RateLimitStore | null = null;

/** Override the shared store (used at boot, and by tests to inject a fake). */
export function configureRateLimitStore(store: RateLimitStore | null): void {
  configuredStore = store;
}

/**
 * When REDIS_ENABLED with a TCP/TLS URL, build a single shared Redis store so
 * limits are global across instances. Note we connect ioredis to `redis.tlsUrl`
 * (a `redis://` / `rediss://` endpoint) — NOT the Upstash REST URL, which is
 * HTTPS and incompatible with ioredis/BullMQ. Returns null (in-memory) if
 * Redis is off or the client cannot be created.
 */
export function configureFromRedis(): RateLimitStore | null {
  if (!config.redis.enabled || !config.redis.tlsUrl) {
    configuredStore = null;
    return null;
  }
  try {
    const client = new IORedis(config.redis.tlsUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    const store = new RedisRateLimitStore(client);
    configuredStore = store;
    return store;
  } catch (err) {
    console.warn('Redis rate-limit store unavailable, using in-memory:', err);
    configuredStore = null;
    return null;
  }
}

function resolveStore(explicit?: RateLimitStore): RateLimitStore {
  // In production the boot path sets `configuredStore`. When it is null (e.g.
  // tests calling the factory directly), fall back to a fresh per-instance
  // in-memory store so behaviour and isolation match the single-node default.
  return explicit ?? configuredStore ?? new MemoryRateLimitStore();
}

/**
 * Resolve the best client identity without trusting a spoofable header.
 * Prefers the authenticated user id (cheaply verified from the bearer token);
 * otherwise uses the proxy-trust-correct req.ip.
 */
function clientKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), config.jwt.secret) as { userId?: string };
      if (decoded.userId) return `user:${decoded.userId}`;
    } catch {
      /* invalid/expired token: fall through to IP keying */
    }
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    name = 'default',
    message = 'Too many requests, please try again later.',
    standardHeaders = true,
    failOpen = true,
  } = options;
  const store = resolveStore(options.store);
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  // Async because the counting backend may be remote (Redis). It never rejects:
  // every path calls next() or ends the response, so Express is safe.
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `${name}:${clientKey(req)}`;
    let record: { total: number; resetAt: number };
    try {
      record = await store.increment(key, windowMs);
    } catch (err) {
      console.warn(`Rate-limit store error (${name}):`, err);
      if (failOpen) {
        next();
        return;
      }
      res.setHeader('Retry-After', '1');
      res.status(503).json({ error: 'Rate limiting temporarily unavailable.', status: 503 });
      return;
    }

    const now = Date.now();
    const resetSeconds = Math.max(0, Math.ceil((record.resetAt - now) / 1000));
    const remaining = Math.max(0, max - record.total);

    if (standardHeaders) {
      // draft-7 combined header + legacy per-field headers for broad clients.
      res.setHeader('RateLimit', `limit=${max}, remaining=${remaining}, reset=${resetSeconds}`);
      res.setHeader('RateLimit-Policy', `${max};w=${windowSeconds}`);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(record.resetAt));
    }

    if (record.total > max) {
      res.setHeader('Retry-After', String(Math.max(1, resetSeconds)));
      res.status(429).json({ error: message, status: 429 });
      return;
    }

    next();
  };
}
