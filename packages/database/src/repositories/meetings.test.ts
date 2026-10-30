import { describe, it, expect } from 'vitest';
import { MeetingRepository } from './meetings';
import { Queryable } from '../interfaces';

/**
 * Object-level access control (#69) - data layer.
 *
 * The repository exposes two kinds of accessors:
 *  - OWNER-SCOPED (list/search/create): must always constrain to the requesting
 *    user so there is no way to enumerate or write another tenant's meetings.
 *  - ID-ONLY (findById/update/delete): intentionally not scoped, so the ROUTE is
 *    responsible for verifying `meeting.user_id === req.userId` before use
 *    (see apps/api/src/routes/meetings.ts, which returns 403 otherwise).
 *
 * These tests lock that contract in with a fake query executor - no DB needed.
 */
type Call = { text: string; params: any[] };

function makeDb(rows: any[] = []): Queryable & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
      calls.push({ text, params });
      return rows as T[];
    },
    async queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
      calls.push({ text, params });
      return (rows[0] ?? null) as T | null;
    },
  };
}

describe('MeetingRepository - owner-scoped accessors', () => {
  it('findByUserId always constrains to the requesting user (no unscoped listing)', async () => {
    const db = makeDb([]);
    const repo = new MeetingRepository(db);
    await repo.findByUserId('user-A', 20);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toMatch(/WHERE user_id = \$1/);
    expect(db.calls[0].params).toEqual(['user-A', 20]);
  });

  it('search always constrains results to the requesting user', async () => {
    const db = makeDb([]);
    const repo = new MeetingRepository(db);
    await repo.search('user-A', 'budget');
    const q = db.calls[0];
    expect(q.text).toMatch(/WHERE m\.user_id = \$1/);
    expect(q.params).toEqual(['user-A', '%budget%']);
  });

  it('create stamps the owning user as the first insert value', async () => {
    const db = makeDb([{ id: 'm1', user_id: 'user-A' }]);
    const repo = new MeetingRepository(db);
    await repo.create('user-A', { title: 'Standup' });
    const q = db.calls[0];
    expect(q.text).toMatch(/INSERT INTO meetings \(user_id/);
    expect(q.params[0]).toBe('user-A');
  });
});

describe('MeetingRepository - id-only accessors document the route guard contract', () => {
  it('findById is id-only (route MUST verify ownership before returning it)', async () => {
    const db = makeDb([{ id: 'm1', user_id: 'user-B' }]);
    const repo = new MeetingRepository(db);
    await repo.findById('m1');
    expect(db.calls[0].text).toMatch(/WHERE id = \$1/);
    expect(db.calls[0].text).not.toMatch(/user_id/);
  });

  it('delete is id-only (route MUST verify ownership before deleting)', async () => {
    const db = makeDb([]);
    const repo = new MeetingRepository(db);
    await repo.delete('m1');
    expect(db.calls[0].text).toMatch(/DELETE FROM meetings WHERE id = \$1/);
    expect(db.calls[0].text).not.toMatch(/user_id/);
  });
});
