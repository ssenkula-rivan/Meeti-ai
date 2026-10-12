import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
}

export interface Profile {
  user_id: string;
  full_name?: string;
  profile_photo_url?: string;
  country?: string;
  timezone?: string;
  preferred_language: string;
  output_language: string;
  date_format: string;
  time_format: string;
  use_case?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UserProfileResponse {
  user: User;
  profile: Profile;
}

export interface Meeting {
  id: string;
  user_id?: string;
  title: string;
  meeting_type?: string;
  status: 'draft' | 'recording' | 'processing' | 'completed' | 'failed' | 'archived';
  recording_quality?: string;
  detected_languages?: string[];
  output_language?: string;
  duration_seconds?: number;
  audio_url?: string;
  started_at?: string;
  ended_at?: string;
  metadata?: { platform?: string; meeting_link?: string | null };
  created_at: string;
  updated_at?: string;
}


export interface ActionItem {
  id: string;
  meeting_id: string;
  meeting_title?: string;
  task: string;
  assignee?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  priority: string;
  confidence?: string;
  created_at?: string;
}

export interface MeetingSummary {
  id?: string;
  meeting_id?: string;
  summary?: string;
  executive_summary?: string;
  created_at?: string;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  decision: string;
  source_timestamp?: number;
  confidence?: string;
  created_at?: string;
}

export interface TranscriptSegment {
  id: string;
  transcript_id?: string;
  segment_index: number;
  speaker_id?: string;
  speaker_name?: string;
  speaker_label?: string;
  start_time: number;
  end_time: number;
  text: string;
  language?: string;
  translated_text?: string;
  confidence?: number;
}

export interface Speaker {
  id: string;
  meeting_id: string;
  speaker_label: string;
  display_name?: string;
}

export const authApi = {
  register: (email: string, password: string, fullName?: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, fullName }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  getProfile: () => api.get<UserProfileResponse>('/auth/me'),

  updateProfile: (data: Partial<Profile>) => {
    const apiData: any = {};
    if (data.full_name !== undefined) apiData.full_name = data.full_name;
    if (data.country !== undefined) apiData.country = data.country;
    if (data.timezone !== undefined) apiData.timezone = data.timezone;
    if (data.preferred_language !== undefined) apiData.preferred_language = data.preferred_language;
    if (data.output_language !== undefined) apiData.output_language = data.output_language;
    if (data.date_format !== undefined) apiData.date_format = data.date_format;
    if (data.time_format !== undefined) apiData.time_format = data.time_format;
    if (data.use_case !== undefined) apiData.use_case = data.use_case;
    return api.patch<{ profile: Profile }>('/auth/profile', apiData);
  },

  logout: () => api.post('/auth/logout'),

  deleteAccount: (password: string) =>
    api.delete<{ success: boolean; message: string }>('/auth/account', { data: { password } }),
};

export const oauthApi = {
  getGoogleAuthUrl: () => api.get<{ authUrl: string; state: string }>('/oauth/google/url'),

  getGoogleUrl: (scopes: 'basic' | 'full' = 'basic') =>
    api.get<{ authUrl: string; state: string }>('/oauth/google/url', { params: { scopes } }),

  handleGoogleCallback: (code: string) =>
    api.post<{ user: User; token: string; isNewUser: boolean }>('/oauth/google/callback', { code }),

  connectGoogle: (code: string) =>
    api.post<{ success: boolean }>('/oauth/google/connect', { code }),

  disconnectGoogle: () => api.delete('/oauth/google'),

  getConnectedAccounts: () => api.get<{ accounts: any[] }>('/oauth/accounts'),
};

export const meetingsApi = {
  create: (data: {
    title: string;
    meetingType?: string;
    sourceLanguage?: string;
    outputLanguage?: string;
    platform?: string;
    meetingLink?: string;
  }) => api.post<Meeting>('/meetings', data),

  list: () => api.get<Meeting[]>('/meetings'),

  search: (query: string) =>
    api.get<Meeting[]>('/meetings/search', { params: { q: query } }),

  get: (id: string) => api.get<Meeting>(`/meetings/${id}`),

  update: (id: string, data: Partial<Meeting>) =>
    api.patch<Meeting>(`/meetings/${id}`, data),

  start: (id: string) => api.post(`/meetings/${id}/start`),

  stop: (id: string) => api.post(`/meetings/${id}/stop`),

  confirmConsent: (id: string) => api.post(`/meetings/${id}/consent`),

  process: (id: string) => api.post(`/meetings/${id}/process`),

  uploadAudio: (id: string, file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('audio', file, file.name);
    formData.append('chunkIndex', '0');
    return api.post(`/upload/meeting/${id}/chunk/direct`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
  },

  delete: (id: string) => api.delete(`/meetings/${id}`),

  getSummary: (id: string) =>
    api.get<MeetingSummary>(`/meetings/${id}/summary`),

  getDecisions: (id: string) =>
    api.get<MeetingDecision[]>(`/meetings/${id}/decisions`),

  getRisks: (id: string) =>
    api.get<any[]>(`/meetings/${id}/risks`),

  getFollowUps: (id: string) =>
    api.get<any[]>(`/meetings/${id}/followups`),

  translate: (id: string, targetLanguage: string, options?: { translateSegments?: boolean; translateDecisions?: boolean; translateActionItems?: boolean }) =>
    api.post<{
      targetLanguage: string;
      originalSummary?: string;
      translatedSummary?: string;
      translatedExecutiveSummary?: string;
      translatedSegments?: Array<{ id: string; originalText: string; translatedText: string }>;
      translatedDecisions?: Array<{ id: string; originalDecision: string; translatedDecision: string }>;
      translatedActionItems?: Array<{ id: string; originalTask: string; translatedTask: string }>;
    }>(`/meetings/${id}/translate`, { targetLanguage, ...options }),

  shareEmail: (id: string, data: { recipients: string[]; subject?: string; message?: string }) =>
    api.post<{ success: boolean; recipients: string[]; meetingTitle: string; sentAt: string }>(
      `/meetings/${id}/share/email`,
      data
    ),
};


export const transcriptsApi = {
  getSegments: (meetingId: string) =>
    api.get<TranscriptSegment[]>(`/transcripts/meeting/${meetingId}/segments`),

  getSpeakers: (meetingId: string) =>
    api.get<Speaker[]>(`/transcripts/meeting/${meetingId}/speakers`),

  updateSpeaker: (speakerId: string, displayName: string) =>
    api.patch(`/transcripts/speakers/${speakerId}`, { displayName }),
};

export const organizationsApi = {
  list: () =>
    api.get<any[]>('/organizations'),

  create: (data: { name: string; slug: string }) =>
    api.post<any>('/organizations', data),

  get: (id: string) =>
    api.get<any>(`/organizations/${id}`),

  addMember: (id: string, data: { userId: string; role?: string }) =>
    api.post<any>(`/organizations/${id}/members`, data),

  removeMember: (id: string, userId: string) =>
    api.delete<any>(`/organizations/${id}/members/${userId}`),

  updateMemberRole: (id: string, userId: string, role: string) =>
    api.patch<any>(`/organizations/${id}/members/${userId}/role`, { role }),

  updateSettings: (id: string, settings: any) =>
    api.patch<any>(`/organizations/${id}`, { settings }),

  delete: (id: string) =>
    api.delete<any>(`/organizations/${id}`),
};

export interface UsageSummary {
  plan: { slug: string; name: string; priceMonthly: number; source: string };
  limits: {
    transcriptionMinutes: number;
    exports: number;
    meetings: number;
    storageGB: number;
    manualNotes: string;
    templates: string;
  };
  transcriptionMinutes: { limit: number; used: number; remaining: number };
  exports: { limit: number; used: number; remaining: number };
}

export const billingApi = {
  getPlans: () =>
    api.get<any[]>('/billing/plans'),

  getSubscription: () =>
    api.get<any>('/billing/subscription'),

  // Remaining allowance, computed server-side.
  getUsageSummary: () =>
    api.get<UsageSummary>('/billing/usage-summary'),

  // Upgrade entrypoint; returns 501 until payments are configured.
  startCheckout: (planId: string) =>
    api.post<any>('/billing/checkout', { planId }),

  cancelSubscription: () =>
    api.post<any>('/billing/subscription/cancel'),

  getUsage: (params?: { startDate?: string; endDate?: string }) =>
    api.get<any[]>('/billing/usage', { params }),
};

export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  tier: 'basic' | 'advanced';
  agenda: string;
  objectives: string;
  content: string;
}

export interface ManualNote {
  id: string;
  title: string;
  meeting_type?: string;
  status: string;
  content?: string | null;
  agenda?: string | null;
  objectives?: string | null;
  meeting_date?: string | null;
  created_at: string;
  updated_at: string;
  manual_summary?: { summary: string; executive_summary?: string; source?: string } | null;
  participants?: Array<{ id: string; name: string; email?: string; role?: string }>;
}

export interface StructuredMinutes {
  executiveSummary: string;
  summary: string;
  discussion: string[];
  decisions: string[];
  actionItems: Array<{ task: string; assignee?: string; dueDate?: string }>;
  risks: string[];
  followUps: string[];
  questions: string[];
  markdown: string;
}

export const notesApi = {
  templates: () => api.get<MeetingTemplate[]>('/notes/templates'),

  list: () => api.get<ManualNote[]>('/notes'),

  get: (id: string) => api.get<ManualNote>(`/notes/${id}`),

  create: (data: {
    title: string;
    meetingType?: string;
    outputLanguage?: string;
    templateId?: string;
    agenda?: string;
    objectives?: string;
    content?: string;
    meetingDate?: string;
    participants?: Array<{ name: string; email?: string }>;
  }) => api.post<ManualNote>('/notes', data),

  update: (id: string, data: Partial<{
    title: string;
    meetingType: string;
    agenda: string | null;
    objectives: string | null;
    content: string | null;
    meetingDate: string | null;
  }>) => api.patch<ManualNote>(`/notes/${id}`, data),

  remove: (id: string) => api.delete(`/notes/${id}`),

  addParticipant: (id: string, data: { name: string; email?: string }) =>
    api.post<{ id: string; name: string; email?: string }>(`/notes/${id}/participants`, data),

  removeParticipant: (id: string, participantId: string) =>
    api.delete(`/notes/${id}/participants/${participantId}`),

  // Deterministic formatting (no model).
  format: (id: string) =>
    api.post<{ source: 'template'; structured: StructuredMinutes }>(`/notes/${id}/format`),

  // Markdown download URL (fetch attaches the auth token).
  exportMarkdownUrl: (id: string) => `${api.defaults.baseURL}/notes/${id}/export/markdown`,

  downloadMarkdown: (id: string) =>
    api.get<Blob>(`/notes/${id}/export/markdown`, { responseType: 'blob' }),
};

export const actionItemsApi = {
  getByMeeting: (meetingId: string) =>
    api.get<ActionItem[]>(`/meetings/${meetingId}/action-items`),

  getUserItems: (status?: string) =>
    api.get<ActionItem[]>('/action-items/user', { params: { status } }),

  create: (data: { meetingId: string; task: string; assignee?: string; dueDate?: string; priority?: string }) =>
    api.post<ActionItem>('/action-items', data),

  update: (id: string, data: Partial<{ task: string; assignee: string; dueDate: string | null; priority: string; status: string }>) =>
    api.patch<ActionItem>(`/action-items/${id}`, data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/action-items/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete(`/action-items/${id}`),
};

export const integrationsApi = {
  getGoogleStatus: () =>
    api.get<{
      connected: boolean;
      scopes: string[];
      canUseDrive: boolean;
      canUseGmail: boolean;
      canUseCalendar: boolean;
    }>('/integrations/google/status'),

  saveToDrive: (meetingId: string, format: 'doc' | 'pdf' = 'doc') =>
    api.post<{ success: boolean; webViewLink?: string }>('/integrations/google/drive/save', { meetingId, format }),

  sendGmail: (meetingId: string, recipients: string[], subject?: string, message?: string) =>
    api.post<{ success: boolean; recipients: string[] }>('/integrations/google/gmail/send', {
      meetingId,
      recipients,
      subject,
      message,
    }),

  createCalendarEvent: (
    meetingId: string,
    title: string,
    description: string,
    startTime: string,
    endTime: string,
    attendees?: string[]
  ) =>
    api.post<{ success: boolean; htmlLink?: string }>('/integrations/google/calendar/create', {
      meetingId,
      title,
      description,
      startTime,
      endTime,
      attendees,
    }),

  attachToCalendar: (meetingId: string, calendarEventId: string) =>
    api.post<{ success: boolean }>('/integrations/google/calendar/attach', {
      meetingId,
      calendarEventId,
    }),
};

export const exportsApi = {
  downloadPDF: (meetingId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    return `${apiUrl}/exports/meeting/${meetingId}/pdf`;
  },

  downloadDOCX: (meetingId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    return `${apiUrl}/exports/meeting/${meetingId}/docx`;
  },
};

export const slackApi = {
  getStatus: () =>
    api.get<{
      connected: boolean;
      teamName?: string;
      teamId?: string;
      defaultChannelId?: string;
      defaultChannelName?: string;
      notifyOnComplete?: boolean;
      notifyOnActionItems?: boolean;
    }>('/slack/status'),

  connect: (code: string, redirectUri: string) =>
    api.post<{ success: boolean; teamName: string }>('/slack/connect', { code, redirectUri }),

  disconnect: () =>
    api.delete<{ success: boolean }>('/slack/disconnect'),

  listChannels: () =>
    api.get<Array<{ id: string; name: string; isPrivate: boolean; memberCount?: number }>>('/slack/channels'),

  sendMeetingNotes: (meetingId: string, channelId?: string) =>
    api.post<{ success: boolean }>('/slack/share/' + meetingId, { channelId }),

  sendReminders: (channelId?: string) =>
    api.post<{ success: boolean; count: number }>('/slack/remind', { channelId }),

  updateSettings: (settings: {
    notifyOnComplete?: boolean;
    notifyOnActionItems?: boolean;
    defaultChannelId?: string;
    defaultChannelName?: string;
  }) => api.post('/slack/settings', settings),
};

export const zoomApi = {
  getStatus: () =>
    api.get<{ connected: boolean; email?: string; accountId?: string }>('/zoom/status'),

  getAuthUrl: (redirectUri?: string) =>
    api.get<{ url: string }>('/zoom/auth-url', { params: { redirectUri } }),

  connect: (code: string, redirectUri?: string) =>
    api.post<{ success: boolean; email?: string }>('/zoom/connect', { code, redirectUri }),

  disconnect: () =>
    api.delete<{ success: boolean }>('/zoom/disconnect'),

  listRecordings: () =>
    api.get<Array<{
      id: string;
      uuid: string;
      topic: string;
      start_time: string;
      duration: number;
      total_size: number;
      recording_count: number;
      download_url?: string;
      file_type?: string;
    }>>('/zoom/recordings'),

  importRecording: (data: { recordingId?: string; topic: string; duration?: number; downloadUrl?: string }) =>
    api.post<{ success: boolean; meetingId: string; title: string }>('/zoom/import', data),
};

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at?: string;
  created_at: string;
  active: boolean;
  apiKey?: string;
}

export const apiKeysApi = {
  list: () => api.get<ApiKeyItem[]>('/api-keys'),
  create: (name: string, scopes: string[] = ['read', 'write']) =>
    api.post<ApiKeyItem & { apiKey: string }>('/api-keys', { name, scopes }),
  revoke: (id: string) => api.delete<{ success: boolean }>('/api-keys/' + id),
};

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  description?: string;
  active: boolean;
  failure_count: number;
  last_triggered_at?: string;
  created_at: string;
  secret?: string;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  payload: any;
  response_status?: number;
  response_body?: string;
  attempt_count: number;
  delivered_at?: string;
  status: string;
  created_at: string;
}

