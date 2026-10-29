import axios, { AxiosError } from 'axios';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const getDynamicApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/+$/, '');
    if (envUrl) return envUrl;
  }

  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraApiUrl && typeof extraApiUrl === 'string' && extraApiUrl.trim() !== '') {
    return extraApiUrl.trim().replace(/\/+$/, '');
  }

  // 1. Resolve host from NativeModules bundle scriptURL (active in Expo Go & bare React Native)
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (typeof scriptURL === 'string' && scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:\/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:3000`;
    }
  }

  // 2. Resolve host from Expo Constants sources
  const hostSources = [
    Constants.expoConfig?.hostUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
    (Constants as any).manifest?.extra?.expoClient?.hostUri,
    (Constants as any).experienceUrl,
    (Constants as any).linkingUri,
  ];

  for (const src of hostSources) {
    if (typeof src === 'string' && src.trim()) {
      const match = src.match(/(?:^|[a-z]+:\/\/)([^:\/\s]+)/i);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:3000`;
      }
    }
  }

  // 3. Fallback for iOS simulator / web / Android emulator
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

export const DEFAULT_API_URL = getDynamicApiUrl();

export async function getActiveApiUrl(): Promise<string> {
  const customUrl = await AsyncStorage.getItem('custom_api_url');
  return customUrl || getDynamicApiUrl();
}

export async function setCustomApiUrl(url: string): Promise<void> {
  if (!url || url.trim() === '') {
    await AsyncStorage.removeItem('custom_api_url');
  } else {
    await AsyncStorage.setItem('custom_api_url', url.trim().replace(/\/+$/, ''));
  }
}

const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const customUrl = await AsyncStorage.getItem('custom_api_url');
  if (customUrl) {
    config.baseURL = customUrl.trim().replace(/\/+$/, '');
  } else if (!config.baseURL || config.baseURL === '') {
    config.baseURL = getDynamicApiUrl();
  }

  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !error.response) {
      const activeUrl = error.config?.baseURL || getDynamicApiUrl();
      error.message = `Cannot connect to server at ${activeUrl}. Please ensure server is running on the same network.`;
    } else if (error.response?.status === 401) {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        await AsyncStorage.removeItem('auth_token');
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  country?: string;
  timezone?: string;
  preferred_language?: string;
  output_language?: string;
  date_format?: string;
  time_format?: string;
  use_case?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  status: 'draft' | 'recording' | 'processing' | 'completed' | 'failed';
  meeting_type?: string;
  output_language?: string;
  detected_languages?: string[];
  duration_seconds?: number;
  audio_url?: string;
  started_at?: string;
  ended_at?: string;
  metadata?: { platform?: string; meeting_link?: string | null };
  created_at?: string;
  updated_at?: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  meeting_title?: string;
  task: string;
  assignee?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
  language?: string;
}

export interface MeetingSummary {
  id: string;
  meeting_id: string;
  summary_text: string;
  executive_summary?: string;
  key_points?: string[];
  decisions?: string[];
  topics?: string[];
  created_at?: string;
}

export interface UserProfileResponse {
  user: User;
  profile: UserProfile;
}

export const authApi = {
  register: (email: string, password: string, fullName?: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, fullName }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  getProfile: () =>
    api.get<UserProfileResponse>('/auth/me'),

  updateProfile: (profile: Partial<UserProfile>) =>
    api.patch<{ profile: UserProfile }>('/auth/profile', profile),

  logout: () =>
    api.post('/auth/logout'),

  deleteAccount: (password: string) =>
    api.delete<{ success: boolean; message: string }>('/auth/account', { data: { password } }),
};

