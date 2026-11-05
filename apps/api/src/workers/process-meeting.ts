import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config';
import {
  Database,
  Queryable,
  MeetingRepository,
  TranscriptRepository,
  ActionItemRepository,
  IMeetingReader,
  IMeetingLifecycle,
  IAudioRecordingStore,
  ITranscriptLifecycle,
  ITranscriptSegmentStore,
  ISpeakerStore,
  IActionItemWriter,
  IMeetingSummaryStore,
  IMeetingDecisionStore,
} from '@meeti/database';
import {
  TranscriptionService,
  SpeechTranscriber,
  AnalysisService,
  MeetingAnalyzer,
  NotificationService,
  MeetingNotifier,
  webhookService,
  WebhookDispatcher,
  slackService,
  SlackMeetingNotifier,
} from '../services';
import { getUsageService } from '../services/usage';

let connection: IORedis | null = null;

if (config.redis.enabled) {
  try {
    if (config.redis.url && config.redis.token) {
      connection = new IORedis(config.redis.url, {
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
        lazyConnect: true,
      });
    } else {
      connection = new IORedis({
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
        lazyConnect: true,
      });
    }
  } catch (err) {
    console.warn('Failed to initialize Redis connection, running in direct async mode:', err);
    connection = null;
  }
}

export const meetingQueue = connection ? new Queue('meeting-processing', { connection }) : null;

export type MeetingStore = IMeetingReader & IMeetingLifecycle & IAudioRecordingStore;
export type TranscriptStore = ITranscriptLifecycle & ITranscriptSegmentStore & ISpeakerStore;
export type ActionItemStore = IActionItemWriter & IMeetingSummaryStore & IMeetingDecisionStore;

const db: Queryable = new Database(config.database);
const meetingRepo: MeetingStore = new MeetingRepository(db);
const transcriptRepo: TranscriptStore = new TranscriptRepository(db);
const actionItemRepo: ActionItemStore = new ActionItemRepository(db);
const transcriptionService: SpeechTranscriber = new TranscriptionService();
const analyzer: MeetingAnalyzer = new AnalysisService();
const notificationService: MeetingNotifier = new NotificationService(db);
const webhookDispatcher: WebhookDispatcher = webhookService;
const slackNotifier: SlackMeetingNotifier = slackService;
const usage = getUsageService(db);

interface MeetingJob {
  meetingId: string;
}

