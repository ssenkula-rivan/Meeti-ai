import { describe, it, expect, vi } from 'vitest';
import {
  retryAsync,
  backoffDelay,
  CircuitBreaker,
  CircuitOpenError,
  isRetryableHttpStatus,
} from './resilience';

describe('backoffDelay', () => {
  it('is deterministic without jitter and capped at maxDelayMs', () => {
    const opts = { baseDelayMs: 100, maxDelayMs: 1000, jitter: false, random: () => 0.5 };
    expect(backoffDelay(1, opts)).toBe(100);
    expect(backoffDelay(2, opts)).toBe(200);
    expect(backoffDelay(3, opts)).toBe(400);
    expect(backoffDelay(10, opts)).toBe(1000); // min(1000, 100 * 2^9)
  });

  it('applies equal jitter within [half, exp]', () => {
    const base = { baseDelayMs: 200, maxDelayMs: 5000, jitter: true };
    expect(backoffDelay(1, { ...base, random: () => 0 })).toBe(100); // floor: half
    expect(backoffDelay(1, { ...base, random: () => 1 })).toBe(200); // ceil: full
  });
});

describe('retryAsync', () => {
  it('returns on first success without sleeping', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retryAsync(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries up to the bounded attempt count, then throws the last error', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      retryAsync(fn, { attempts: 3, sleep, jitter: false, baseDelayMs: 10 })
    ).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2); // sleeps between, none after the last
  });

  it('respects retryOn and stops early for non-retryable errors', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));
    await expect(
      retryAsync(fn, { attempts: 5, sleep, retryOn: () => false })
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('succeeds on a later attempt after transient failures', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('t1'))
      .mockRejectedValueOnce(new Error('t2'))
      .mockResolvedValue('late-ok');
    await expect(retryAsync(fn, { attempts: 4, sleep, jitter: false, baseDelayMs: 1 })).resolves.toBe(
      'late-ok'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('CircuitBreaker', () => {
  it('opens after the failure threshold and rejects fast while open', async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000, now: () => now });
    const failing = () => Promise.reject(new Error('down'));

    await expect(cb.execute(failing)).rejects.toThrow('down'); // failure 1
    await expect(cb.execute(failing)).rejects.toThrow('down'); // failure 2 -> open
    expect(cb.currentState).toBe('open');

    // While open it short-circuits without invoking the underlying call.
    const spy = vi.fn();
    await expect(cb.execute(spy)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('half-opens after resetTimeout and closes on a successful probe', async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, now: () => now });
    await expect(cb.execute(() => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(cb.currentState).toBe('open');

    now = 1500; // past the reset window
    await expect(cb.execute(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(cb.currentState).toBe('closed');
  });

  it('re-opens when a half-open probe fails', async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, now: () => now });
    await cb.execute(() => Promise.reject(new Error('x'))).catch(() => undefined);
    now = 1500;
    await cb.execute(() => Promise.reject(new Error('still down'))).catch(() => undefined);
    expect(cb.currentState).toBe('open');
  });

  it('a non-failure error must not trip the breaker', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, isFailure: () => false });
    await expect(cb.execute(() => Promise.reject(new Error('client 4xx')))).rejects.toThrow(
      'client 4xx'
    );
    expect(cb.currentState).toBe('closed');
  });
});

describe('isRetryableHttpStatus', () => {
  it('treats network errors, 429 and 5xx as retryable; other 4xx as not', () => {
    expect(isRetryableHttpStatus(undefined)).toBe(true); // network error / timeout
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(404)).toBe(false);
    expect(isRetryableHttpStatus(200)).toBe(false);
  });
});
