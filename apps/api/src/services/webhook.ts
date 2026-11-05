import crypto from 'crypto';
import axios from 'axios';
import { Database } from '@meeti/database';
import { config } from '../config';
import { validateOutboundUrl } from '../lib/url-guard';

const db = new Database(config.database);

export const WEBHOOK_EVENTS = [
  'meeting.created',
  'meeting.completed',
  'meeting.deleted',
  'transcript.ready',
  'summary.ready',
  'action_item.created',
  'action_item.updated',
  'export.completed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  created_at: string;
  data: Record<string, unknown>;
}

export interface WebhookDispatcher {
  dispatchEvent(userId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void>;
}

export interface WebhookCryptoSigner {
  generateSecret(): string;
  signPayload(secret: string, payload: string): string;
}

export interface WebhookRetryProcessor {
  retryFailedDeliveries(): Promise<void>;
}

export interface IWebhookService
  extends WebhookDispatcher,
    WebhookCryptoSigner,
    WebhookRetryProcessor {}

export class WebhookService implements IWebhookService {
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  signPayload(secret: string, payload: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async dispatchEvent(userId: string, event: WebhookEvent, data: Record<string, unknown>) {
    const webhooks = await db.query(
      `SELECT * FROM webhooks WHERE user_id = $1 AND active = true AND $2 = ANY(events)`,
      [userId, event]
    );

    for (const webhook of webhooks) {
      const payload: WebhookPayload = {
        id: crypto.randomUUID(),
        event,
        created_at: new Date().toISOString(),
        data,
      };

      await this.deliver(webhook, payload);
    }
  }

  private async deliver(webhook: any, payload: WebhookPayload, attempt = 1) {
    const body = JSON.stringify(payload); // serialize once for sign + send
    const signature = this.signPayload(webhook.secret, body);

    let deliveryId: string | undefined;
    try {
      // SSRF defense-in-depth: never issue an outbound request to an
      // internal/reserved address, even for legacy rows or webhooks mutated
      // directly in the database. Blocked deliveries accrue failure_count and
      // are auto-disabled by the existing backoff logic (no request is made).
      const urlError = validateOutboundUrl(webhook.url);
      if (urlError) {
        console.warn(`[webhook] blocked delivery to ${webhook.url} (webhook ${webhook.id}): ${urlError}`);
        throw new Error(`SSRF blocked: ${urlError}`);
      }

      const delivery = await db.queryOne(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, attempt_count, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id`,
        [webhook.id, payload.event, payload, attempt]
      );
      deliveryId = delivery?.id;

      const response = await axios.post(webhook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-MeetingAI-Signature': signature,
          'X-MeetingAI-Event': payload.event,
          'X-MeetingAI-Delivery': payload.id,
        },
        timeout: 10000,
      });

      await db.query(
        `UPDATE webhook_deliveries
         SET status = 'delivered', response_status = $2, response_body = $3, delivered_at = NOW()
         WHERE id = $1`,
        [deliveryId, response.status, response.data ? JSON.stringify(response.data).substring(0, 500) : null]
      );

      await db.query(
        `UPDATE webhooks SET last_triggered_at = NOW(), failure_count = 0 WHERE id = $1`,
        [webhook.id]
      );
    } catch (err: any) {
      const status = err.response?.status ?? 0;
      const responseBody = err.response?.data ? JSON.stringify(err.response.data).substring(0, 500) : err.message;

      if (deliveryId) {
        const nextRetry = attempt < 5
          ? new Date(Date.now() + Math.pow(2, attempt) * 60 * 1000)
          : null;

        await db.query(
          `UPDATE webhook_deliveries
           SET status = $2, response_status = $3, response_body = $4, next_retry_at = $5
           WHERE id = $1`,
          [deliveryId, nextRetry ? 'retrying' : 'failed', status, responseBody, nextRetry]
        );
      }

      await db.query(
        `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
        [webhook.id]
      );

      if (attempt >= 5) {
        await db.query(
          `UPDATE webhooks SET active = false WHERE id = $1 AND failure_count >= 10`,
          [webhook.id]
        );
      }
    }
  }

  async retryFailedDeliveries() {
    const pending = await db.query(
      `SELECT wd.*, w.url, w.secret
       FROM webhook_deliveries wd
       JOIN webhooks w ON wd.webhook_id = w.id
       WHERE wd.status = 'retrying'
         AND wd.next_retry_at <= NOW()
         AND w.active = true
       LIMIT 50`
    );

    for (const delivery of pending) {
      const payload: WebhookPayload = delivery.payload;
      await this.deliver(
        { id: delivery.webhook_id, url: delivery.url, secret: delivery.secret },
        payload,
        delivery.attempt_count + 1
      );
    }
  }
}

export const webhookService = new WebhookService();
