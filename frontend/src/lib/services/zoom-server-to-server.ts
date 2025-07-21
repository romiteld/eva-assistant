import { createClient } from '@/lib/supabase/browser';

interface ZoomServerToServerTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface ZoomMeeting {
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
  settings?: any;
}

interface CreateMeetingParams {
  topic: string;
  type?: number; // 1: instant, 2: scheduled, 3: recurring with no fixed time, 8: recurring with fixed time
  start_time?: string; // ISO 8601 format
  duration?: number; // in minutes
  timezone?: string;
  password?: string;
  agenda?: string;
  settings?: {
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
  };
}

/**
 * Zoom Server-to-Server OAuth Service
 * Uses API Key for server-level authentication (no user authorization required)
 */
export class ZoomServerToServerService {
  private static instance: ZoomServerToServerService;
  private supabase = createClient();
  private apiKey: string;
  private accountId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  private constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ZOOM_API_KEY || '';
    this.accountId = process.env.NEXT_PUBLIC_ZOOM_ACCOUNT_ID || '';
    this.clientId = process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID || '';
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET || '';

    if (!this.apiKey) {
      console.warn('ZOOM_API_KEY not configured for Server-to-Server OAuth');
    }
  }
  
  static getInstance(): ZoomServerToServerService {
    if (!ZoomServerToServerService.instance) {
      ZoomServerToServerService.instance = new ZoomServerToServerService();
    }
    return ZoomServerToServerService.instance;
  }

  /**
   * Get Server-to-Server OAuth access token
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.accountId || !this.clientId || !this.clientSecret) {
      throw new Error('Zoom Server-to-Server OAuth not configured. Required: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET');
    }

    try {
      const response = await fetch('/api/auth/zoom/server-to-server-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: this.accountId,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get Server-to-Server token: ${response.statusText}`);
      }

      const tokens: ZoomServerToServerTokens = await response.json();
      
      this.accessToken = tokens.access_token;
      this.tokenExpiry = Date.now() + (tokens.expires_in * 1000) - 30000; // 30 second buffer

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Zoom Server-to-Server token:', error);
      throw error;
    }
  }

  /**
   * Create a Zoom meeting using Server-to-Server OAuth
   */
  async createMeeting(userId: string, params: CreateMeetingParams): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/users/${userId}/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: params.topic,
        type: params.type || 2,
        start_time: params.start_time,
        duration: params.duration || 60,
        timezone: params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        password: params.password,
        agenda: params.agenda,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: false,
          audio: 'both',
          auto_recording: 'cloud',
          waiting_room: true,
          ...params.settings,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Zoom meeting: ${error.message || response.statusText}`);
    }

    const meeting = await response.json();
    
    // Store meeting in database
    const { data: { user } } = await this.supabase.auth.getUser();
    if (user) {
      await this.supabase
        .from('zoom_meetings')
        .insert({
          user_id: user.id,
          zoom_meeting_id: meeting.id,
          uuid: meeting.uuid,
          host_id: meeting.host_id,
          topic: meeting.topic,
          type: meeting.type,
          start_time: meeting.start_time,
          duration: meeting.duration,
          timezone: meeting.timezone,
          agenda: meeting.agenda,
          start_url: meeting.start_url,
          join_url: meeting.join_url,
          password: meeting.password,
          encrypted_password: meeting.encrypted_password,
          h323_password: meeting.h323_password,
          pstn_password: meeting.pstn_password,
          settings: meeting.settings,
          status: 'scheduled',
          auth_type: 'server_to_server',
        });
    }

    return meeting;
  }

  /**
   * Get a Zoom meeting by ID
   */
  async getMeeting(meetingId: string | number): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Zoom meeting: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update a Zoom meeting
   */
  async updateMeeting(meetingId: string | number, params: Partial<CreateMeetingParams>): Promise<void> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update Zoom meeting: ${error.message || response.statusText}`);
    }

    // Update in database
    await this.supabase
      .from('zoom_meetings')
      .update({ updated_at: new Date().toISOString() })
      .eq('zoom_meeting_id', meetingId);
  }

  /**
   * Delete a Zoom meeting
   */
  async deleteMeeting(meetingId: string | number): Promise<void> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete Zoom meeting: ${error.message || response.statusText}`);
    }

    // Update status in database
    await this.supabase
      .from('zoom_meetings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('zoom_meeting_id', meetingId);
  }

  /**
   * List meetings for a specific user
   */
  async listMeetings(userId: string, params?: {
    type?: 'scheduled' | 'live' | 'upcoming';
    page_size?: number;
    page_number?: number;
  }): Promise<{ meetings: ZoomMeeting[]; page_count: number; total_records: number }> {
    const accessToken = await this.getAccessToken();
    
    const queryParams = new URLSearchParams({
      type: params?.type || 'scheduled',
      page_size: String(params?.page_size || 30),
      page_number: String(params?.page_number || 1),
    });
    
    const response = await fetch(
      `https://api.zoom.us/v2/users/${userId}/meetings?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to list Zoom meetings: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user information from Zoom
   */
  async getUser(userId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Zoom user: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get meeting participants
   */
  async getMeetingParticipants(meetingId: string | number): Promise<any> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/metrics/meetings/${meetingId}/participants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get meeting participants: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get cloud recordings for a meeting
   */
  async getMeetingRecordings(meetingId: string | number): Promise<any> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/recordings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get meeting recordings: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Handle Zoom webhook events
   */
  async handleWebhook(event: any): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    
    // Store webhook event
    await this.supabase
      .from('zoom_webhook_events')
      .insert({
        event_type: event.event,
        event_ts: event.event_ts,
        zoom_meeting_id: event.payload?.object?.id,
        user_id: user?.id,
        payload: event.payload,
        auth_type: 'server_to_server',
      });

    // Handle specific events
    switch (event.event) {
      case 'meeting.started':
        await this.handleMeetingStarted(event.payload.object);
        break;
      case 'meeting.ended':
        await this.handleMeetingEnded(event.payload.object);
        break;
      case 'meeting.participant_joined':
        await this.handleParticipantJoined(event.payload.object);
        break;
      case 'meeting.participant_left':
        await this.handleParticipantLeft(event.payload.object);
        break;
      case 'recording.completed':
        await this.handleRecordingCompleted(event.payload.object);
        break;
    }
  }

  private async handleMeetingStarted(meeting: any) {
    await this.supabase
      .from('zoom_meetings')
      .update({ 
        status: 'started',
        updated_at: new Date().toISOString(),
      })
      .eq('zoom_meeting_id', meeting.id);
  }

  private async handleMeetingEnded(meeting: any) {
    await this.supabase
      .from('zoom_meetings')
      .update({ 
        status: 'ended',
        updated_at: new Date().toISOString(),
      })
      .eq('zoom_meeting_id', meeting.id);

    // Update interview schedule status
    const { data: zoomMeeting } = await this.supabase
      .from('zoom_meetings')
      .select('interview_schedule_id')
      .eq('zoom_meeting_id', meeting.id)
      .single();

    if (zoomMeeting?.interview_schedule_id) {
      await this.supabase
        .from('interview_schedules')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', zoomMeeting.interview_schedule_id);
    }
  }

  private async handleParticipantJoined(data: any) {
    // Add participant to meeting record
    const { data: meeting } = await this.supabase
      .from('zoom_meetings')
      .select('participants')
      .eq('zoom_meeting_id', data.id)
      .single();

    if (meeting) {
      const participants = meeting.participants || [];
      participants.push({
        id: data.participant.id,
        name: data.participant.user_name,
        email: data.participant.email,
        join_time: new Date().toISOString(),
      });

      await this.supabase
        .from('zoom_meetings')
        .update({ 
          participants,
          updated_at: new Date().toISOString(),
        })
        .eq('zoom_meeting_id', data.id);
    }
  }

  private async handleParticipantLeft(data: any) {
    // Update participant leave time
    const { data: meeting } = await this.supabase
      .from('zoom_meetings')
      .select('participants')
      .eq('zoom_meeting_id', data.id)
      .single();

    if (meeting) {
      const participants = meeting.participants || [];
      const participant = participants.find((p: any) => p.id === data.participant.id);
      if (participant) {
        participant.leave_time = new Date().toISOString();
        participant.duration = data.participant.duration;
      }

      await this.supabase
        .from('zoom_meetings')
        .update({ 
          participants,
          updated_at: new Date().toISOString(),
        })
        .eq('zoom_meeting_id', data.id);
    }
  }

  private async handleRecordingCompleted(recording: any) {
    // Update meeting with recording URLs
    const recordingUrls = recording.recording_files.map((file: any) => ({
      id: file.id,
      type: file.file_type,
      download_url: file.download_url,
      play_url: file.play_url,
      recording_start: file.recording_start,
      recording_end: file.recording_end,
      file_size: file.file_size,
    }));

    await this.supabase
      .from('zoom_meetings')
      .update({ 
        recording_urls: recordingUrls,
        updated_at: new Date().toISOString(),
      })
      .eq('uuid', recording.uuid);

    // Update interview schedule with recording URL
    const { data: zoomMeeting } = await this.supabase
      .from('zoom_meetings')
      .select('interview_schedule_id')
      .eq('uuid', recording.uuid)
      .single();

    if (zoomMeeting?.interview_schedule_id) {
      const videoRecording = recordingUrls.find((r: any) => r.type === 'MP4');
      if (videoRecording) {
        await this.supabase
          .from('interview_schedules')
          .update({ 
            recording_url: videoRecording.play_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', zoomMeeting.interview_schedule_id);
      }
    }
  }
}

// Export singleton instance
export const zoomServerToServerService = ZoomServerToServerService.getInstance();