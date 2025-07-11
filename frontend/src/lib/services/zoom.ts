import { createClient } from '@/lib/supabase/browser';

interface ZoomTokens {
  access_token: string;
  refresh_token: string;
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

export class ZoomService {
  private static instance: ZoomService;
  private supabase = createClient();
  
  private constructor() {}
  
  static getInstance(): ZoomService {
    if (!ZoomService.instance) {
      ZoomService.instance = new ZoomService();
    }
    return ZoomService.instance;
  }

  /**
   * Get the current user's Zoom credentials
   */
  async getCredentials() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: credentials, error } = await this.supabase
      .from('zoom_credentials')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return credentials;
  }

  /**
   * Check if token needs refresh and refresh if necessary
   */
  async ensureValidToken(): Promise<string> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      throw new Error('No Zoom credentials found. Please connect your Zoom account.');
    }

    const needsRefresh = new Date(credentials.expires_at) <= new Date(Date.now() + 5 * 60 * 1000);
    
    if (needsRefresh) {
      await this.refreshToken(credentials.refresh_token);
      const updatedCredentials = await this.getCredentials();
      return updatedCredentials!.access_token;
    }

    return credentials.access_token;
  }

  /**
   * Refresh the Zoom access token
   */
  async refreshToken(refreshToken: string): Promise<void> {
    const response = await fetch('/api/auth/zoom/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Zoom token');
    }

    const tokens = await response.json();
    
    // Update tokens in database
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('zoom_credentials')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) throw error;
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(params: CreateMeetingParams): Promise<ZoomMeeting> {
    const accessToken = await this.ensureValidToken();
    const credentials = await this.getCredentials();
    
    const response = await fetch(`https://api.zoom.us/v2/users/${credentials!.zoom_user_id}/meetings`, {
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
        });
    }

    return meeting;
  }

  /**
   * Get a Zoom meeting by ID
   */
  async getMeeting(meetingId: string | number): Promise<ZoomMeeting> {
    const accessToken = await this.ensureValidToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Zoom meeting');
    }

    return response.json();
  }

  /**
   * Update a Zoom meeting
   */
  async updateMeeting(meetingId: string | number, params: Partial<CreateMeetingParams>): Promise<void> {
    const accessToken = await this.ensureValidToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to update Zoom meeting');
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
    const accessToken = await this.ensureValidToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete Zoom meeting');
    }

    // Update status in database
    await this.supabase
      .from('zoom_meetings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('zoom_meeting_id', meetingId);
  }

  /**
   * List user's Zoom meetings
   */
  async listMeetings(params?: {
    type?: 'scheduled' | 'live' | 'upcoming';
    page_size?: number;
    page_number?: number;
  }): Promise<{ meetings: ZoomMeeting[]; page_count: number; total_records: number }> {
    const accessToken = await this.ensureValidToken();
    const credentials = await this.getCredentials();
    
    const queryParams = new URLSearchParams({
      type: params?.type || 'scheduled',
      page_size: String(params?.page_size || 30),
      page_number: String(params?.page_number || 1),
    });
    
    const response = await fetch(
      `https://api.zoom.us/v2/users/${credentials!.zoom_user_id}/meetings?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to list Zoom meetings');
    }

    return response.json();
  }

  /**
   * Get meeting participants
   */
  async getMeetingParticipants(meetingId: string | number): Promise<any> {
    const accessToken = await this.ensureValidToken();
    
    const response = await fetch(`https://api.zoom.us/v2/metrics/meetings/${meetingId}/participants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get meeting participants');
    }

    return response.json();
  }

  /**
   * Get cloud recordings for a meeting
   */
  async getMeetingRecordings(meetingId: string | number): Promise<any> {
    const accessToken = await this.ensureValidToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/recordings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get meeting recordings');
    }

    return response.json();
  }

  /**
   * Create a meeting for an interview
   */
  async createInterviewMeeting(interviewScheduleId: string, details: {
    candidateName: string;
    jobTitle: string;
    interviewType: string;
    round: number;
    scheduledAt: Date;
    duration: number;
    interviewers: Array<{ name: string; email: string }>;
  }): Promise<ZoomMeeting> {
    const meeting = await this.createMeeting({
      topic: `Interview: ${details.candidateName} - ${details.jobTitle} (Round ${details.round})`,
      type: 2, // Scheduled meeting
      start_time: details.scheduledAt.toISOString(),
      duration: details.duration,
      agenda: `${details.interviewType} interview for ${details.jobTitle} position.\n\nCandidate: ${details.candidateName}\nRound: ${details.round}\n\nInterviewers:\n${details.interviewers.map(i => `- ${i.name} (${i.email})`).join('\n')}`,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        watermark: false,
        audio: 'both',
        auto_recording: 'cloud',
        waiting_room: true,
        meeting_authentication: false,
        close_registration: false,
        registrants_email_notification: true,
        alternative_hosts: details.interviewers.map(i => i.email).join(','),
      },
    });

    // Link meeting to interview schedule
    await this.supabase
      .from('zoom_meetings')
      .update({ interview_schedule_id: interviewScheduleId })
      .eq('zoom_meeting_id', meeting.id);

    // Update interview schedule with meeting details
    await this.supabase
      .from('interview_schedules')
      .update({
        meeting_platform: 'zoom',
        meeting_id: String(meeting.id),
        meeting_url: meeting.join_url,
        meeting_password: meeting.password,
        updated_at: new Date().toISOString(),
      })
      .eq('id', interviewScheduleId);

    return meeting;
  }

  /**
   * Handle Zoom webhook
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
export const zoomService = ZoomService.getInstance();