export type CommunicationMode = 'chat' | 'stream' | 'voice';

export interface UnifiedSession {
  id: string;
  user_id: string;
  title: string;
  mode: CommunicationMode;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
  media_metadata?: {
    has_video?: boolean;
    has_screen_share?: boolean;
    duration?: number;
    participants?: number;
  };
  message_count?: number;
  participant_count?: number;
  recording_count?: number;
}

export interface StreamParticipant {
  id: string;
  session_id: string;
  user_id: string;
  peer_id: string;
  joined_at: string;
  left_at?: string;
  role: 'host' | 'participant';
  metadata?: Record<string, any>;
}

export interface MediaRecording {
  id: string;
  session_id: string;
  type: 'audio' | 'video' | 'screen';
  url: string;
  duration?: number;
  size?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface StreamConfig {
  video: boolean;
  audio: boolean;
  screen: boolean;
}

export interface RealtimeMessage {
  type: 'broadcast' | 'presence';
  event: string;
  payload: any;
  timestamp: string;
}