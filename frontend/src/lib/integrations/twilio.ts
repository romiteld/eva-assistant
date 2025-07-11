// Twilio SMS Integration
import twilio from 'twilio'

export class TwilioClient {
  private client: any
  private accountSid: string
  private authToken: string
  private phoneNumber: string

  constructor(config: {
    accountSid: string
    authToken: string
    phoneNumber: string
  }) {
    this.accountSid = config.accountSid
    this.authToken = config.authToken
    this.phoneNumber = config.phoneNumber
    this.client = twilio(this.accountSid, this.authToken)
  }

  // Send SMS
  async sendSMS(to: string, body: string, mediaUrl?: string[]) {
    try {
      const message = await this.client.messages.create({
        body,
        from: this.phoneNumber,
        to,
        mediaUrl
      })
      
      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        dateCreated: message.dateCreated
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      throw error
    }
  }

  // Send bulk SMS
  async sendBulkSMS(recipients: Array<{ to: string; body: string }>) {
    const results = []
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS(recipient.to, recipient.body)
        results.push({ ...result, to: recipient.to })
      } catch (error) {
        results.push({ 
          success: false, 
          to: recipient.to, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
    
    return results
  }

  // Get message history
  async getMessages(params?: {
    limit?: number
    dateSentAfter?: Date
    dateSentBefore?: Date
    from?: string
    to?: string
  }) {
    const messages = await this.client.messages.list({
      limit: params?.limit || 50,
      dateSentAfter: params?.dateSentAfter,
      dateSentBefore: params?.dateSentBefore,
      from: params?.from,
      to: params?.to
    })
    
    return messages.map((msg: any) => ({
      sid: msg.sid,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      status: msg.status,
      direction: msg.direction,
      dateCreated: msg.dateCreated,
      dateSent: msg.dateSent
    }))
  }

  // Get specific message
  async getMessage(messageSid: string) {
    const message = await this.client.messages(messageSid).fetch()
    
    return {
      sid: message.sid,
      from: message.from,
      to: message.to,
      body: message.body,
      status: message.status,
      direction: message.direction,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    }
  }

  // Set up webhook for incoming messages
  async configureWebhook(webhookUrl: string) {
    try {
      const phoneNumber = await this.client
        .incomingPhoneNumbers
        .list({ phoneNumber: this.phoneNumber })
        .then((numbers: any[]) => numbers[0])

      if (phoneNumber) {
        await this.client
          .incomingPhoneNumbers(phoneNumber.sid)
          .update({
            smsUrl: webhookUrl,
            smsMethod: 'POST'
          })
        
        return { success: true, message: 'Webhook configured successfully' }
      }
      
      throw new Error('Phone number not found')
    } catch (error) {
      console.error('Error configuring webhook:', error)
      throw error
    }
  }

  // Process incoming webhook
  processIncomingWebhook(body: any) {
    return {
      from: body.From,
      to: body.To,
      body: body.Body,
      messageSid: body.MessageSid,
      accountSid: body.AccountSid,
      messagingServiceSid: body.MessagingServiceSid,
      fromCity: body.FromCity,
      fromState: body.FromState,
      fromZip: body.FromZip,
      fromCountry: body.FromCountry
    }
  }

  // Create conversation thread
  async createConversation(friendlyName: string) {
    const conversation = await this.client.conversations.v1
      .conversations
      .create({ friendlyName })
    
    return {
      sid: conversation.sid,
      friendlyName: conversation.friendlyName,
      dateCreated: conversation.dateCreated
    }
  }

  // Add participant to conversation
  async addParticipant(conversationSid: string, phoneNumber: string) {
    const participant = await this.client.conversations.v1
      .conversations(conversationSid)
      .participants
      .create({ 'messagingBinding.address': phoneNumber })
    
    return {
      sid: participant.sid,
      conversationSid: participant.conversationSid
    }
  }

  // Send message to conversation
  async sendConversationMessage(conversationSid: string, body: string) {
    const message = await this.client.conversations.v1
      .conversations(conversationSid)
      .messages
      .create({ body })
    
    return {
      sid: message.sid,
      body: message.body,
      dateCreated: message.dateCreated
    }
  }

  // Recruiting-specific functions
  async sendCandidateUpdate(candidatePhone: string, candidateName: string, update: {
    type: 'interview_scheduled' | 'offer_extended' | 'document_requested' | 'status_update'
    details: string
    actionRequired?: boolean
  }) {
    let message = `Hi ${candidateName}, `
    
    switch (update.type) {
      case 'interview_scheduled':
        message += `Your interview has been scheduled. ${update.details}`
        break
      case 'offer_extended':
        message += `Congratulations! An offer has been extended. ${update.details}`
        break
      case 'document_requested':
        message += `We need some documents from you. ${update.details}`
        break
      case 'status_update':
        message += update.details
        break
    }
    
    if (update.actionRequired) {
      message += ' Please reply to confirm or call us for more details.'
    }
    
    return await this.sendSMS(candidatePhone, message)
  }

  async sendBulkCandidateNotification(
    candidates: Array<{ phone: string; name: string }>,
    notification: string
  ) {
    const recipients = candidates.map(candidate => ({
      to: candidate.phone,
      body: `Hi ${candidate.name}, ${notification}`
    }))
    
    return await this.sendBulkSMS(recipients)
  }

  async sendInterviewReminder(
    candidatePhone: string,
    candidateName: string,
    interviewDetails: {
      date: Date
      time: string
      location: string
      interviewerName: string
      position: string
    }
  ) {
    const message = `
Hi ${candidateName},

This is a reminder about your interview:
📅 Date: ${interviewDetails.date.toLocaleDateString()}
⏰ Time: ${interviewDetails.time}
📍 Location: ${interviewDetails.location}
👤 Interviewer: ${interviewDetails.interviewerName}
💼 Position: ${interviewDetails.position}

Please arrive 10 minutes early. Reply YES to confirm or call us if you need to reschedule.

Best regards,
The Well Recruiting Solutions
    `.trim()
    
    return await this.sendSMS(candidatePhone, message)
  }

  // SMS Campaign Management
  async createSMSCampaign(campaign: {
    name: string
    recipients: Array<{ phone: string; name: string; customFields?: Record<string, string> }>
    template: string
    scheduledTime?: Date
  }) {
    const results = []
    
    for (const recipient of campaign.recipients) {
      let personalizedMessage = campaign.template
      
      // Replace placeholders
      personalizedMessage = personalizedMessage.replace('{{name}}', recipient.name)
      
      if (recipient.customFields) {
        for (const [key, value] of Object.entries(recipient.customFields)) {
          personalizedMessage = personalizedMessage.replace(`{{${key}}}`, value)
        }
      }
      
      if (campaign.scheduledTime && campaign.scheduledTime > new Date()) {
        // Schedule for later (would need to implement scheduling logic)
        results.push({
          to: recipient.phone,
          status: 'scheduled',
          scheduledTime: campaign.scheduledTime
        })
      } else {
        // Send immediately
        try {
          const result = await this.sendSMS(recipient.phone, personalizedMessage)
          results.push({ ...result, to: recipient.phone })
        } catch (error) {
          results.push({
            success: false,
            to: recipient.phone,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }
    
    return {
      campaign: campaign.name,
      totalRecipients: campaign.recipients.length,
      results
    }
  }

  // Analytics
  async getMessagingStats(startDate: Date, endDate: Date) {
    const messages = await this.getMessages({
      dateSentAfter: startDate,
      dateSentBefore: endDate
    })
    
    const stats = {
      total: messages.length,
      sent: messages.filter((m: any) => m.direction === 'outbound-api').length,
      received: messages.filter((m: any) => m.direction === 'inbound').length,
      delivered: messages.filter((m: any) => m.status === 'delivered').length,
      failed: messages.filter((m: any) => m.status === 'failed').length,
      byDay: {} as Record<string, number>
    }
    
    // Group by day
    messages.forEach((message: any) => {
      const day = new Date(message.dateCreated).toLocaleDateString()
      stats.byDay[day] = (stats.byDay[day] || 0) + 1
    })
    
    return stats
  }
}