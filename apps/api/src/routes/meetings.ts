import { Router } from 'express';
import { z } from 'zod';
import {
  Database,
  Queryable,
  MeetingRepository,
  IMeetingReader,
  IMeetingWriter,
  IMeetingLifecycle,
  IMeetingSearch,
} from '@meeti/database';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { queueMeeting } from '../workers/process-meeting';
import { emailService } from '../services/email';
import { StorageService } from '../services/storage';
import { getUsageService } from '../services/usage';

const router = Router();
const db: Queryable = new Database(config.database);
const storage = new StorageService();
const usage = getUsageService(db);
const meetingRepo: IMeetingReader & IMeetingWriter & IMeetingLifecycle & IMeetingSearch =
  new MeetingRepository(db);

router.use(authenticate);

// Conferencing platforms that join through a shareable link; recordings on
// these platforms capture audio locally while the user attends via the link.
const LINK_BASED_PLATFORMS = ['google-meet', 'zoom', 'microsoft-teams', 'webex'] as const;

const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  meetingType: z.string().optional(),
  sourceLanguage: z.string().trim().max(10).optional(),
  outputLanguage: z.string().optional(),
  platform: z.enum(['in-person', 'phone', 'whatsapp', 'telegram', 'other', ...LINK_BASED_PLATFORMS]).optional(),
  meetingLink: z.string().trim().url('Enter a valid meeting link').optional().or(z.literal('')),
}).refine(
  (data) => !data.platform || LINK_BASED_PLATFORMS.includes(data.platform as any) || !data.meetingLink,
  { message: 'A meeting link is not required for this platform', path: ['meetingLink'] },
).refine(
  (data) => !data.platform || !LINK_BASED_PLATFORMS.includes(data.platform as any) || !!data.meetingLink?.trim(),
  { message: 'This platform requires a meeting link to join', path: ['meetingLink'] },
);

const updateMeetingSchema = z.object({
  title: z.string().optional(),
  meetingType: z.string().optional(),
  outputLanguage: z.string().optional(),
  platform: z.enum(['in-person', 'phone', 'whatsapp', 'telegram', 'other', ...LINK_BASED_PLATFORMS]).optional(),
  meetingLink: z.string().trim().url('Enter a valid meeting link').optional().or(z.literal('')),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createMeetingSchema.parse(req.body);
    const meeting = await meetingRepo.create(req.userId!, {
      title: data.title,
      meeting_type: data.meetingType,
      // 'auto' (or absent) means let the provider detect the spoken language.
      source_language: data.sourceLanguage && data.sourceLanguage !== 'auto' ? data.sourceLanguage : undefined,
      output_language: data.outputLanguage,
      metadata: data.platform
        ? { platform: data.platform, meeting_link: data.meetingLink?.trim() || null }
        : undefined,
    });

    res.status(201).json(meeting);
  } catch (error) {
    next(error);
  }
});

