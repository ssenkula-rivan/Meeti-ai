import { describe, it, expect, vi, beforeEach } from 'vitest';

// Exercise the processMeeting idempotency guard without a live Postgres/Redis.
// Only the "already completed" early-return path is driven here, so the mocks
// only need to satisfy module construction + the first repository read.
const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('@meeti/database', () => {
  class Database {
    query() { return Promise.resolve({ rows: [] }); }
    queryOne() { return Promise.resolve(null); }
  }
  class MeetingRepository {
    findById() { return mocks.findById.apply(this, arguments as any); }
    updateStatus() { return mocks.updateStatus.apply(this, arguments as any); }
    getRecordingByMeetingId() { return Promise.resolve(null); }
    createRecording() { return Promise.resolve(undefined); }
  }
  class TranscriptRepository {}
  class ActionItemRepository {}
  return { Database, MeetingRepository, TranscriptRepository, ActionItemRepository };
});

vi.mock('../services', () => ({
  TranscriptionService: class {},
  AnalysisService: class {},
  NotificationService: class {},
  webhookService: { dispatchEvent: vi.fn() },
  slackService: { getIntegration: vi.fn() },
}));

vi.mock('../services/usage', () => ({
  getUsageService: () => ({ meterTranscription: vi.fn() }),
}));

import { processMeeting } from './process-meeting';

describe('processMeeting idempotency guard', () => {
  beforeEach(() => {
    mocks.findById.mockReset();
    mocks.updateStatus.mockReset();
  });

  it('skips a meeting that is already completed (no re-processing, no double cost)', async () => {
    mocks.findById.mockResolvedValue({ id: 'm1', user_id: 'u1', status: 'completed', title: 'X', meeting_type: 'business' });

    await processMeeting('m1');

    expect(mocks.findById).toHaveBeenCalledWith('m1');
    // Guard returns before the status transition, so nothing downstream runs.
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('does not block a non-completed meeting (guard lets it advance)', async () => {
    mocks.findById.mockResolvedValue({ id: 'm2', user_id: 'u1', status: 'failed', title: 'X', meeting_type: 'business' });

    // The flow advances past the guard and then hits intentionally-incomplete
    // fakes; we catch the resulting error. The assertion we care about is that
    // the guard allowed it to proceed: the first step after the guard is
    // updateStatus(meetingId, 'processing').
    await processMeeting('m2').catch(() => {});

    expect(mocks.updateStatus).toHaveBeenCalledWith('m2', 'processing');
  });
});
