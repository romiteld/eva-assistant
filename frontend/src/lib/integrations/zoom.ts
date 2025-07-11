// Zoom Integration
import axios from 'axios'
import { sign } from 'jsonwebtoken'

export class ZoomClient {
  private clientId: string
  private clientSecret: string
  private accountId: string
  private baseUrl: string = 'https://api.zoom.us/v2'
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null

  constructor(config: {
    clientId: string
    clientSecret: string
    accountId: string
  }) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.accountId = config.accountId
  }

  // Get OAuth token
  private async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    try {
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: this.accountId
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret
          }
        }
      )

      this.accessToken = response.data.access_token
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000)
      
      return this.accessToken
    } catch (error) {
      console.error('Error getting Zoom access token:', error)
      throw error
    }
  }

  // Make authenticated request
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const token = await this.getAccessToken()

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data
      })

      return response.data
    } catch (error) {
      console.error('Zoom API error:', error)
      throw error
    }
  }

  // User Management
  async getCurrentUser() {
    return await this.makeRequest('/users/me')
  }

  async getUsers(params?: {
    status?: 'active' | 'inactive' | 'pending'
    pageSize?: number
    pageNumber?: number
  }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return await this.makeRequest(`/users?${queryParams}`)
  }

  // Meeting Management
  async createMeeting(meetingData: {
    topic: string
    type?: 1 | 2 | 3 | 8 // 1: instant, 2: scheduled, 3: recurring no fixed time, 8: recurring fixed time
    startTime?: string // ISO 8601 format
    duration?: number // minutes
    timezone?: string
    password?: string
    agenda?: string
    settings?: {
      hostVideo?: boolean
      participantVideo?: boolean
      joinBeforeHost?: boolean
      muteUponEntry?: boolean
      watermark?: boolean
      usePmi?: boolean
      approvalType?: 0 | 1 | 2 // 0: auto approve, 1: manual approve, 2: no registration
      audio?: 'both' | 'telephony' | 'voip'
      autoRecording?: 'local' | 'cloud' | 'none'
      waitingRoom?: boolean
      meetingAuthentication?: boolean
    }
    invitees?: string[] // email addresses
  }) {
    const meeting = {
      topic: meetingData.topic,
      type: meetingData.type || 2,
      start_time: meetingData.startTime,
      duration: meetingData.duration || 60,
      timezone: meetingData.timezone || 'America/New_York',
      password: meetingData.password,
      agenda: meetingData.agenda,
      settings: {
        host_video: meetingData.settings?.hostVideo ?? true,
        participant_video: meetingData.settings?.participantVideo ?? true,
        join_before_host: meetingData.settings?.joinBeforeHost ?? false,
        mute_upon_entry: meetingData.settings?.muteUponEntry ?? true,
        watermark: meetingData.settings?.watermark ?? false,
        use_pmi: meetingData.settings?.usePmi ?? false,
        approval_type: meetingData.settings?.approvalType ?? 2,
        audio: meetingData.settings?.audio || 'both',
        auto_recording: meetingData.settings?.autoRecording || 'cloud',
        waiting_room: meetingData.settings?.waitingRoom ?? true,
        meeting_authentication: meetingData.settings?.meetingAuthentication ?? false
      }
    }

    const response = await this.makeRequest('/users/me/meetings', 'POST', meeting)

    // Send invites if provided
    if (meetingData.invitees && meetingData.invitees.length > 0 && response.id) {
      await this.inviteToMeeting(response.id, meetingData.invitees)
    }

    return response
  }

  async getMeeting(meetingId: string) {
    return await this.makeRequest(`/meetings/${meetingId}`)
  }

  async updateMeeting(meetingId: string, updateData: any) {
    return await this.makeRequest(`/meetings/${meetingId}`, 'PATCH', updateData)
  }

  async deleteMeeting(meetingId: string) {
    return await this.makeRequest(`/meetings/${meetingId}`, 'DELETE')
  }

  async listMeetings(params?: {
    type?: 'scheduled' | 'live' | 'upcoming'
    pageSize?: number
    pageNumber?: number
  }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return await this.makeRequest(`/users/me/meetings?${queryParams}`)
  }

  async inviteToMeeting(meetingId: string, emails: string[]) {
    return await this.makeRequest(`/meetings/${meetingId}/invite`, 'POST', {
      attendees: emails.map(email => ({ email }))
    })
  }

  // Recording Management
  async getRecordings(params?: {
    from?: string // YYYY-MM-DD
    to?: string // YYYY-MM-DD
    pageSize?: number
    nextPageToken?: string
  }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return await this.makeRequest(`/users/me/recordings?${queryParams}`)
  }

  async getRecording(meetingId: string) {
    return await this.makeRequest(`/meetings/${meetingId}/recordings`)
  }

  async deleteRecording(meetingId: string) {
    return await this.makeRequest(`/meetings/${meetingId}/recordings`, 'DELETE')
  }

  async downloadRecording(downloadUrl: string, accessToken?: string) {
    // Note: Zoom recording URLs require authentication
    const token = accessToken || await this.getAccessToken()
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'stream'
    })

    return response.data
  }

  // Webinar Management (if account has webinar feature)
  async createWebinar(webinarData: {
    topic: string
    type: 5 | 6 | 9 // 5: webinar, 6: recurring no fixed time, 9: recurring fixed time
    startTime?: string
    duration?: number
    timezone?: string
    agenda?: string
    settings?: any
  }) {
    return await this.makeRequest('/users/me/webinars', 'POST', webinarData)
  }

  // Cloud Recording Analysis
  async getRecordingTranscript(meetingId: string) {
    const recording = await this.getRecording(meetingId)
    
    if (recording.recording_files) {
      const transcriptFile = recording.recording_files.find(
        (file: any) => file.file_type === 'TRANSCRIPT'
      )
      
      if (transcriptFile) {
        return {
          success: true,
          downloadUrl: transcriptFile.download_url,
          fileSize: transcriptFile.file_size
        }
      }
    }
    
    return {
      success: false,
      message: 'No transcript available for this recording'
    }
  }

  // Recruiting-specific functions
  async scheduleInterviewMeeting(interviewData: {
    candidateName: string
    candidateEmail: string
    position: string
    interviewers: Array<{ name: string; email: string }>
    scheduledTime: Date
    duration?: number
    sendCalendarInvite?: boolean
    enableRecording?: boolean
    interviewType?: 'screening' | 'technical' | 'cultural' | 'final'
  }) {
    const topic = `Interview: ${interviewData.candidateName} - ${interviewData.position}`
    const agenda = `
Interview Details:
- Candidate: ${interviewData.candidateName}
- Position: ${interviewData.position}
- Interview Type: ${interviewData.interviewType || 'General'}
- Interviewers: ${interviewData.interviewers.map(i => i.name).join(', ')}

Please join the meeting 5 minutes early to ensure everything is set up properly.
    `.trim()

    const meeting = await this.createMeeting({
      topic,
      type: 2, // Scheduled meeting
      startTime: interviewData.scheduledTime.toISOString(),
      duration: interviewData.duration || 60,
      agenda,
      settings: {
        hostVideo: true,
        participantVideo: true,
        joinBeforeHost: false,
        muteUponEntry: false,
        waitingRoom: true,
        autoRecording: interviewData.enableRecording ? 'cloud' : 'none',
        meetingAuthentication: false
      },
      invitees: [
        interviewData.candidateEmail,
        ...interviewData.interviewers.map(i => i.email)
      ]
    })

    return {
      meetingId: meeting.id,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      password: meeting.password,
      dialInNumbers: meeting.settings?.global_dial_in_numbers
    }
  }

  async createRecurringTeamMeeting(teamMeetingData: {
    topic: string
    recurrence: {
      type: 1 | 2 | 3 // 1: daily, 2: weekly, 3: monthly
      repeatInterval: number
      weeklyDays?: string // comma-separated: "1,2,3" (Sun=1)
      monthlyDay?: number // 1-31
      endTimes?: number // number of occurrences
      endDateTime?: string
    }
    duration: number
    teamMembers: string[]
  }) {
    return await this.createMeeting({
      topic: teamMeetingData.topic,
      type: 8, // Recurring with fixed time
      duration: teamMeetingData.duration,
      settings: {
        hostVideo: true,
        participantVideo: true,
        autoRecording: 'cloud'
      },
      invitees: teamMeetingData.teamMembers
    })
  }

  async analyzeMeetingEngagement(meetingId: string) {
    // Get meeting participants report
    const participants = await this.makeRequest(`/report/meetings/${meetingId}/participants`)
    
    // Get meeting recording if available
    const recording = await this.getRecording(meetingId).catch(() => null)
    
    const analysis = {
      meetingId,
      totalParticipants: participants.participants?.length || 0,
      averageDuration: 0,
      engagement: {
        joinedOnTime: 0,
        stayedFullDuration: 0,
        videoEnabled: 0,
        audioIssues: 0
      },
      recording: {
        available: !!recording,
        duration: recording?.duration || 0,
        hasTranscript: false
      }
    }
    
    // Calculate engagement metrics
    if (participants.participants) {
      const joinTimes = participants.participants.map((p: any) => new Date(p.join_time))
      const meetingStart = Math.min(...joinTimes.map((t: Date) => t.getTime()))
      
      participants.participants.forEach((participant: any) => {
        const joinTime = new Date(participant.join_time).getTime()
        const duration = participant.duration || 0
        
        analysis.averageDuration += duration
        
        if (joinTime - meetingStart < 5 * 60 * 1000) { // Within 5 minutes
          analysis.engagement.joinedOnTime++
        }
        
        if (duration >= participants.duration * 0.9) { // Stayed for 90% or more
          analysis.engagement.stayedFullDuration++
        }
      })
      
      analysis.averageDuration /= participants.participants.length
    }
    
    return analysis
  }

  async generateMeetingSummary(meetingId: string, geminiClient: any) {
    try {
      // Get recording transcript
      const transcript = await this.getRecordingTranscript(meetingId)
      
      if (!transcript.success || !transcript.downloadUrl) {
        return {
          success: false,
          message: 'No transcript available for this meeting'
        }
      }
      
      // Download transcript content
      const transcriptContent = await this.downloadRecording(transcript.downloadUrl)
      
      // Use Gemini to analyze and summarize
      const prompt = `
      Analyze this meeting transcript and provide:
      1. Executive summary (2-3 sentences)
      2. Key discussion points
      3. Action items with assigned owners
      4. Important decisions made
      5. Follow-up items
      6. Next steps
      
      For recruiting/interview meetings, also include:
      - Candidate assessment summary
      - Strengths identified
      - Concerns or red flags
      - Recommendation (proceed/reject/need more info)
      
      Transcript:
      ${transcriptContent}
      `
      
      const summary = await geminiClient.generateContent(prompt)
      
      return {
        success: true,
        summary: summary.response.text(),
        meetingId,
        transcriptAvailable: true
      }
    } catch (error) {
      console.error('Error generating meeting summary:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Meeting Templates
  async createMeetingFromTemplate(templateType: 'interview' | 'client' | 'team' | 'training', customData: any) {
    const templates = {
      interview: {
        topic: `Interview: ${customData.candidateName} - ${customData.position}`,
        duration: 60,
        settings: {
          waitingRoom: true,
          autoRecording: 'cloud',
          muteUponEntry: false
        }
      },
      client: {
        topic: `Client Meeting: ${customData.clientName}`,
        duration: 45,
        settings: {
          waitingRoom: false,
          autoRecording: 'cloud',
          muteUponEntry: true
        }
      },
      team: {
        topic: `Team Meeting: ${customData.topic || 'Weekly Sync'}`,
        duration: 30,
        settings: {
          waitingRoom: false,
          autoRecording: 'cloud',
          muteUponEntry: false
        }
      },
      training: {
        topic: `Training: ${customData.topic}`,
        duration: 90,
        settings: {
          waitingRoom: true,
          autoRecording: 'cloud',
          muteUponEntry: true,
          participantVideo: false
        }
      }
    }
    
    const template = templates[templateType]
    
    return await this.createMeeting({
      ...template,
      ...customData,
      settings: {
        ...template.settings,
        ...customData.settings
      }
    })
  }
}