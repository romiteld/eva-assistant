// Microsoft 365 Integration (Outlook, SharePoint, Teams)
import { Client } from '@microsoft/microsoft-graph-client'
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client'

// Custom authentication provider
class CustomAuthProvider implements AuthenticationProvider {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken
  }
}

export class Microsoft365Client {
  private client: Client
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.client = Client.initWithMiddleware({
      authProvider: new CustomAuthProvider(accessToken)
    })
  }

  // Email/Outlook Functions
  async getEmails(params?: {
    filter?: string
    top?: number
    select?: string[]
    orderby?: string
  }) {
    let endpoint = '/me/messages'
    const queryParams: string[] = []

    if (params?.filter) queryParams.push(`$filter=${params.filter}`)
    if (params?.top) queryParams.push(`$top=${params.top}`)
    if (params?.select) queryParams.push(`$select=${params.select.join(',')}`)
    if (params?.orderby) queryParams.push(`$orderby=${params.orderby}`)

    if (queryParams.length > 0) {
      endpoint += '?' + queryParams.join('&')
    }

    return await this.client.api(endpoint).get()
  }

  async sendEmail(emailData: {
    to: string[]
    subject: string
    body: string
    cc?: string[]
    bcc?: string[]
    attachments?: Array<{
      name: string
      contentType: string
      contentBytes: string
    }>
    importance?: 'low' | 'normal' | 'high'
  }) {
    const message = {
      message: {
        subject: emailData.subject,
        body: {
          contentType: 'HTML',
          content: emailData.body
        },
        toRecipients: emailData.to.map(email => ({
          emailAddress: { address: email }
        })),
        ccRecipients: emailData.cc?.map(email => ({
          emailAddress: { address: email }
        })),
        bccRecipients: emailData.bcc?.map(email => ({
          emailAddress: { address: email }
        })),
        attachments: emailData.attachments?.map(att => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.contentBytes
        })),
        importance: emailData.importance || 'normal'
      },
      saveToSentItems: true
    }

    return await this.client.api('/me/sendMail').post(message)
  }

  async replyToEmail(messageId: string, replyData: {
    comment: string
    replyAll?: boolean
  }) {
    const endpoint = replyData.replyAll 
      ? `/me/messages/${messageId}/replyAll`
      : `/me/messages/${messageId}/reply`

    return await this.client.api(endpoint).post({
      comment: replyData.comment
    })
  }

  async createDraft(draftData: {
    to: string[]
    subject: string
    body: string
  }) {
    const draft = {
      subject: draftData.subject,
      body: {
        contentType: 'HTML',
        content: draftData.body
      },
      toRecipients: draftData.to.map(email => ({
        emailAddress: { address: email }
      }))
    }

    return await this.client.api('/me/messages').post(draft)
  }

  async searchEmails(query: string) {
    return await this.client
      .api('/me/messages')
      .search(query)
      .get()
  }

  // Calendar Functions
  async getCalendarEvents(params?: {
    startDateTime?: string
    endDateTime?: string
    top?: number
    select?: string[]
  }) {
    let endpoint = '/me/events'
    const queryParams: string[] = []

    if (params?.startDateTime && params?.endDateTime) {
      queryParams.push(
        `$filter=start/dateTime ge '${params.startDateTime}' and end/dateTime le '${params.endDateTime}'`
      )
    }
    if (params?.top) queryParams.push(`$top=${params.top}`)
    if (params?.select) queryParams.push(`$select=${params.select.join(',')}`)

    if (queryParams.length > 0) {
      endpoint += '?' + queryParams.join('&')
    }

    return await this.client.api(endpoint).get()
  }

  async createCalendarEvent(eventData: {
    subject: string
    start: { dateTime: string; timeZone: string }
    end: { dateTime: string; timeZone: string }
    body?: string
    location?: string
    attendees?: string[]
    isOnlineMeeting?: boolean
    onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness'
    reminderMinutesBeforeStart?: number
  }) {
    const event: any = {
      subject: eventData.subject,
      start: eventData.start,
      end: eventData.end,
      body: {
        contentType: 'HTML',
        content: eventData.body || ''
      },
      location: eventData.location ? {
        displayName: eventData.location
      } : undefined,
      attendees: eventData.attendees?.map(email => ({
        emailAddress: { address: email },
        type: 'required'
      })),
      isOnlineMeeting: eventData.isOnlineMeeting,
      onlineMeetingProvider: eventData.onlineMeetingProvider,
      reminderMinutesBeforeStart: eventData.reminderMinutesBeforeStart || 15
    }

    return await this.client.api('/me/events').post(event)
  }

  async updateCalendarEvent(eventId: string, updateData: any) {
    return await this.client.api(`/me/events/${eventId}`).patch(updateData)
  }

  async deleteCalendarEvent(eventId: string) {
    return await this.client.api(`/me/events/${eventId}`).delete()
  }

  async findMeetingTimes(params: {
    attendees: string[]
    timeConstraint: {
      timeslots: Array<{
        start: { dateTime: string; timeZone: string }
        end: { dateTime: string; timeZone: string }
      }>
    }
    meetingDuration?: string // ISO 8601 duration
    minimumAttendeePercentage?: number
  }) {
    const request = {
      attendees: params.attendees.map(email => ({
        emailAddress: { address: email }
      })),
      timeConstraint: params.timeConstraint,
      meetingDuration: params.meetingDuration || 'PT1H',
      minimumAttendeePercentage: params.minimumAttendeePercentage || 100,
      isOrganizerOptional: false
    }

    return await this.client.api('/me/findMeetingTimes').post(request)
  }

  // SharePoint Functions
  async getSharePointSites() {
    return await this.client.api('/sites').get()
  }

  async getSharePointDriveItems(siteId: string, driveId: string) {
    return await this.client
      .api(`/sites/${siteId}/drives/${driveId}/root/children`)
      .get()
  }

  async uploadToSharePoint(
    siteId: string,
    driveId: string,
    fileName: string,
    content: ArrayBuffer
  ) {
    return await this.client
      .api(`/sites/${siteId}/drives/${driveId}/root:/${fileName}:/content`)
      .put(content)
  }

  async createSharePointFolder(
    siteId: string,
    driveId: string,
    folderName: string
  ) {
    const folder = {
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename'
    }

    return await this.client
      .api(`/sites/${siteId}/drives/${driveId}/root/children`)
      .post(folder)
  }

  async searchSharePoint(query: string) {
    return await this.client
      .api(`/search/query`)
      .post({
        requests: [{
          entityTypes: ['driveItem', 'site', 'list'],
          query: {
            queryString: query
          }
        }]
      })
  }

  // Teams Functions (if integrated)
  async createTeamsChannel(teamId: string, channelData: {
    displayName: string
    description?: string
  }) {
    return await this.client
      .api(`/teams/${teamId}/channels`)
      .post(channelData)
  }

  async sendTeamsMessage(teamId: string, channelId: string, message: string) {
    return await this.client
      .api(`/teams/${teamId}/channels/${channelId}/messages`)
      .post({
        body: {
          content: message
        }
      })
  }

  // OneDrive Functions
  async getOneDriveFiles(path: string = '/root') {
    return await this.client.api(`/me/drive${path}/children`).get()
  }

  async uploadToOneDrive(fileName: string, content: ArrayBuffer) {
    return await this.client
      .api(`/me/drive/root:/${fileName}:/content`)
      .put(content)
  }

  // User Profile
  async getUserProfile() {
    return await this.client.api('/me').get()
  }

  async getUserPhoto() {
    try {
      const photo = await this.client.api('/me/photo/$value').get()
      return photo
    } catch (error) {
      return null
    }
  }

  // Contacts
  async getContacts(params?: { top?: number; filter?: string }) {
    let endpoint = '/me/contacts'
    const queryParams: string[] = []

    if (params?.top) queryParams.push(`$top=${params.top}`)
    if (params?.filter) queryParams.push(`$filter=${params.filter}`)

    if (queryParams.length > 0) {
      endpoint += '?' + queryParams.join('&')
    }

    return await this.client.api(endpoint).get()
  }

  async createContact(contactData: {
    givenName: string
    surname: string
    emailAddresses: Array<{ address: string; name?: string }>
    businessPhones?: string[]
    companyName?: string
    jobTitle?: string
  }) {
    return await this.client.api('/me/contacts').post(contactData)
  }

  // Helper Functions for Recruiting Workflows
  async scheduleInterviewWithCandidate(candidateData: {
    name: string
    email: string
    interviewDate: Date
    duration: number // in minutes
    interviewerEmails: string[]
    position: string
    meetingType: 'zoom' | 'inPerson' | 'phone'
  }) {
    const startTime = candidateData.interviewDate
    const endTime = new Date(startTime.getTime() + candidateData.duration * 60000)

    const event = await this.createCalendarEvent({
      subject: `Interview: ${candidateData.name} - ${candidateData.position}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York'
      },
      body: `
        <h3>Interview Details</h3>
        <p><strong>Candidate:</strong> ${candidateData.name}</p>
        <p><strong>Position:</strong> ${candidateData.position}</p>
        <p><strong>Interview Type:</strong> ${candidateData.meetingType}</p>
      `,
      attendees: [candidateData.email, ...candidateData.interviewerEmails],
      isOnlineMeeting: candidateData.meetingType === 'zoom',
      onlineMeetingProvider: candidateData.meetingType === 'zoom' ? 'teamsForBusiness' : undefined
    })

    return event
  }

  async createCandidateFolder(candidateName: string, siteId: string, driveId: string) {
    const folderName = `Candidates/${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}`
    return await this.createSharePointFolder(siteId, driveId, folderName)
  }

  async searchEmailsAboutCandidate(candidateName: string) {
    return await this.searchEmails(`"${candidateName}"`)
  }
}