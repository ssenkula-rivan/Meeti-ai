import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { Database } from '@meeti/database';
import { config } from '../config';
import { decryptSecret, encryptSecret } from '../lib/crypto';

// --- Narrow ISP interfaces ---

export interface GoogleOAuthStatus {
  getIntegrationStatus(userId: string): Promise<{
    connected: boolean;
    scopes: string[];
    canUseDrive: boolean;
    canUseGmail: boolean;
    canUseCalendar: boolean;
  }>;
  hasRequiredScopes(userId: string, requiredScopes: string[]): Promise<boolean>;
}

export interface GoogleDriveWriter {
  saveToDrive(
    userId: string,
    meetingId: string,
    title: string,
    content: string,
    format?: 'doc' | 'pdf'
  ): Promise<string | null>;
}

export interface GoogleMailSender {
  sendEmail(
    userId: string,
    to: string[],
    subject: string,
    body: string,
    meetingId?: string
  ): Promise<boolean>;
}

export interface GoogleCalendarWriter {
  createCalendarEvent(
    userId: string,
    meetingId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees?: string[]
  ): Promise<string | null>;
  attachNotesToCalendarEvent(
    userId: string,
    meetingId: string,
    calendarEventId: string,
    notes: string
  ): Promise<boolean>;
}

export interface IGoogleIntegrationService
  extends GoogleOAuthStatus,
    GoogleDriveWriter,
    GoogleMailSender,
    GoogleCalendarWriter {}

// --- Implementation ---

export class GoogleIntegrationService implements IGoogleIntegrationService {
  private db: Database;

  constructor() {
    this.db = new Database(config.database);
  }

  private async getOAuthClient(userId: string): Promise<OAuth2Client | null> {
    const oauthAccount = await this.db.queryOne(
      'SELECT * FROM oauth_accounts WHERE user_id = $1 AND provider = $2',
      [userId, 'google']
    );

    if (!oauthAccount) {
      return null;
    }

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    client.setCredentials({
      access_token: decryptSecret(oauthAccount.access_token) as string,
      refresh_token: decryptSecret(oauthAccount.refresh_token) as string,
    });

    // Check if token needs refresh
    if (oauthAccount.expires_at && new Date(oauthAccount.expires_at) < new Date()) {
      try {
        const { credentials } = await client.refreshAccessToken();
        await this.db.query(
          `UPDATE oauth_accounts 
           SET access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3, updated_at = NOW()
           WHERE id = $4`,
          [
            encryptSecret(credentials.access_token) as string,
            encryptSecret(credentials.refresh_token),
            credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            oauthAccount.id,
          ]
        );
      } catch (error) {
        console.error('Failed to refresh Google token:', error);
        return null;
      }
    }

    return client;
  }

