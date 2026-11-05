import axios from 'axios';
import { Database, Queryable } from '@meeti/database';
import { config } from '../config';
import { decryptSecret, encryptSecret } from '../lib/crypto';

const db: Queryable = new Database(config.database);

export interface ZoomIntegration {
  id: string;
  user_id: string;
  zoom_user_id?: string;
  account_id?: string;
  email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ZoomRecordingItem {
  id: string;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  total_size: number;
  recording_count: number;
  download_url?: string;
  file_type?: string;
}

export interface IZoomService {
  getIntegration(userId: string): Promise<ZoomIntegration | null>;
  saveIntegration(userId: string, data: {
    zoomUserId?: string;
    accountId?: string;
    email?: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }): Promise<ZoomIntegration>;
  disconnect(userId: string): Promise<void>;
  getAuthUrl(redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<any>;
  listRecordings(userId: string): Promise<ZoomRecordingItem[]>;
}

export class ZoomService implements IZoomService {
  async getIntegration(userId: string): Promise<ZoomIntegration | null> {
    return db.queryOne<ZoomIntegration>(
      'SELECT * FROM zoom_integrations WHERE user_id = $1 AND active = true',
      [userId]
    );
  }

  async saveIntegration(userId: string, data: {
    zoomUserId?: string;
    accountId?: string;
    email?: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }): Promise<ZoomIntegration> {
    const expiresAt = data.expiresIn
      ? new Date(Date.now() + data.expiresIn * 1000).toISOString()
      : null;

    const existing = await this.getIntegration(userId);
    if (existing) {
      const updated = await db.queryOne<ZoomIntegration>(
        `UPDATE zoom_integrations
         SET zoom_user_id = COALESCE($2, zoom_user_id),
             account_id = COALESCE($3, account_id),
             email = COALESCE($4, email),
             access_token = $5,
             refresh_token = COALESCE($6, refresh_token),
             token_expires_at = COALESCE($7, token_expires_at),
             active = true,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.zoomUserId, data.accountId, data.email, encryptSecret(data.accessToken), encryptSecret(data.refreshToken), expiresAt]
      );
      return updated!;
    }

    const created = await db.queryOne<ZoomIntegration>(
      `INSERT INTO zoom_integrations
       (user_id, zoom_user_id, account_id, email, access_token, refresh_token, token_expires_at, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [userId, data.zoomUserId, data.accountId, data.email, encryptSecret(data.accessToken), encryptSecret(data.refreshToken), expiresAt]
    );
    return created!;
  }

  async disconnect(userId: string): Promise<void> {
    await db.query(
      'UPDATE zoom_integrations SET active = false, access_token = NULL, refresh_token = NULL WHERE user_id = $1',
      [userId]
    );
  }

  getAuthUrl(redirectUri: string): string {
    // No real Zoom app credentials configured -> we cannot start OAuth. Return
    // an empty URL rather than a fake/mock link so the client shows an honest
    // "not configured" message instead of a bogus connection.
    const clientId = process.env.ZOOM_CLIENT_ID;
    if (!clientId) return '';
    return `https://zoom.us/oauth/authorize?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<any> {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Zoom integration is not configured on this server.');
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        },
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  }

  async listRecordings(userId: string): Promise<ZoomRecordingItem[]> {
    const integration = await this.getIntegration(userId);
    if (!integration || !integration.access_token) {
      return [];
    }

    try {
      const response = await axios.get('https://api.zoom.us/v2/users/me/recordings', {
        headers: {
          Authorization: `Bearer ${decryptSecret(integration.access_token)}`,
        },
        params: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      });

      const meetings = response.data?.meetings || [];
      return meetings.map((m: any) => ({
        id: m.id?.toString(),
        uuid: m.uuid,
        topic: m.topic || 'Untitled Zoom Meeting',
        start_time: m.start_time,
        duration: m.duration || 0,
        total_size: m.total_size || 0,
        recording_count: m.recording_count || 1,
        download_url: m.recording_files?.[0]?.download_url,
        file_type: m.recording_files?.[0]?.file_type || 'm4a',
      }));
    } catch (error: any) {
      console.warn('Failed to fetch Zoom recordings:', error?.response?.data || error?.message);
      return [];
    }
  }
}

export const zoomService = new ZoomService();
