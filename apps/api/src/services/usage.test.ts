import { describe, it, expect } from 'vitest';
import { UsageService } from './usage';
import { config } from '../config';
import type { Queryable } from '@meeti/database';

type Call = { text: string; params?: unknown[] };
type Resolver = (text: string) => unknown;

function fakeDb(resolver: Resolver): Queryable & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      calls.push({ text, params });
      const r = resolver(text);
      return (Array.isArray(r) ? r : r ? [r] : []) as T[];
    },
    async queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
      calls.push({ text, params });
      const r = resolver(text);
      return (r ?? null) as T | null;
    },
  };
}

const PRO_ROW = { slug: 'pro', name: 'Pro', price_monthly: '9.99', limits: { transcriptionMinutes: 500, exports: 50 } };
const FREE_ROW = { slug: 'free', name: 'Free', price_monthly: 0, limits: { transcriptionMinutes: 60, exports: 5 } };

describe('UsageService.resolvePlan', () => {
  it('returns the active subscription plan when present', async () => {
    const svc = new UsageService(fakeDb((t) => (/FROM subscriptions/.test(t) ? PRO_ROW : null)));
    const plan = await svc.resolvePlan('u1');
    expect(plan.slug).toBe('pro');
    expect(plan.source).toBe('subscription');
    expect(plan.limits.transcriptionMinutes).toBe(500);
  });

  it('falls back to the free plan when there is no subscription', async () => {
    const svc = new UsageService(fakeDb((t) => (/slug = 'free'/.test(t) ? FREE_ROW : null)));
    const plan = await svc.resolvePlan('u1');
    expect(plan.slug).toBe('free');
    expect(plan.source).toBe('default');
    expect(plan.limits.exports).toBe(5);
  });

  it('uses built-in defaults when even the free row is missing', async () => {
    const svc = new UsageService(fakeDb(() => null));
    const plan = await svc.resolvePlan('u1');
    expect(plan.slug).toBe('free');
    expect(plan.limits.transcriptionMinutes).toBe(60);
  });
});

describe('UsageService.assertCanProcessRecording', () => {
  const proWithMinutesUsed = (used: number): Resolver => (t) => {
    if (/FROM subscriptions/.test(t)) return PRO_ROW;
    if (/SUM\(amount\)/.test(t)) return { used };
    return null;
  };

  it('allows a recording within the monthly allowance', async () => {
    const svc = new UsageService(fakeDb(proWithMinutesUsed(100)));
    await expect(svc.assertCanProcessRecording('u1', 600)).resolves.toBeUndefined();
  });

  it('rejects when the recording would exceed the allowance (402)', async () => {
    const svc = new UsageService(fakeDb(proWithMinutesUsed(500)));
    await expect(svc.assertCanProcessRecording('u1', 600)).rejects.toMatchObject({ statusCode: 402 });
  });

  it('rejects an over-length recording before any plan lookup (413)', async () => {
    const svc = new UsageService(fakeDb(() => null));
    await expect(svc.assertCanProcessRecording('u1', config.limits.maxRecordingSeconds + 1)).rejects.toMatchObject({ statusCode: 413 });
  });
});

describe('UsageService.assertCanExport', () => {
  const proWithExportsUsed = (used: number): Resolver => (t) => {
    if (/FROM subscriptions/.test(t)) return PRO_ROW;
    if (/COUNT\(\*\)/.test(t)) return { c: used };
    return null;
  };

  it('allows an export under the limit', async () => {
    const svc = new UsageService(fakeDb(proWithExportsUsed(10)));
    await expect(svc.assertCanExport('u1')).resolves.toBeUndefined();
  });

  it('rejects once the export limit is reached (402)', async () => {
    const svc = new UsageService(fakeDb(proWithExportsUsed(50)));
    await expect(svc.assertCanExport('u1')).rejects.toMatchObject({ statusCode: 402 });
  });
});

describe('UsageService.summary', () => {
  it('reports used / limit / remaining for the current month', async () => {
    const db = fakeDb((t) => {
      if (/FROM subscriptions/.test(t)) return PRO_ROW;
      if (/SUM\(amount\)/.test(t)) return { used: 120 };
      if (/COUNT\(\*\)/.test(t)) return { c: 3 };
      return null;
    });
    const svc = new UsageService(db);
    const s = await svc.summary('u1');
    expect(s.plan.slug).toBe('pro');
    expect(s.transcriptionMinutes).toEqual({ limit: 500, used: 120, remaining: 380 });
    expect(s.exports).toEqual({ limit: 50, used: 3, remaining: 47 });
  });
});
