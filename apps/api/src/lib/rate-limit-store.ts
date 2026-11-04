/**
 * Rate-limit counting stores.
 *
 * A store answers one question atomically for a key inside a fixed window:
 * "how many requests so far, and when does the window reset?" Hiding this
 * behind an interface lets the limiter run in-process today (single node) and
 * move to a shared Redis store the moment Redis is provisioned — with zero
 * middleware changes, so the limit becomes global across API instances.
 */

export interface RateLimitRecord {
  total: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitRecord>;
}

/** Fixed-window counter held in this process. Correct for a single instance. */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitRecord>();

  constructor() {
    const sweeper = setInterval(() => this.sweep(), 60_000);
    if (typeof (sweeper as { unref?: () => void }).unref === 'function') {
      (sweeper as { unref: () => void }).unref();
    }
  }

  increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { total: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.total += 1;
    return Promise.resolve({ ...bucket });
  }

  /** Reclaim expired buckets so the map cannot grow unbounded. Returns count. */
  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

/** The single Redis operation the store needs — typed narrowly for testability. */
interface RedisLike {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<any>;
}

/**
 * Atomic fixed window via one Redis Lua script. NOTE: `redis.eval` is the Redis
 * server-side EVAL command, NOT JavaScript `eval` — any scanner warning here is
 * a false positive. The script text is a static module constant (never built
 * from input) and both the key and the window are passed as KEYS/ARGV, so they
 * are bound as data by Redis and cannot alter the script. This is the same
 * atomic INCR+PEXPIRE+PTTL pattern used by established rate limiters; doing it
 * without a script risks an un-expired key if the process dies between calls.
 */
const INCR_WINDOW_SCRIPT = `
local total = redis.call('INCR', KEYS[1])
if total == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { total, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: RedisLike, private readonly prefix = 'rl') {}

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const res = await this.redis.eval(
      INCR_WINDOW_SCRIPT,
      1,
      `${this.prefix}:${key}`,
      String(windowMs),
    );
    const total = Number(Array.isArray(res) ? res[0] : res);
    const ttl = Number(Array.isArray(res) ? res[1] : windowMs);
    const safeTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs;
    return {
      total: Number.isFinite(total) ? total : 1,
      resetAt: Date.now() + safeTtl,
    };
  }
}
