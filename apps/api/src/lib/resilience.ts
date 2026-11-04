/**
 * Small, dependency-free resilience helpers.
 *
 * The OpenAI and AWS SDKs already retry internally, so we do NOT wrap those —
 * that would be tech for show. These helpers fill the real gaps:
 *   - bounded retries with exponential backoff + jitter for the plain `axios`
 *     external calls (webhooks already do their own DB-backed retry; Slack and
 *     other one-shot HTTP calls did not), and
 *   - a circuit breaker so a persistently-down dependency fails fast instead of
 *     piling queued requests onto it (graceful degradation).
 *
 * Everything here is pure and deterministic-in-test (clock/randomness/sleep are
 * injectable) so it is unit-tested without a network or timers.
 */

export interface RetryOptions {
  /** Total attempts including the first. Default 3. Never unbounded. */
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Apply jitter to the backoff. Default true. */
  jitter?: boolean;
  /** Decide whether an error is retryable. Default: retry everything. */
  retryOn?: (err: unknown, attempt: number) => boolean;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable RNG for deterministic tests. */
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Exponential backoff with "equal jitter": half of the delay is deterministic,
 * half is random. This bounds the wait (never infinite) while still spreading
 * concurrent retries so a recovering dependency isn't re-hit in a thundering
 * herd. attempt is 1-based.
 */
export function backoffDelay(
  attempt: number,
  opts: { baseDelayMs: number; maxDelayMs: number; jitter: boolean; random: () => number },
): number {
  const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  if (!opts.jitter) return exp;
  const half = exp / 2;
  return Math.round(half + opts.random() * half);
}

export async function retryAsync<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const jitter = options.jitter !== false;
  const retryOn = options.retryOn ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < attempts && retryOn(err, attempt);
      if (!canRetry) throw err;
      await sleep(backoffDelay(attempt, { baseDelayMs, maxDelayMs, jitter, random }));
    }
  }
  // Unreachable: the loop throws on the final attempt. Kept for the compiler.
  throw lastErr;
}

export class CircuitOpenError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('Circuit breaker is open');
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default 5. */
  failureThreshold?: number;
  /** How long the circuit stays open before a half-open probe. Default 30s. */
  resetTimeoutMs?: number;
  /** Probes allowed while half-open. Default 1. */
  halfOpenMax?: number;
  /** Which errors count as a dependency failure (vs a client error). */
  isFailure?: (err: unknown) => boolean;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Classic closed → open → half-open breaker. Opens after N consecutive
 * dependency failures; while open it rejects immediately with CircuitOpenError
 * (carrying a Retry-After hint); after resetTimeout it lets a bounded number of
 * probes through and closes on the first success or re-opens on a failure.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenInFlight = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMax: number;
  private readonly isFailure: (e: unknown) => boolean;
  private readonly now: () => number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = Math.max(1, opts.failureThreshold ?? 5);
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.halfOpenMax = Math.max(1, opts.halfOpenMax ?? 1);
    this.isFailure = opts.isFailure ?? (() => true);
    this.now = opts.now ?? (() => Date.now());
  }

  get currentState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = this.now();

    if (this.state === 'open') {
      const elapsed = now - this.openedAt;
      if (elapsed < this.resetTimeoutMs) {
        throw new CircuitOpenError(this.resetTimeoutMs - elapsed);
      }
      this.state = 'half-open';
      this.halfOpenInFlight = 0;
    }

    let tookHalfOpenSlot = false;
    if (this.state === 'half-open') {
      if (this.halfOpenInFlight >= this.halfOpenMax) {
        throw new CircuitOpenError(this.resetTimeoutMs);
      }
      this.halfOpenInFlight += 1;
      tookHalfOpenSlot = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (this.isFailure(err)) this.onFailure(now);
      else this.onSuccess(); // a non-dependency error (e.g. 4xx) must not trip it
      throw err;
    } finally {
      if (tookHalfOpenSlot) this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
    }
  }

  private onSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.openedAt = 0;
  }

  private onFailure(now: number) {
    this.consecutiveFailures += 1;
    if (this.state === 'half-open' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = now;
    }
  }
}

/** Build an axios-style timeout/retry config helper for one-shot HTTP calls. */
export function isRetryableHttpStatus(status?: number): boolean {
  if (status == null) return true; // network error / timeout
  return status === 429 || status >= 500; // rate limited or server side
}
