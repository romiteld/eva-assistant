export interface ZoomCredentials {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  scope: string;
  zoom_user_id: string;
  zoom_email: string | null;
  zoom_account_id: string | null;
  is_active: boolean;
  last_refreshed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ZoomMeeting {
  id: number;
  uuid: string;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  agenda?: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password?: string;
  h323_password?: string;
  pstn_password?: string;
  encrypted_password?: string;
  settings?: ZoomMeetingSettings;
  status?: 'scheduled' | 'started' | 'ended' | 'cancelled';
  recording_urls?: ZoomRecording[];
  participants?: ZoomParticipant[];
}

export interface ZoomMeetingSettings {
  host_video?: boolean;
  participant_video?: boolean;
  cn_meeting?: boolean;
  in_meeting?: boolean;
  join_before_host?: boolean;
  mute_upon_entry?: boolean;
  watermark?: boolean;
  use_pmi?: boolean;
  approval_type?: number;
  audio?: 'both' | 'telephony' | 'voip';
  auto_recording?: 'local' | 'cloud' | 'none';
  enforce_login?: boolean;
  enforce_login_domains?: string;
  alternative_hosts?: string;
  alternative_hosts_email_notification?: boolean;
  close_registration?: boolean;
  show_share_button?: boolean;
  allow_multiple_devices?: boolean;
  registrants_confirmation_email?: boolean;
  waiting_room?: boolean;
  request_permission_to_unmute_participants?: boolean;
  registrants_email_notification?: boolean;
  meeting_authentication?: boolean;
  authentication_option?: string;
  authentication_domains?: string;
  authentication_name?: string;
  additional_data_center_regions?: string[];
  language_interpretation?: {
    enable?: boolean;
    interpreters?: Array<{
      email: string;
      languages: string;
    }>;
  };
}

export interface ZoomParticipant {
  id: string;
  name: string;
  email?: string;
  join_time: string;
  leave_time?: string;
  duration?: number;
}

export interface ZoomRecording {
  id: string;
  type: string;
  download_url: string;
  play_url: string;
  recording_start: string;
  recording_end: string;
  file_size: number;
}

export interface ZoomWebhookEvent {
  event: string;
  event_ts: number;
  payload: {
    account_id?: string;
    object?: any;
    plainToken?: string;
  };
}