export const webhooksApi = {
  list: () => api.get<WebhookItem[]>('/webhooks'),
  create: (url: string, events: string[] = ['meeting.completed'], description?: string) =>
    api.post<WebhookItem>('/webhooks', { url, events, description }),
  delete: (id: string) => api.delete<{ success: boolean }>('/webhooks/' + id),
  test: (id: string) => api.post<{ success: boolean; status?: number; error?: string }>('/webhooks/' + id + '/test'),
  getDeliveries: (id: string) => api.get<WebhookDelivery[]>('/webhooks/' + id + '/deliveries'),
};

export interface FolderItem {
  id: string;
  name: string;
  color?: string;
  meeting_count?: number;
  created_at: string;
}

export const foldersApi = {
  list: () => api.get<FolderItem[]>('/folders'),
  create: (name: string, color?: string, organizationId?: string) =>
    api.post<FolderItem>('/folders', { name, color, organizationId }),
  delete: (id: string) => api.delete<{ success: boolean }>('/folders/' + id),
  addMeeting: (folderId: string, meetingId: string) =>
    api.post<{ success: boolean }>(`/folders/${folderId}/meetings`, { meetingId }),
  removeMeeting: (folderId: string, meetingId: string) =>
    api.delete<{ success: boolean }>(`/folders/${folderId}/meetings/${meetingId}`),
};

export interface TagItem {
  id: string;
  name: string;
  color?: string;
  meeting_count?: number;
}

export const tagsApi = {
  list: () => api.get<TagItem[]>('/tags'),
  create: (name: string, color?: string) =>
    api.post<TagItem>('/tags', { name, color }),
  delete: (id: string) => api.delete<{ success: boolean }>('/tags/' + id),
  addMeeting: (tagId: string, meetingId: string) =>
    api.post<{ success: boolean }>(`/tags/${tagId}/meetings`, { meetingId }),
  removeMeeting: (tagId: string, meetingId: string) =>
    api.delete<{ success: boolean }>(`/tags/${tagId}/meetings/${meetingId}`),
};

export default api;