export const meetingsApi = {
  list: () =>
    api.get<Meeting[]>('/meetings'),

  get: (id: string) =>
    api.get<Meeting>(`/meetings/${id}`),

  create: (data: {
    title: string;
    meetingType?: string;
    outputLanguage?: string;
    platform?: string;
    meetingLink?: string;
  }) => api.post<Meeting>('/meetings', data),

  update: (id: string, data: Partial<Meeting>) =>
    api.patch<Meeting>(`/meetings/${id}`, data),

  start: (id: string) =>
    api.post<{ status: string }>(`/meetings/${id}/start`),

  stop: (id: string) =>
    api.post<{ status: string }>(`/meetings/${id}/stop`),

  process: (id: string) =>
    api.post<{ status: string }>(`/meetings/${id}/process`),

  delete: (id: string) =>
    api.delete(`/meetings/${id}`),

  search: (query: string) =>
    api.get<Meeting[]>(`/meetings/search?q=${encodeURIComponent(query)}`),

  getSummary: (id: string) =>
    api.get<MeetingSummary>(`/meetings/${id}/summary`),

  getTranscript: (id: string) =>
    api.get<TranscriptSegment[]>(`/transcripts/meeting/${id}`),

  getActionItems: (id: string) =>
    api.get<ActionItem[]>(`/action-items/meeting/${id}`),

  translate: (id: string, targetLanguage: string, options?: { translateSegments?: boolean; translateDecisions?: boolean; translateActionItems?: boolean }) =>
    api.post(`/meetings/${id}/translate`, { targetLanguage, ...options }),
};

export const actionItemsApi = {
  listByMeeting: (meetingId: string) =>
    api.get<ActionItem[]>(`/action-items/meeting/${meetingId}`),

  getUserItems: (status?: string) =>
    api.get<ActionItem[]>(`/action-items/user${status ? `?status=${status}` : ''}`),

  create: (meetingId: string, item: { task: string; assignee?: string; dueDate?: string; priority?: string }) =>
    api.post<ActionItem>('/action-items', { meetingId, ...item }),

  updateStatus: (id: string, status: 'pending' | 'in_progress' | 'completed') =>
    api.patch<ActionItem>(`/action-items/${id}`, { status }),

  delete: (id: string) =>
    api.delete(`/action-items/${id}`),
};

export const transcriptsApi = {
  getByMeetingId: (meetingId: string) =>
    api.get<TranscriptSegment[]>(`/transcripts/meeting/${meetingId}`),
};

export const oauthApi = {
  getGoogleUrl: (scopes: 'basic' | 'full' = 'basic') =>
    api.get<{ authUrl: string; state: string }>('/oauth/google/url', { params: { scopes } }),

  handleGoogleCallback: (code: string) =>
    api.post<{ user: User; token: string; isNewUser: boolean }>('/oauth/google/callback', { code }),

  connectGoogle: (code: string) =>
    api.post<{ success: boolean }>('/oauth/google/connect', { code }),

  disconnectGoogle: () =>
    api.delete('/oauth/google'),

  getConnectedAccounts: () =>
    api.get<{ accounts: any[] }>('/oauth/accounts'),
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
    return `${DEFAULT_API_URL}/exports/meeting/${meetingId}/pdf`;
  },

  downloadDOCX: (meetingId: string) => {
    return `${DEFAULT_API_URL}/exports/meeting/${meetingId}/docx`;
  },
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

  sendMeetingNotes: (meetingId: string, channelId?: string) =>
    api.post<{ success: boolean }>('/slack/share/' + meetingId, { channelId }),

  sendReminders: (channelId?: string) =>
    api.post<{ success: boolean; count: number }>('/slack/remind', { channelId }),
};

export const zoomApi = {
  getStatus: () =>
    api.get<{ connected: boolean; email?: string; accountId?: string }>('/zoom/status'),

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

export const foldersApi = {
  list: () => api.get<any[]>('/folders'),
  create: (name: string, color?: string, organizationId?: string) =>
    api.post<any>('/folders', { name, color, organizationId }),
  delete: (id: string) => api.delete<{ success: boolean }>('/folders/' + id),
};

export const tagsApi = {
  list: () => api.get<any[]>('/tags'),
  create: (name: string, color?: string) =>
    api.post<any>('/tags', { name, color }),
  delete: (id: string) => api.delete<{ success: boolean }>('/tags/' + id),
};

export default api;

