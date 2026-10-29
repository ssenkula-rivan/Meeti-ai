import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Dependency-free fixed-window rate limiter keyed by client IP.
 *
 * We intentionally avoid pulling in express-rate-limit so the hardening can
 * ship without a new install. For a single-node API this is sufficient; when
 * the fleet scales behind a load balancer, move the buckets to Redis so the
 * limit is global rather than per-instance.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  standardHeaders?: boolean;
  message?: string;
}) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;
  const buckets = new Map<string, Bucket>();

  // Periodically reclaim memory so the map cannot grow unbounded.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);
  // Do not keep the process alive just for the sweeper.
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // First untrusted proxy hop = client IP (Caddy/ALB sets X-Forwarded-For).
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.ip || 'unknown';
    const key = `${ip}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (options.standardHeaders !== false) {
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    }

    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      res.status(429).json({ error: message, status: 429 });
      return;
    }

    next();
  };
}
