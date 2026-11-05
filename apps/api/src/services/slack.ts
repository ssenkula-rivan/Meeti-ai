import axios from 'axios';
import { Database } from '@meeti/database';
import { config } from '../config';
import { decryptSecret, encryptSecret } from '../lib/crypto';
import {
  retryAsync,
  CircuitBreaker,
  CircuitOpenError,
  isRetryableHttpStatus,
} from '../lib/resilience';

const db = new Database(config.database);

// Slack is an unreliable third-party dependency, and these were the only
// outbound API calls still made without a timeout. Every call now carries a
// bounded timeout, and the idempotent channel-directory read retries transient
// failures with backoff behind a circuit breaker, so a persistently down Slack
// fails fast (graceful degradation) instead of stacking hung requests. Message
// sends are NOT retried: chat.postMessage is not idempotent, so a blind retry
// risks duplicate notifications.
const SLACK_TIMEOUT_MS = 8000;
const slackBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  isFailure: (err: unknown) => {
    const status = (err as any)?.response?.status;
    // Explicit HTTP status: only 429/5xx are dependency failures.
    if (typeof status === 'number') return status === 429 || status >= 500;
    // No HTTP response: count it only if axios actually sent a request (a real
    // network error / timeout), not our thrown ok:false or a client-side fault.
    return Boolean((err as any)?.request);
  },
});

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  channel: string;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
  accessory?: { type: string; text: { type: string; text: string }; url: string };
}

export interface MeetingSummaryPayload {
  meetingId: string;
  title: string;
  duration: number;
  summary?: string;
  actionItems?: Array<{ task: string; assignee?: string; due_date?: string }>;
  meetingUrl?: string;
}

export interface SlackIntegrationData {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId?: string;
  webhookUrl?: string;
  defaultChannelId?: string;
  defaultChannelName?: string;
}

export interface SlackNotificationSettings {
  notifyOnComplete?: boolean;
  notifyOnActionItems?: boolean;
  defaultChannelId?: string;
  defaultChannelName?: string;
}

export interface SlackMeetingNotifier {
  getIntegration(userId: string): Promise<any>;
  sendMeetingNotes(userId: string, payload: MeetingSummaryPayload, channelId?: string): Promise<any>;
}

export interface SlackReminderNotifier {
  getIntegration(userId: string): Promise<any>;
  sendActionItemReminder(
    userId: string,
    items: Array<{ task: string; assignee?: string; due_date?: string; meeting_title?: string }>,
    channelId?: string
  ): Promise<void>;
}

export interface SlackChannelDirectory {
  listChannels(userId: string): Promise<Array<{ id: string; name: string; isPrivate: boolean; memberCount?: number }>>;
}

export interface SlackIntegrationManager {
  getIntegration(userId: string): Promise<any>;
  saveIntegration(userId: string, data: SlackIntegrationData): Promise<any>;
  disconnect(userId: string): Promise<void>;
  updateNotificationSettings(userId: string, settings: SlackNotificationSettings): Promise<any>;
}

export interface ISlackService
  extends SlackMeetingNotifier,
    SlackReminderNotifier,
    SlackChannelDirectory,
    SlackIntegrationManager {}

export class SlackService implements ISlackService {
  async getIntegration(userId: string) {
    return db.queryOne(
      'SELECT * FROM slack_integrations WHERE user_id = $1 AND active = true',
      [userId]
    );
  }

