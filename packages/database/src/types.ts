export interface User {
  id: string;
  email: string;
  phone?: string;
  password_hash?: string;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: Date;
  updated_at: Date;
  last_active_at?: Date;
  status: 'active' | 'suspended' | 'deleted';
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

export interface Meeting {
  id: string;
  user_id: string;
  organization_id?: string;
  title: string;
  meeting_type: string;
  status: 'draft' | 'recording' | 'processing' | 'completed' | 'failed' | 'archived';
  recording_quality: string;
  detected_languages?: string[];
  source_language?: string;
  output_language: string;
  // Recording consent (per-meeting). Enforced only when the feature flag is on.
  consent_confirmed?: boolean;
  consent_confirmed_at?: Date | null;
  consent_version?: string | null;
  duration_seconds?: number;
  started_at?: Date;
  ended_at?: Date;
  created_at: Date;
  updated_at: Date;
  // Manual-note fields (nullable; unset for recording-only meetings)
  content?: string | null;
  agenda?: string | null;
  objectives?: string | null;
  meeting_date?: Date | null;
  metadata?: any;
}

export interface Recording {
  id: string;
  meeting_id: string;
  storage_path: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  format?: string;
  sample_rate?: number;
  channels?: number;
  uploaded_at: Date;
  delete_after?: Date;
}

export interface AudioChunk {
  id: string;
  recording_id: string;
  chunk_index: number;
  storage_path: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  uploaded_at: Date;
  processed: boolean;
}

export interface Transcript {
  id: string;
  meeting_id: string;
  language?: string;
  provider?: string;
  provider_job_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence_score?: number;
  word_count?: number;
  created_at: Date;
  completed_at?: Date;
}

export interface TranscriptSegment {
  id: string;
  transcript_id: string;
  segment_index: number;
  speaker_id?: string;
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
  created_at: Date;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  task: string;
  assignee?: string;
  assignee_user_id?: string;
  due_date?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  priority: string;
  source_timestamp?: number;
  confidence: string;
  created_at: Date;
  completed_at?: Date;
}

export interface MeetingSummary {
  id: string;
  meeting_id: string;
  summary: string;
  executive_summary?: string;
  // Provenance: 'ai' | 'template' | 'manual'.
  source?: 'ai' | 'template' | 'manual';
  version: number;
  model_version?: string;
  created_at: Date;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  decision: string;
  context?: string;
  source_timestamp?: number;
  confidence: string;
  created_at: Date;
}

export interface Subscription {
  id: string;
  user_id?: string;
  organization_id?: string;
  plan_id?: string;
  status: 'active' | 'cancelled' | 'past_due' | 'paused' | 'expired';
  current_period_start?: Date;
  current_period_end?: Date;
  cancel_at?: Date;
  cancelled_at?: Date;
  provider?: string;
  provider_subscription_id?: string;
  created_at: Date;
  updated_at: Date;
}