export async function processMeeting(meetingId: string): Promise<void> {
  console.log(`Processing meeting ${meetingId}`);

  try {
    // 1. Get meeting
    const meeting = await meetingRepo.findById(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    // Idempotency: a completed meeting must never be re-processed. A redelivery
    // (duplicate enqueue, queue retry, manual requeue, or the no-Redis direct
    // fallback) would otherwise re-run paid STT/LLM steps and append duplicate
    // summaries / decisions / action items, which are INSERT-only. Failed
    // meetings (status 'failed') remain eligible for re-processing.
    if (meeting.status === 'completed') {
      console.log(`Meeting ${meetingId} already completed; skipping duplicate processing`);
      return;
    }

    await meetingRepo.updateStatus(meetingId, 'processing');

    // Clear any previous failure reason before (re)processing.
    try {
      await db.query(`UPDATE meetings SET metadata = metadata - 'failureReason' WHERE id = $1`, [meetingId]);
    } catch (_) {
      // non-critical
    }

    // 2. Locate audio file
    const recording = await meetingRepo.getRecordingByMeetingId(meetingId);
    let audioFilePath = '';

    if (recording && recording.storage_path) {
      const candidatePaths = [
        recording.storage_path,
        path.join(process.cwd(), 'uploads', recording.storage_path),
        path.join(process.cwd(), recording.storage_path),
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          audioFilePath = p;
          break;
        }
      }
    }

    // 3. Transcribe audio
    let transcript = await transcriptRepo.findByMeetingId(meetingId);
    if (!transcript) {
      transcript = await transcriptRepo.create(meetingId, config.ai.sttProvider);
    }
    await transcriptRepo.updateStatus(transcript.id, 'processing');

    const transcriptionResult = await transcriptionService.transcribe(
      audioFilePath,
      meeting.source_language || undefined,
    );

    // 4. Create speakers if needed
    const existingSpeakers = await transcriptRepo.getSpeakers(meetingId);
    const speakerMap: Record<string, string> = {};

    for (const seg of transcriptionResult.segments) {
      const label = seg.speaker || 'Speaker 1';
      if (!speakerMap[label]) {
        const found = existingSpeakers.find(s => s.speaker_label === label);
        if (found) {
          speakerMap[label] = found.id;
        } else {
          const newSpeaker = await transcriptRepo.createSpeaker(meetingId, label);
          speakerMap[label] = newSpeaker.id;
        }
      }
    }

    // 5. Save segments
    // Clean old segments if re-processing
    await db.query('DELETE FROM transcript_segments WHERE transcript_id = $1', [transcript.id]);

    const detectedLanguage = transcriptionResult.language || 'en';
    const uniqueLanguages = new Set([detectedLanguage]);

    for (let i = 0; i < transcriptionResult.segments.length; i++) {
      const segment = transcriptionResult.segments[i];
      await transcriptRepo.createSegment({
        transcript_id: transcript.id,
        segment_index: i,
        start_time: segment.start,
        end_time: segment.end,
        text: segment.text,
        language: detectedLanguage,
        speaker_id: segment.speaker ? speakerMap[segment.speaker] : undefined,
      });
    }

    // Update transcript language
    await db.query('UPDATE transcripts SET language = $1 WHERE id = $2', [detectedLanguage, transcript.id]);

    // Update meeting with detected languages
    await db.query('UPDATE meetings SET detected_languages = $1 WHERE id = $2', [Array.from(uniqueLanguages), meetingId]);

    await transcriptRepo.updateStatus(transcript.id, 'completed');

    // Meter AI usage once per meeting; dedupe key prevents double-charging.
    // Duration prefers stored length, then last segment end, then recording.
    const meteredSeconds =
      meeting.duration_seconds ||
      (transcriptionResult.segments.length
        ? Math.ceil(transcriptionResult.segments[transcriptionResult.segments.length - 1].end)
        : 0) ||
      (recording?.duration_seconds || 0);
    try {
      await usage.meterTranscription(meeting.user_id, meetingId, meteredSeconds);
    } catch (meterErr) {
      // Metering failure must not abort the analysis.
      console.error(`Failed to meter transcription usage for ${meetingId}:`, meterErr);
    }

    // 6. Content analysis
    const analysis = await analyzer.analyzeMeeting(
      transcriptionResult.text,
      meeting.meeting_type,
      meeting.title
    );

    // 7. Save summary
    await actionItemRepo.createSummary(
      meetingId,
      analysis.summary,
      analysis.executiveSummary,
      analysis.sentiment,
      analysis.keyPoints
    );

    // 8. Save decisions
    for (const decision of analysis.decisions) {
      await actionItemRepo.createDecision(
        meetingId,
        decision.decision,
        decision.timestamp
      );
    }

    // 9. Save risks
    for (const risk of analysis.risks) {
      await db.query(
        'INSERT INTO meeting_risks (meeting_id, risk) VALUES ($1, $2)',
        [meetingId, risk]
      );
    }

    // 10. Save follow-ups
    for (const followUp of analysis.followUps) {
      await db.query(
        'INSERT INTO meeting_followups (meeting_id, follow_up) VALUES ($1, $2)',
        [meetingId, followUp]
      );
    }

    // 11. Save action items
    for (const item of analysis.actionItems) {
      await actionItemRepo.create(meetingId, {
        task: item.task,
        assignee: item.assignee,
        assignee_user_id: meeting.user_id,
        due_date: item.dueDate ? new Date(item.dueDate) : undefined,
        priority: item.priority,
      });
    }

    // 12. Update Search Index
    try {
      const combinedSearchText = [
        meeting.title,
        meeting.meeting_type,
        analysis.summary,
        analysis.executiveSummary,
        analysis.decisions.map(d => d.decision).join(' '),
        analysis.actionItems.map(a => a.task).join(' '),
        analysis.risks.join(' '),
        analysis.followUps.join(' '),
        transcriptionResult.text,
      ].filter(Boolean).join(' ');

      await db.query('DELETE FROM search_index WHERE meeting_id = $1', [meetingId]);
      await db.query(
        `INSERT INTO search_index (meeting_id, user_id, document)
         VALUES ($1, $2, to_tsvector('english', $3))`,
        [meetingId, meeting.user_id, combinedSearchText]
      );
    } catch (searchErr) {
      console.warn('Failed to update search index:', searchErr);
    }

    // 13. Update meeting status
    await meetingRepo.updateStatus(meetingId, 'completed');

    // 14. Notify user
    try {
      await notificationService.notifyMeetingComplete(
        meeting.user_id,
        meetingId,
        meeting.title
      );
    } catch (notifErr) {
      console.warn('Failed to send completion notification:', notifErr);
    }

    // 15. Dispatch webhook event
    try {
      const finalSummary = await db.queryOne(
        'SELECT executive_summary FROM meeting_summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
        [meetingId]
      );
      const finalActions = await db.query(
        'SELECT task, assignee, due_date FROM action_items WHERE meeting_id = $1',
        [meetingId]
      );
      await webhookDispatcher.dispatchEvent(meeting.user_id, 'meeting.completed', {
        meeting_id: meetingId,
        title: meeting.title,
        duration_seconds: meeting.duration_seconds,
        summary: finalSummary?.executive_summary,
        action_item_count: finalActions?.length ?? 0,
      });
    } catch (webhookErr) {
      console.warn('Webhook dispatch failed:', webhookErr);
    }

    // 16. Notify Slack
    try {
      const slackIntegration = await slackNotifier.getIntegration(meeting.user_id);
      if (slackIntegration?.notify_on_complete) {
        const slackSummary = await db.queryOne(
          'SELECT executive_summary, summary FROM meeting_summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
          [meetingId]
        );
        const slackActions = await db.query(
          'SELECT task, assignee, due_date FROM action_items WHERE meeting_id = $1',
          [meetingId]
        );
        await slackNotifier.sendMeetingNotes(meeting.user_id, {
          meetingId,
          title: meeting.title,
          duration: meeting.duration_seconds || 0,
          summary: slackSummary?.executive_summary || slackSummary?.summary,
          actionItems: slackActions || [],
        });
      }
    } catch (slackErr) {
      console.warn('Slack notification failed:', slackErr);
    }

    console.log(`Meeting ${meetingId} processed successfully`);
  } catch (error) {
    console.error(`Failed to process meeting ${meetingId}:`, error);
    await meetingRepo.updateStatus(meetingId, 'failed');

    // Store the real reason on the meeting so the UI can show something honest
    // and actionable instead of a generic "processing failed".
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await db.query(
        `UPDATE meetings
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{failureReason}', to_jsonb($2::text))
         WHERE id = $1`,
        [meetingId, reason.slice(0, 500)]
      );
    } catch (_) {
      // non-critical
    }

    const meeting = await meetingRepo.findById(meetingId);
    if (meeting) {
      try {
        await notificationService.notifyMeetingFailed(
          meeting.user_id,
          meetingId,
          meeting.title
        );
      } catch (e) {
        // ignore notification error
      }
    }

    throw error;
  }
}

