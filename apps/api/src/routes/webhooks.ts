import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { webhookService, WEBHOOK_EVENTS, WebhookCryptoSigner } from '../services/webhook';
import { validateOutboundUrl } from '../lib/url-guard';
import { Database, Queryable } from '@meeti/database';
import { config } from '../config';

const router = Router();
const db: Queryable = new Database(config.database);
const webhookSigner: WebhookCryptoSigner = webhookService;

router.use(authenticate);

// List webhooks
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const webhooks = await db.query(
      `SELECT id, url, events, active, description, last_triggered_at, failure_count, created_at
       FROM webhooks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(webhooks);
  } catch (error) {
    next(error);
  }
});

// Create webhook
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { url, events, description } = req.body;

    if (!url) throw new AppError(400, 'Webhook URL is required');
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new AppError(400, 'At least one event type is required');
    }

    const invalidEvents = events.filter((e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (invalidEvents.length > 0) {
      throw new AppError(400, `Invalid event types: ${invalidEvents.join(', ')}`);
    }

    const urlError = validateOutboundUrl(url);
    if (urlError) {
      throw new AppError(400, `Invalid webhook URL: ${urlError}`);
    }

    const secret = webhookSigner.generateSecret();
    const webhook = await db.queryOne(
      `INSERT INTO webhooks (user_id, url, secret, events, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, url, events, active, description, created_at`,
      [req.userId, url, secret, events, description ?? null]
    );

    res.status(201).json({ ...webhook, secret });
  } catch (error) {
    next(error);
  }
});

// Update webhook
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { url, events, active, description } = req.body;
    const { id } = req.params;

    const existing = await db.queryOne(
      'SELECT * FROM webhooks WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (!existing) throw new AppError(404, 'Webhook not found');

    if (events) {
      const invalidEvents = events.filter((e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
      if (invalidEvents.length > 0) {
        throw new AppError(400, `Invalid event types: ${invalidEvents.join(', ')}`);
      }
    }

    if (url) {
      const urlError = validateOutboundUrl(url);
      if (urlError) {
        throw new AppError(400, `Invalid webhook URL: ${urlError}`);
      }
    }

    const updated = await db.queryOne(
      `UPDATE webhooks
       SET url = COALESCE($3, url),
           events = COALESCE($4, events),
           active = COALESCE($5, active),
           description = COALESCE($6, description),
           failure_count = CASE WHEN $5 = true THEN 0 ELSE failure_count END,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, url, events, active, description, last_triggered_at, failure_count, created_at`,
      [id, req.userId, url ?? null, events ?? null, active ?? null, description ?? null]
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete webhook
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await db.queryOne(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!result) throw new AppError(404, 'Webhook not found');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get webhook deliveries
router.get('/:id/deliveries', async (req: AuthRequest, res, next) => {
  try {
    const webhook = await db.queryOne(
      'SELECT id FROM webhooks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!webhook) throw new AppError(404, 'Webhook not found');

    const deliveries = await db.query(
      `SELECT id, event_type, response_status, attempt_count, status, delivered_at, created_at
       FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.params.id]
    );

    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});

// Regenerate webhook secret
router.post('/:id/secret', async (req: AuthRequest, res, next) => {
  try {
    const newSecret = webhookService.generateSecret();
    const result = await db.queryOne(
      'UPDATE webhooks SET secret = $3 WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId, newSecret]
    );
    if (!result) throw new AppError(404, 'Webhook not found');
    res.json({ secret: newSecret });
  } catch (error) {
    next(error);
  }
});

// List valid event types
router.get('/events', async (req: AuthRequest, res, next) => {
  try {
    res.json(WEBHOOK_EVENTS);
  } catch (error) {
    next(error);
  }
});

export { router as webhooksRouter };