// Record that the user confirmed the recording-consent notice for a meeting.
// Always allowed (harmless when the flag is off); enforcement happens on upload.
const CONSENT_VERSION = 'v1';
router.post('/:id/consent', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) throw new AppError(404, 'Meeting not found');
    if (meeting.user_id !== req.userId) throw new AppError(403, 'Access denied');

    await db.query(
      `UPDATE meetings
       SET consent_confirmed = true, consent_confirmed_at = NOW(), consent_version = $1
       WHERE id = $2 AND user_id = $3`,
      [CONSENT_VERSION, req.params.id, req.userId],
    );
    res.json({ ok: true, consentVersion: CONSENT_VERSION });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const meetings = await meetingRepo.findByUserId(req.userId!);
    res.json(meetings);
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req: AuthRequest, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      const allMeetings = await meetingRepo.findByUserId(req.userId!);
      return res.json(allMeetings);
    }
    const results = await meetingRepo.search(req.userId!, query);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }
    res.json(meeting);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const data = updateMeetingSchema.parse(req.body);
    const metadata = data.platform
      ? {
          ...(meeting.metadata || {}),
          platform: data.platform,
          meeting_link: data.meetingLink?.trim() || null,
        }
      : undefined;
    const updated = await meetingRepo.update(req.params.id, {
      title: data.title,
      meeting_type: data.meetingType,
      output_language: data.outputLanguage,
      metadata,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    await meetingRepo.startRecording(req.params.id);
    res.json({ status: 'recording' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/stop', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    // Enforce AI allowance before spending credit, estimated from start time.
    const estimatedSeconds = meeting.started_at
      ? Math.floor((Date.now() - new Date(meeting.started_at).getTime()) / 1000)
      : 0;
    await usage.assertCanProcessRecording(req.userId!, estimatedSeconds);

    await meetingRepo.stopRecording(req.params.id);
    await queueMeeting(req.params.id);

    res.json({ status: 'processing' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/process', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    // Re-processing is gated on remaining allowance.
    await usage.assertCanProcessRecording(req.userId!, meeting.duration_seconds || 0);

    await queueMeeting(req.params.id);
    res.json({ status: 'processing' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/summary', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const summary = await db.queryOne(
      'SELECT * FROM meeting_summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );

    res.json(summary || {});
  } catch (error) {
    next(error);
  }
});

router.get('/:id/decisions', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const decisions = await db.query(
      'SELECT * FROM meeting_decisions WHERE meeting_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json(decisions);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/risks', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const risks = await db.query(
      'SELECT * FROM meeting_risks WHERE meeting_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json(risks);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/followups', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const followUps = await db.query(
      'SELECT * FROM meeting_followups WHERE meeting_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json(followUps);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    // Purge the meeting's stored audio so recordings do not linger in S3,
    // then remove the meeting row (its transcripts/notes/etc. cascade-delete).
    try {
      await storage.deleteByPrefix(`users/${meeting.user_id}/meetings/${req.params.id}/`);
    } catch (err) {
      console.error('Failed to purge recordings for meeting', req.params.id, err);
    }

    await meetingRepo.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/action-items', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const actionItems = await db.query(
      'SELECT * FROM action_items WHERE meeting_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json(actionItems);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/translate', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const targetLanguage = req.body.targetLanguage || 'en';
    const { translateSegments, translateDecisions, translateActionItems } = req.body;

    const { AnalysisService } = await import('../services/analysis');
    const analyzer = new AnalysisService();

    const result: any = {
      targetLanguage,
    };

    // Translate summary if requested
    const summary = await db.queryOne(
      'SELECT * FROM meeting_summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );

    if (summary) {
      result.originalSummary = summary.summary_text;
      result.translatedSummary = await analyzer.translate(summary.summary_text, targetLanguage);
      if (summary.executive_summary) {
        result.translatedExecutiveSummary = await analyzer.translate(summary.executive_summary, targetLanguage);
      }
    }

    // Translate transcript segments if requested
    if (translateSegments) {
      const segments = await db.query(
        'SELECT id, text FROM transcript_segments WHERE transcript_id IN (SELECT id FROM transcripts WHERE meeting_id = $1) ORDER BY segment_index',
        [req.params.id]
      );

      result.translatedSegments = [];
      for (const segment of segments) {
        const translatedText = await analyzer.translate(segment.text, targetLanguage);
        result.translatedSegments.push({
          id: segment.id,
          originalText: segment.text,
          translatedText,
        });

        // Update database with translated text
        await db.query(
          'UPDATE transcript_segments SET translated_text = $1 WHERE id = $2',
          [translatedText, segment.id]
        );
      }
    }

    // Translate decisions if requested
    if (translateDecisions) {
      const decisions = await db.query(
        'SELECT id, decision FROM meeting_decisions WHERE meeting_id = $1',
        [req.params.id]
      );

      result.translatedDecisions = [];
      for (const decision of decisions) {
        const translatedDecision = await analyzer.translate(decision.decision, targetLanguage);
        result.translatedDecisions.push({
          id: decision.id,
          originalDecision: decision.decision,
          translatedDecision,
        });
      }
    }

    // Translate action items if requested
    if (translateActionItems) {
      const actionItems = await db.query(
        'SELECT id, task FROM action_items WHERE meeting_id = $1',
        [req.params.id]
      );

      result.translatedActionItems = [];
      for (const item of actionItems) {
        const translatedTask = await analyzer.translate(item.task, targetLanguage);
        result.translatedActionItems.push({
          id: item.id,
          originalTask: item.task,
          translatedTask,
        });
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/share/email', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const { recipients, subject, message } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new AppError(400, 'At least one recipient email is required');
    }

    // Email dispatch handler
    if (!emailService.isConfigured()) {
      throw new AppError(503, 'Email delivery is not configured on this server');
    }

    const [summary, actionItems] = await Promise.all([
      db.queryOne(
        'SELECT summary_text FROM meeting_summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.params.id]
      ),
      db.query(
        'SELECT task, assignee, due_date FROM action_items WHERE meeting_id = $1 ORDER BY created_at ASC',
        [req.params.id]
      ),
    ]);

    const notesBody =
      message && message.trim() ? message : summary?.summary_text || 'Meeting notes are ready for review.';
    const actionLines = actionItems
      .map(
        (item: any) =>
          `- ${item.task}${item.assignee ? ` (${item.assignee})` : ''}${item.due_date ? ` due ${item.due_date}` : ''}`
      )
      .join('\n');
    const actionHtml = actionItems.length
      ? `<h3>Action Items</h3><ul>${actionItems
          .map((item: any) => `<li><strong>${item.task}</strong>${item.assignee ? ` - ${item.assignee}` : ''}${item.due_date ? ` (Due: ${item.due_date})` : ''}</li>`)
          .join('')}</ul>`
      : '';

    await emailService.send({
      to: recipients,
      subject: subject || `Meeting notes: ${meeting.title}`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#111827"><h2>${meeting.title}</h2><p style="color:#6b7280;font-size:14px">${new Date(meeting.created_at || Date.now()).toLocaleString()}</p><p>${notesBody.replace(/\n/g, '<br>')}</p>${actionHtml}</div>`,
      text: `${notesBody}${actionItems.length ? `\n\nAction Items:\n${actionLines}` : ''}`,
    });

    res.json({
      success: true,
      recipients,
      meetingTitle: meeting.title,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/export/html', async (req: AuthRequest, res, next) => {
  try {
    const meeting = await meetingRepo.findById(req.params.id);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const [summary, actionItems, transcript] = await Promise.all([
      db.queryOne('SELECT * FROM meeting_summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]),
      db.query('SELECT * FROM action_items WHERE meeting_id = $1 ORDER BY created_at ASC', [req.params.id]),
      db.query('SELECT * FROM transcripts WHERE meeting_id = $1 ORDER BY start_time ASC', [req.params.id]),
    ]);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${meeting.title} - Meeting Minutes</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    h2 { color: #1f2937; margin-top: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
    .task-item { display: flex; align-items: center; margin-bottom: 8px; }
    .badge { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #e0e7ff; color: #3730a3; margin-left: 8px; }
  </style>
</head>
<body>
  <h1>${meeting.title}</h1>
  <div class="meta">
    <span>Date: ${new Date(meeting.created_at || Date.now()).toLocaleDateString()}</span> |
    <span>Duration: ${Math.round((meeting.duration_seconds || 0) / 60)} minutes</span> |
    <span>Status: ${meeting.status.toUpperCase()}</span>
  </div>

  <h2>Executive Summary</h2>
  <p>${summary?.executive_summary || summary?.summary_text || 'No summary available.'}</p>

  <h2>Key Discussion</h2>
  <p>${summary?.summary_text || 'No discussion notes available.'}</p>

  <h2>Action Items</h2>
  ${actionItems && actionItems.length > 0 ? `
    <ul>
      ${actionItems.map((item: any) => `
        <li>
          <strong>${item.task}</strong>
          ${item.assignee ? ` - Assigned to: ${item.assignee}` : ''}
          ${item.due_date ? ` (Due: ${item.due_date})` : ''}
          <span class="badge">${item.priority.toUpperCase()}</span>
        </li>
      `).join('')}
    </ul>
  ` : '<p>No action items identified.</p>'}

  <h2>Transcript</h2>
  ${transcript && transcript.length > 0 ? `
    <div>
      ${transcript.map((t: any) => `
        <p><strong>${t.speaker || 'Speaker'}:</strong> ${t.text}</p>
      `).join('')}
    </div>
  ` : '<p>No transcript recorded.</p>'}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

export { router as meetingsRouter };