  // Google Drive Operations
  async saveToDrive(userId: string, meetingId: string, title: string, content: string, format: 'doc' | 'pdf' = 'doc'): Promise<string | null> {
    const client = await this.getOAuthClient(userId);
    if (!client) {
      throw new Error('Google account not connected');
    }

    const drive = google.drive({ version: 'v3', auth: client as any });

    try {
      // Create file metadata
      const fileMetadata = {
        name: `${title}.${format === 'doc' ? 'docx' : 'pdf'}`,
        mimeType: format === 'doc' 
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
      };

      const media = {
        mimeType: format === 'doc'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
        body: content,
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
      });

      // Store reference in database
      await this.db.query(
        `INSERT INTO exports (meeting_id, user_id, format, storage_path, status)
         VALUES ($1, $2, $3, $4, 'completed')`,
        [meetingId, userId, format, file.data.id]
      );

      return file.data.webViewLink || null;
    } catch (error) {
      console.error('Drive save error:', error);
      throw new Error('Failed to save to Google Drive');
    }
  }

  // Gmail Operations
  async sendEmail(
    userId: string,
    to: string[],
    subject: string,
    body: string,
    meetingId?: string
  ): Promise<boolean> {
    const client = await this.getOAuthClient(userId);
    if (!client) {
      throw new Error('Google account not connected');
    }

    const gmail = google.gmail({ version: 'v1', auth: client as any });

    try {
      // Create email content
      const emailContent = [
        `To: ${to.join(', ')}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\r\n');

      const encodedEmail = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      // Log email send event
      if (meetingId) {
        await this.db.query(
          `INSERT INTO exports (meeting_id, user_id, format, storage_path, status)
           VALUES ($1, $2, 'email', $3, 'completed')`,
          [meetingId, userId, to.join(', ')]
        );
      }

      return true;
    } catch (error) {
      console.error('Gmail send error:', error);
      throw new Error('Failed to send email via Gmail');
    }
  }

  // Google Calendar Operations
  async createCalendarEvent(
    userId: string,
    meetingId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees?: string[]
  ): Promise<string | null> {
    const client = await this.getOAuthClient(userId);
    if (!client) {
      throw new Error('Google account not connected');
    }

    const calendar = google.calendar({ version: 'v3', auth: client as any });

    try {
      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        },
        attendees: attendees?.map(email => ({ email })),
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      // Store calendar event reference
      await this.db.query(
        `INSERT INTO calendar_events (user_id, meeting_id, provider, external_id, title, start_time, end_time, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [userId, meetingId, 'google', response.data.id, title, startTime, endTime]
      );

      return response.data.htmlLink || null;
    } catch (error) {
      console.error('Calendar event error:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  async attachNotesToCalendarEvent(
    userId: string,
    meetingId: string,
    calendarEventId: string,
    notes: string
  ): Promise<boolean> {
    const client = await this.getOAuthClient(userId);
    if (!client) {
      throw new Error('Google account not connected');
    }

    const calendar = google.calendar({ version: 'v3', auth: client as any });

    try {
      // Get existing event
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: calendarEventId,
      });

      // Append notes to description
      const updatedDescription = `${event.data.description || ''}\n\n---\nMeeting Notes:\n${notes}`;

      await calendar.events.update({
        calendarId: 'primary',
        eventId: calendarEventId,
        requestBody: {
          ...event.data,
          description: updatedDescription,
        },
      });

      return true;
    } catch (error) {
      console.error('Calendar attachment error:', error);
      throw new Error('Failed to attach notes to calendar event');
    }
  }

  // Check if user has required Google scopes
  async hasRequiredScopes(userId: string, requiredScopes: string[]): Promise<boolean> {
    const client = await this.getOAuthClient(userId);
    if (!client) {
      return false;
    }

    try {
      const tokenInfo = await client.getTokenInfo(client.credentials.access_token as string);
      const grantedScopes = tokenInfo.scopes || [];
      
      return requiredScopes.every(scope => grantedScopes.includes(scope));
    } catch (error) {
      console.error('Scope check error:', error);
      return false;
    }
  }

  // Get integration status
  async getIntegrationStatus(userId: string): Promise<{
    connected: boolean;
    scopes: string[];
    canUseDrive: boolean;
    canUseGmail: boolean;
    canUseCalendar: boolean;
  }> {
    const client = await this.getOAuthClient(userId);
    if (!client) {
      return {
        connected: false,
        scopes: [],
        canUseDrive: false,
        canUseGmail: false,
        canUseCalendar: false,
      };
    }

    try {
      const tokenInfo = await client.getTokenInfo(client.credentials.access_token as string);
      const scopes = tokenInfo.scopes || [];

      return {
        connected: true,
        scopes,
        canUseDrive: scopes.includes('https://www.googleapis.com/auth/drive.file'),
        canUseGmail: scopes.includes('https://www.googleapis.com/auth/gmail.send'),
        canUseCalendar: scopes.includes('https://www.googleapis.com/auth/calendar.events'),
      };
    } catch (error) {
      console.error('Integration status error:', error);
      return {
        connected: false,
        scopes: [],
        canUseDrive: false,
        canUseGmail: false,
        canUseCalendar: false,
      };
    }
  }
}
