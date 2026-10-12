import { Router } from 'express';
import {
  StorageService,
  PresignedUploadSigner,
  AudioChunkUploader,
} from '../services/storage';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  Database,
  Queryable,
  MeetingRepository,
  IMeetingReader,
  IAudioRecordingStore,
} from '@meeti/database';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { queueMeeting } from '../workers/process-meeting';
import { getUsageService } from '../services/usage';
import { recordingConsentRequired, consentMissing } from '../services/consent';
import * as multer from 'multer';

const router = Router();
const storage: PresignedUploadSigner & AudioChunkUploader = new StorageService();
const db: Queryable = new Database(config.database);
const usage = getUsageService(db);
const meetingStore: IMeetingReader & IAudioRecordingStore = new MeetingRepository(db);

// Configure multer for local file uploads
const upload = multer.default({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max
  },
});

router.use(authenticate);

router.post('/meeting/:meetingId/chunk', async (req: AuthRequest, res, next) => {
  try {
    const { meetingId } = req.params;
    const { chunkIndex } = req.body;

    const meeting = await meetingStore.findById(meetingId);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    const { url, key } = await storage.getSignedUploadUrl(
      req.userId!,
      meetingId,
      `chunk-${chunkIndex}.webm`
    );

    // If using local storage, client should upload directly to a different endpoint
    res.json({ uploadUrl: url, storageKey: key, useLocal: url.startsWith('local://') });
  } catch (error) {
    next(error);
  }
});

router.post('/meeting/:meetingId/chunk/complete', async (req: AuthRequest, res, next) => {
  try {
    const { meetingId } = req.params;
    const { chunkIndex, storageKey } = req.body;

    const meeting = await meetingStore.findById(meetingId);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    // Get or create recording
    let recording = await db.queryOne<any>(
      'SELECT * FROM recordings WHERE meeting_id = $1',
      [meetingId]
    );

    if (!recording) {
      recording = await meetingStore.createRecording(meetingId, storageKey);
    }

    await meetingStore.createAudioChunk(recording.id, chunkIndex, storageKey);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Direct file upload endpoint for local storage
router.post('/meeting/:meetingId/chunk/direct', (req: any, res: any, next: any) => {
  upload.single('audio')(req, res, (err: any) => {
    if (err) return next(err);
    // Continue with the handler
    handleDirectUpload(req, res, next);
  });
});

async function handleDirectUpload(req: AuthRequest, res: any, next: any) {
  try {
    const { meetingId } = req.params;
    const { chunkIndex } = req.body;

    const meeting = await meetingStore.findById(meetingId);
    if (!meeting) {
      throw new AppError(404, 'Meeting not found');
    }
    if (meeting.user_id !== req.userId) {
      throw new AppError(403, 'Access denied');
    }

    if (consentMissing(meeting, recordingConsentRequired())) {
      throw new AppError(403, 'Recording consent is required before uploading audio');
    }

    if (!req.file) {
      throw new AppError(400, 'No file uploaded');
    }

    const key = await storage.uploadAudioChunk(
      req.userId!,
      meetingId,
      parseInt(chunkIndex),
      require('fs').readFileSync(req.file.path)
    );

    // Clean up temp file
    require('fs').unlinkSync(req.file.path);

    // Get or create recording
    let recording = await db.queryOne<any>(
      'SELECT * FROM recordings WHERE meeting_id = $1',
      [meetingId]
    );

    if (!recording) {
      recording = await meetingStore.createRecording(meetingId, key);
    }

    await meetingStore.createAudioChunk(recording.id, parseInt(chunkIndex), key);

    // Persist the user's chosen spoken language so the worker can transcribe
    // with it instead of relying on automatic detection.
    const language = (req.body.language || '').trim();
    if (language && language !== 'auto') {
      await db.query('UPDATE meetings SET source_language = $1 WHERE id = $2', [language, meetingId]);
    }

    res.json({ success: true, storageKey: key });
  } catch (error) {
    next(error);
  }
}

// Single complete audio file upload - stores file, saves recording, triggers processing queue
router.post('/meeting/:meetingId/upload', (req: any, res: any, next: any) => {
  upload.single('audio')(req, res, (err: any) => {
    if (err) return next(err);
    handleFullUpload(req, res, next);
  });
});

async function handleFullUpload(req: AuthRequest, res: any, next: any) {
  const fs = require('fs');
  try {
    const { meetingId } = req.params;

    const meeting = await meetingStore.findById(meetingId);
    if (!meeting) throw new AppError(404, 'Meeting not found');
    if (meeting.user_id !== req.userId) throw new AppError(403, 'Access denied');

    if (consentMissing(meeting, recordingConsentRequired())) {
      throw new AppError(403, 'Recording consent is required before uploading audio');
    }

    if (!req.file) throw new AppError(400, 'No audio file provided');

    const key = await storage.uploadAudioChunk(
      req.userId!,
      meetingId,
      0,
      fs.readFileSync(req.file.path)
    );

    // Clean temp file
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    // Upsert recording record
    let recording = await db.queryOne<any>(
      'SELECT * FROM recordings WHERE meeting_id = $1',
      [meetingId]
    );
    if (!recording) {
      recording = await meetingStore.createRecording(meetingId, key);
    } else {
      await db.query(
        'UPDATE recordings SET storage_path = $1, uploaded_at = NOW() WHERE id = $2',
        [key, recording.id]
      );
    }

    await meetingStore.createAudioChunk(recording.id, 0, key);

    // Save the chosen spoken language before queueing.
    const language = (req.body.language || '').trim();
    if (language && language !== 'auto') {
      await db.query('UPDATE meetings SET source_language = $1 WHERE id = $2', [language, meetingId]);
    }

    // Gate AI spend before queueing.
    await usage.assertCanProcessRecording(req.userId!, 0);

    // Queue for processing
    await queueMeeting(meetingId);

    res.json({ success: true, storageKey: key });
  } catch (error) {
    next(error);
  }
}

export { router as uploadRouter };