export async function queueMeeting(meetingId: string): Promise<void> {
  if (meetingQueue) {
    try {
      await meetingQueue.add(
        'process-meeting',
        { meetingId },
        {
          // Deterministic job id collapses duplicate/concurrent enqueues for the
          // same meeting into a single job (e.g. a double-submitted import).
          // Removing finished jobs keeps the id free so a legitimate later
          // re-queue is not permanently blocked by a retained job id.
          jobId: `meeting:${meetingId}`,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
      return;
    } catch (err) {
      console.warn('Failed to add job to queue, running directly:', err);
    }
  }

  // Direct asynchronous execution when the queue is unavailable
  setImmediate(async () => {
    try {
      await processMeeting(meetingId);
    } catch (err) {
      console.error(`Background processing failed for meeting ${meetingId}:`, err);
    }
  });
}

let meetingWorker: Worker<MeetingJob> | null = null;

if (config.redis.enabled && connection) {
  try {
    meetingWorker = new Worker<MeetingJob>(
      'meeting-processing',
      async (job) => {
        await processMeeting(job.data.meetingId);
      },
      {
        connection,
        concurrency: 3,
      }
    );

    meetingWorker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    meetingWorker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  } catch (err) {
    console.warn('Worker initialization skipped:', err);
  }
}