  async saveIntegration(userId: string, data: {
    teamId: string;
    teamName: string;
    botToken: string;
    botUserId?: string;
    webhookUrl?: string;
    defaultChannelId?: string;
    defaultChannelName?: string;
  }) {
    const existing = await this.getIntegration(userId);
    if (existing) {
      return db.queryOne(
        `UPDATE slack_integrations
         SET team_id = $2, team_name = $3, bot_token = $4, bot_user_id = $5,
             webhook_url = $6, default_channel_id = $7, default_channel_name = $8,
             active = true, updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.teamId, data.teamName, encryptSecret(data.botToken), data.botUserId,
         data.webhookUrl, data.defaultChannelId, data.defaultChannelName]
      );
    }
    return db.queryOne(
      `INSERT INTO slack_integrations
       (user_id, team_id, team_name, bot_token, bot_user_id, webhook_url,
        default_channel_id, default_channel_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, data.teamId, data.teamName, encryptSecret(data.botToken), data.botUserId,
       data.webhookUrl, data.defaultChannelId, data.defaultChannelName]
    );
  }

  async disconnect(userId: string) {
    await db.query(
      'UPDATE slack_integrations SET active = false WHERE user_id = $1',
      [userId]
    );
  }

  async listChannels(userId: string) {
    const integration = await this.getIntegration(userId);
    if (!integration) throw new Error('Slack not connected');

    const response = await retryAsync(
      () =>
        slackBreaker.execute(() =>
          axios.get('https://slack.com/api/conversations.list', {
            headers: { Authorization: `Bearer ${decryptSecret(integration.bot_token)}` },
            params: { types: 'public_channel,private_channel', limit: 200 },
            timeout: SLACK_TIMEOUT_MS,
          })
        ),
      {
        attempts: 3,
        // Never retry while the breaker is open (that just burns backoff); only
        // retry genuine transient statuses (network / 429 / 5xx).
        retryOn: (err) =>
          !(err instanceof CircuitOpenError) &&
          isRetryableHttpStatus((err as any)?.response?.status),
      }
    );

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return response.data.channels.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private,
      memberCount: ch.num_members,
    }));
  }

  async sendMeetingNotes(userId: string, payload: MeetingSummaryPayload, channelId?: string) {
    const integration = await this.getIntegration(userId);
    if (!integration) throw new Error('Slack not connected');

    const targetChannel = channelId || integration.default_channel_id;
    if (!targetChannel) throw new Error('No Slack channel configured');

    const durationMin = Math.round(payload.duration / 60);

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Meeting Notes: ${payload.title}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Duration:*\n${durationMin} minutes` },
          { type: 'mrkdwn', text: `*Status:*\nCompleted` },
        ],
      },
    ];

    if (payload.summary) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Summary:*\n${payload.summary}` },
      });
    }

    if (payload.actionItems && payload.actionItems.length > 0) {
      const itemText = payload.actionItems
        .slice(0, 5)
        .map((item) => {
          let line = `- ${item.task}`;
          if (item.assignee) line += ` _(${item.assignee})_`;
          if (item.due_date) line += ` - Due: ${item.due_date}`;
          return line;
        })
        .join('\n');

      const suffix = payload.actionItems.length > 5
        ? `\n_...and ${payload.actionItems.length - 5} more_`
        : '';

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Action Items:*\n${itemText}${suffix}` },
      });
    }

    if (payload.meetingUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Meeting Notes' },
            url: payload.meetingUrl,
          } as any,
        ],
      });
    }

    const message: SlackMessage = {
      channel: targetChannel,
      text: `Meeting completed: ${payload.title}`,
      blocks,
    };

    const response = await axios.post('https://slack.com/api/chat.postMessage', message, {
      headers: { Authorization: `Bearer ${decryptSecret(integration.bot_token)}`, 'Content-Type': 'application/json' },
      timeout: SLACK_TIMEOUT_MS,
    });

    if (!response.data.ok) {
      throw new Error(`Slack send error: ${response.data.error}`);
    }

    return response.data;
  }

  async sendActionItemReminder(userId: string, items: Array<{ task: string; assignee?: string; due_date?: string; meeting_title?: string }>, channelId?: string) {
    const integration = await this.getIntegration(userId);
    if (!integration) return;

    const targetChannel = channelId || integration.default_channel_id;
    if (!targetChannel) return;

    const itemText = items
      .map((item) => {
        let line = `- ${item.task}`;
        if (item.assignee) line += ` _(${item.assignee})_`;
        if (item.due_date) line += ` - Due: ${item.due_date}`;
        if (item.meeting_title) line += ` [${item.meeting_title}]`;
        return line;
      })
      .join('\n');

    await axios.post('https://slack.com/api/chat.postMessage', {
      channel: targetChannel,
      text: 'Action item reminder',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Pending Action Items (${items.length}):*\n${itemText}` },
        },
      ],
    }, {
      headers: { Authorization: `Bearer ${decryptSecret(integration.bot_token)}`, 'Content-Type': 'application/json' },
      timeout: SLACK_TIMEOUT_MS,
    });
  }

  async updateNotificationSettings(userId: string, settings: {
    notifyOnComplete?: boolean;
    notifyOnActionItems?: boolean;
    defaultChannelId?: string;
    defaultChannelName?: string;
  }) {
    return db.queryOne(
      `UPDATE slack_integrations
       SET notify_on_complete = COALESCE($2, notify_on_complete),
           notify_on_action_items = COALESCE($3, notify_on_action_items),
           default_channel_id = COALESCE($4, default_channel_id),
           default_channel_name = COALESCE($5, default_channel_name),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, settings.notifyOnComplete, settings.notifyOnActionItems,
       settings.defaultChannelId, settings.defaultChannelName]
    );
  }
}

export const slackService = new SlackService();
