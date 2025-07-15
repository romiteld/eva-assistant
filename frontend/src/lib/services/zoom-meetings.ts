import { zoomOAuth } from '@/lib/auth/zoom-oauth'

export interface ZoomMeeting {
  id: string
  uuid: string
  host_id: string
  host_email: string
  topic: string
  type: number
  status: string
  start_time: string
  duration: number
  timezone: string
  agenda: string
  created_at: string
  start_url: string
  join_url: string
  password: string
  encrypted_password: string
  pmi: number
  tracking_fields: Array<{
    field: string
    value: string
  }>
  settings: {
    host_video: boolean
    participant_video: boolean
    cn_meeting: boolean
    in_meeting: boolean
    join_before_host: boolean
    mute_upon_entry: boolean
    watermark: boolean
    use_pmi: boolean
    approval_type: number
    audio: string
    auto_recording: string
    enforce_login: boolean
    enforce_login_domains: string
    alternative_hosts: string
    registrants_confirmation_email: boolean
    waiting_room: boolean
    registrants_email_notification: boolean
    meeting_authentication: boolean
    encryption_type: string
    approved_or_denied_countries_or_regions: {
      enable: boolean
      method: string
      countries_or_regions: string[]
    }
    breakout_room: {
      enable: boolean
      rooms: Array<{
        name: string
        participants: string[]
      }>
    }
  }
}

export interface CreateMeetingRequest {
  topic: string
  type: number
  start_time?: string
  duration?: number
  timezone?: string
  password?: string
  agenda?: string
  settings?: {
    host_video?: boolean
    participant_video?: boolean
    join_before_host?: boolean
    mute_upon_entry?: boolean
    watermark?: boolean
    use_pmi?: boolean
    approval_type?: number
    auto_recording?: string
    waiting_room?: boolean
    meeting_authentication?: boolean
    alternative_hosts?: string
  }
}

export interface UpdateMeetingRequest {
  topic?: string
  type?: number
  start_time?: string
  duration?: number
  timezone?: string
  password?: string
  agenda?: string
  settings?: {
    host_video?: boolean
    participant_video?: boolean
    join_before_host?: boolean
    mute_upon_entry?: boolean
    watermark?: boolean
    use_pmi?: boolean
    approval_type?: number
    auto_recording?: string
    waiting_room?: boolean
    meeting_authentication?: boolean
    alternative_hosts?: string
  }
}

export interface ZoomMeetingList {
  page_count: number
  page_number: number
  page_size: number
  total_records: number
  meetings: ZoomMeeting[]
}

export interface ZoomRecording {
  id: string
  meeting_id: string
  recording_start: string
  recording_end: string
  file_type: string
  file_size: number
  download_url: string
  play_url: string
  recording_type: string
  status: string
}

export interface ZoomParticipant {
  id: string
  user_id: string
  name: string
  user_email: string
  join_time: string
  leave_time: string
  duration: number
  status: string
  camera: string
  microphone: string
  share_application: boolean
  share_desktop: boolean
  share_whiteboard: boolean
  recording: boolean
  participant_user_id: string
  bo_mtg_id: string
  role: string
}

export class ZoomMeetingService {
  private baseUrl = '/api/zoom'

  /**
   * Get access token for API calls
   */
  private async getAccessToken(): Promise<string> {
    const tokens = await zoomOAuth.getStoredTokens()
    if (!tokens) {
      throw new Error('No Zoom authentication found. Please connect your Zoom account.')
    }
    return tokens.access_token
  }

  /**
   * Create a new meeting
   */
  async createMeeting(meeting: CreateMeetingRequest): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(meeting),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create meeting: ${error.message}`)
    }

    return response.json()
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to get meeting: ${error.message}`)
    }

    return response.json()
  }

  /**
   * Update meeting
   */
  async updateMeeting(meetingId: string, updates: UpdateMeetingRequest): Promise<void> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to update meeting: ${error.message}`)
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to delete meeting: ${error.message}`)
    }
  }

  /**
   * List user meetings
   */
  async listMeetings(params: {
    type?: 'scheduled' | 'live' | 'upcoming' | 'upcoming_meetings' | 'previous_meetings'
    page_size?: number
    page_number?: number
    next_page_token?: string
  } = {}): Promise<ZoomMeetingList> {
    const accessToken = await this.getAccessToken()
    
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString())
    })

    const response = await fetch(`${this.baseUrl}/meetings?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to list meetings: ${error.message}`)
    }

    return response.json()
  }

  /**
   * Get meeting participants
   */
  async getMeetingParticipants(meetingId: string): Promise<{
    participants: ZoomParticipant[]
    total_records: number
  }> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}/participants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to get participants: ${error.message}`)
    }

    return response.json()
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(meetingId: string): Promise<{
    recordings: ZoomRecording[]
    total_records: number
  }> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}/recordings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to get recordings: ${error.message}`)
    }

    return response.json()
  }

  /**
   * Start meeting for host
   */
  async startMeeting(meetingId: string): Promise<{ start_url: string }> {
    const meeting = await this.getMeeting(meetingId)
    return { start_url: meeting.start_url }
  }

  /**
   * Get join URL for participants
   */
  async getJoinUrl(meetingId: string): Promise<{ join_url: string }> {
    const meeting = await this.getMeeting(meetingId)
    return { join_url: meeting.join_url }
  }

  /**
   * Schedule instant meeting
   */
  async createInstantMeeting(topic: string, settings?: CreateMeetingRequest['settings']): Promise<ZoomMeeting> {
    return this.createMeeting({
      topic,
      type: 1, // Instant meeting
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: false,
        waiting_room: false,
        ...settings,
      },
    })
  }

  /**
   * Schedule future meeting
   */
  async scheduleMeeting(
    topic: string,
    startTime: string,
    duration: number,
    settings?: CreateMeetingRequest['settings']
  ): Promise<ZoomMeeting> {
    return this.createMeeting({
      topic,
      type: 2, // Scheduled meeting
      start_time: startTime,
      duration,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        ...settings,
      },
    })
  }

  /**
   * Get meeting status
   */
  async getMeetingStatus(meetingId: string): Promise<{
    status: string
    participants: number
    duration: number
  }> {
    const [meeting, participants] = await Promise.all([
      this.getMeeting(meetingId),
      this.getMeetingParticipants(meetingId).catch(() => ({ participants: [], total_records: 0 }))
    ])

    return {
      status: meeting.status,
      participants: participants.total_records,
      duration: meeting.duration,
    }
  }
}