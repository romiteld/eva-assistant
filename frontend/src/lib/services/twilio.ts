// Enhanced Twilio Integration Service
import twilio from 'twilio'
import { TwilioClient as LegacyTwilioClient } from '../integrations/twilio'

// Types
export interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  voiceUrl?: string
  statusCallbackUrl?: string
}

export interface SendSMSOptions {
  to: string
  body: string
  mediaUrl?: string[]
  statusCallback?: string
  scheduleSend?: Date
}

export interface MakeCallOptions {
  to: string
  from?: string
  url?: string
  twiml?: string
  statusCallback?: string
  statusCallbackMethod?: 'GET' | 'POST'
  statusCallbackEvent?: string[]
  record?: boolean
  recordingStatusCallback?: string
  recordingChannels?: 'mono' | 'dual'
  machineDetection?: 'Enable' | 'DetectMessageEnd'
  machineDetectionTimeout?: number
  asyncAmd?: boolean
  asyncAmdStatusCallback?: string
  asyncAmdStatusCallbackMethod?: 'GET' | 'POST'
}

export interface CallDetails {
  sid: string
  status: string
  direction: string
  from: string
  to: string
  duration?: number
  price?: string
  priceUnit?: string
  startTime?: Date
  endTime?: Date
  answeredBy?: string
}

export interface MessageDetails {
  sid: string
  status: string
  from: string
  to: string
  body: string
  numMedia?: number
  mediaUrls?: string[]
  dateCreated: Date
  dateSent?: Date
  dateUpdated?: Date
  errorCode?: number
  errorMessage?: string
  price?: string
  priceUnit?: string
  direction: string
}

export interface PhoneNumberDetails {
  sid: string
  phoneNumber: string
  friendlyName: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
    fax: boolean
  }
  beta: boolean
  statusCallback?: string
  statusCallbackMethod?: string
  voiceUrl?: string
  voiceMethod?: string
  smsUrl?: string
  smsMethod?: string
}

export interface RecordingDetails {
  sid: string
  callSid: string
  status: string
  duration: number
  dateCreated: Date
  accountSid: string
  uri: string
  price?: string
  priceUnit?: string
  channels: number
  source: string
}

export interface TranscriptionDetails {
  sid: string
  recordingSid: string
  status: string
  duration: number
  dateCreated: Date
  dateUpdated: Date
  transcriptionText?: string
  price?: string
  priceUnit?: string
}

export class TwilioService extends LegacyTwilioClient {
  private voiceUrl?: string
  private statusCallbackUrl?: string

  constructor(config: TwilioConfig) {
    super(config)
    this.voiceUrl = config.voiceUrl
    this.statusCallbackUrl = config.statusCallbackUrl
  }

  // Voice Calling Methods
  async makeCall(options: MakeCallOptions): Promise<CallDetails> {
    try {
      const callOptions: any = {
        to: options.to,
        from: options.from || this.phoneNumber,
        statusCallback: options.statusCallback || this.statusCallbackUrl,
        statusCallbackMethod: options.statusCallbackMethod || 'POST',
        statusCallbackEvent: options.statusCallbackEvent || ['initiated', 'ringing', 'answered', 'completed'],
      }

      // Add URL or TwiML
      if (options.twiml) {
        callOptions.twiml = options.twiml
      } else {
        callOptions.url = options.url || this.voiceUrl
      }

      // Recording options
      if (options.record) {
        callOptions.record = true
        if (options.recordingStatusCallback) {
          callOptions.recordingStatusCallback = options.recordingStatusCallback
          callOptions.recordingStatusCallbackMethod = 'POST'
        }
        if (options.recordingChannels) {
          callOptions.recordingChannels = options.recordingChannels
        }
      }

      // Machine detection options
      if (options.machineDetection) {
        callOptions.machineDetection = options.machineDetection
        if (options.machineDetectionTimeout) {
          callOptions.machineDetectionTimeout = options.machineDetectionTimeout
        }
        if (options.asyncAmd) {
          callOptions.asyncAmd = true
          if (options.asyncAmdStatusCallback) {
            callOptions.asyncAmdStatusCallback = options.asyncAmdStatusCallback
            callOptions.asyncAmdStatusCallbackMethod = options.asyncAmdStatusCallbackMethod || 'POST'
          }
        }
      }

      const call = await this.client.calls.create(callOptions)

      return {
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        price: call.price,
        priceUnit: call.priceUnit,
      }
    } catch (error) {
      console.error('Error making call:', error)
      throw error
    }
  }

  async getCall(callSid: string): Promise<CallDetails> {
    try {
      const call = await this.client.calls(callSid).fetch()
      
      return {
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
        duration: call.duration,
        price: call.price,
        priceUnit: call.priceUnit,
        startTime: call.startTime,
        endTime: call.endTime,
        answeredBy: call.answeredBy,
      }
    } catch (error) {
      console.error('Error fetching call:', error)
      throw error
    }
  }

  async listCalls(params?: {
    status?: string
    from?: string
    to?: string
    startTime?: Date
    endTime?: Date
    limit?: number
  }): Promise<CallDetails[]> {
    try {
      const calls = await this.client.calls.list({
        status: params?.status,
        from: params?.from,
        to: params?.to,
        startTime: params?.startTime,
        endTime: params?.endTime,
        limit: params?.limit || 50,
      })

      return calls.map(call => ({
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
        duration: call.duration,
        price: call.price,
        priceUnit: call.priceUnit,
        startTime: call.startTime,
        endTime: call.endTime,
      }))
    } catch (error) {
      console.error('Error listing calls:', error)
      throw error
    }
  }

  async updateCall(callSid: string, updates: {
    status?: 'canceled' | 'completed'
    twiml?: string
    url?: string
  }): Promise<CallDetails> {
    try {
      const call = await this.client.calls(callSid).update(updates)
      
      return {
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
      }
    } catch (error) {
      console.error('Error updating call:', error)
      throw error
    }
  }

  // Enhanced SMS Methods
  async sendSMSEnhanced(options: SendSMSOptions): Promise<MessageDetails> {
    try {
      const messageOptions: any = {
        body: options.body,
        from: this.phoneNumber,
        to: options.to,
      }

      if (options.mediaUrl) {
        messageOptions.mediaUrl = options.mediaUrl
      }

      if (options.statusCallback) {
        messageOptions.statusCallback = options.statusCallback
      }

      if (options.scheduleSend && options.scheduleSend > new Date()) {
        messageOptions.sendAt = options.scheduleSend.toISOString()
        messageOptions.scheduleType = 'fixed'
      }

      const message = await this.client.messages.create(messageOptions)

      return {
        sid: message.sid,
        status: message.status,
        from: message.from,
        to: message.to,
        body: message.body,
        numMedia: message.numMedia,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        price: message.price,
        priceUnit: message.priceUnit,
        direction: message.direction,
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      throw error
    }
  }

  async getMessageDetails(messageSid: string): Promise<MessageDetails> {
    try {
      const message = await this.client.messages(messageSid).fetch()
      
      const mediaUrls: string[] = []
      if (message.numMedia > 0) {
        const media = await this.client.messages(messageSid).media.list()
        mediaUrls.push(...media.map(m => m.uri))
      }

      return {
        sid: message.sid,
        status: message.status,
        from: message.from,
        to: message.to,
        body: message.body,
        numMedia: message.numMedia,
        mediaUrls,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        price: message.price,
        priceUnit: message.priceUnit,
        direction: message.direction,
      }
    } catch (error) {
      console.error('Error fetching message details:', error)
      throw error
    }
  }

  // Phone Number Management
  async listPhoneNumbers(): Promise<PhoneNumberDetails[]> {
    try {
      const numbers = await this.client.incomingPhoneNumbers.list()
      
      return numbers.map(number => ({
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        capabilities: {
          voice: number.capabilities.voice,
          sms: number.capabilities.sms,
          mms: number.capabilities.mms,
          fax: number.capabilities.fax,
        },
        beta: number.beta,
        statusCallback: number.statusCallback,
        statusCallbackMethod: number.statusCallbackMethod,
        voiceUrl: number.voiceUrl,
        voiceMethod: number.voiceMethod,
        smsUrl: number.smsUrl,
        smsMethod: number.smsMethod,
      }))
    } catch (error) {
      console.error('Error listing phone numbers:', error)
      throw error
    }
  }

  async purchasePhoneNumber(options: {
    phoneNumber?: string
    areaCode?: string
    contains?: string
    smsEnabled?: boolean
    voiceEnabled?: boolean
    mmsEnabled?: boolean
  }): Promise<PhoneNumberDetails> {
    try {
      // Search for available numbers
      const searchParams: any = {
        smsEnabled: options.smsEnabled !== false,
        voiceEnabled: options.voiceEnabled !== false,
        mmsEnabled: options.mmsEnabled,
      }

      if (options.phoneNumber) {
        searchParams.phoneNumber = options.phoneNumber
      } else if (options.areaCode) {
        searchParams.areaCode = options.areaCode
      } else if (options.contains) {
        searchParams.contains = options.contains
      }

      const availableNumbers = await this.client.availablePhoneNumbers('US')
        .local
        .list({ limit: 1, ...searchParams })

      if (availableNumbers.length === 0) {
        throw new Error('No available phone numbers found matching criteria')
      }

      // Purchase the first available number
      const purchased = await this.client.incomingPhoneNumbers.create({
        phoneNumber: availableNumbers[0].phoneNumber,
        voiceUrl: this.voiceUrl,
        smsUrl: `${this.statusCallbackUrl}/webhooks/sms`,
        statusCallback: this.statusCallbackUrl,
      })

      return {
        sid: purchased.sid,
        phoneNumber: purchased.phoneNumber,
        friendlyName: purchased.friendlyName,
        capabilities: {
          voice: purchased.capabilities.voice,
          sms: purchased.capabilities.sms,
          mms: purchased.capabilities.mms,
          fax: purchased.capabilities.fax,
        },
        beta: purchased.beta,
        voiceUrl: purchased.voiceUrl,
        smsUrl: purchased.smsUrl,
      }
    } catch (error) {
      console.error('Error purchasing phone number:', error)
      throw error
    }
  }

  async releasePhoneNumber(phoneNumberSid: string): Promise<void> {
    try {
      await this.client.incomingPhoneNumbers(phoneNumberSid).remove()
    } catch (error) {
      console.error('Error releasing phone number:', error)
      throw error
    }
  }

  async updatePhoneNumber(phoneNumberSid: string, updates: {
    friendlyName?: string
    voiceUrl?: string
    smsUrl?: string
    statusCallback?: string
  }): Promise<PhoneNumberDetails> {
    try {
      const updated = await this.client.incomingPhoneNumbers(phoneNumberSid).update(updates)
      
      return {
        sid: updated.sid,
        phoneNumber: updated.phoneNumber,
        friendlyName: updated.friendlyName,
        capabilities: {
          voice: updated.capabilities.voice,
          sms: updated.capabilities.sms,
          mms: updated.capabilities.mms,
          fax: updated.capabilities.fax,
        },
        beta: updated.beta,
        voiceUrl: updated.voiceUrl,
        smsUrl: updated.smsUrl,
      }
    } catch (error) {
      console.error('Error updating phone number:', error)
      throw error
    }
  }

  // Recording and Transcription
  async getRecording(recordingSid: string): Promise<RecordingDetails> {
    try {
      const recording = await this.client.recordings(recordingSid).fetch()
      
      return {
        sid: recording.sid,
        callSid: recording.callSid,
        status: recording.status,
        duration: parseInt(recording.duration),
        dateCreated: recording.dateCreated,
        accountSid: recording.accountSid,
        uri: recording.uri,
        price: recording.price,
        priceUnit: recording.priceUnit,
        channels: recording.channels,
        source: recording.source,
      }
    } catch (error) {
      console.error('Error fetching recording:', error)
      throw error
    }
  }

  async getRecordingUrl(recordingSid: string, format: 'mp3' | 'wav' = 'mp3'): Promise<string> {
    return `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Recordings/${recordingSid}.${format}`
  }

  async deleteRecording(recordingSid: string): Promise<void> {
    try {
      await this.client.recordings(recordingSid).remove()
    } catch (error) {
      console.error('Error deleting recording:', error)
      throw error
    }
  }

  async transcribeRecording(recordingSid: string, callbackUrl?: string): Promise<void> {
    try {
      await this.client.transcriptions.create({
        recordingSid,
        statusCallback: callbackUrl,
      })
    } catch (error) {
      console.error('Error creating transcription:', error)
      throw error
    }
  }

  async getTranscription(transcriptionSid: string): Promise<TranscriptionDetails> {
    try {
      const transcription = await this.client.transcriptions(transcriptionSid).fetch()
      
      return {
        sid: transcription.sid,
        recordingSid: transcription.recordingSid,
        status: transcription.status,
        duration: parseInt(transcription.duration),
        dateCreated: transcription.dateCreated,
        dateUpdated: transcription.dateUpdated,
        transcriptionText: transcription.transcriptionText,
        price: transcription.price,
        priceUnit: transcription.priceUnit,
      }
    } catch (error) {
      console.error('Error fetching transcription:', error)
      throw error
    }
  }

  // Webhook Handlers
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, any>,
    authToken?: string
  ): boolean {
    return twilio.validateRequest(
      authToken || this.authToken,
      signature,
      url,
      params
    )
  }

  processVoiceWebhook(body: any): {
    callSid: string
    from: string
    to: string
    callStatus: string
    direction: string
    answeredBy?: string
    forwardedFrom?: string
    callerName?: string
    parentCallSid?: string
  } {
    return {
      callSid: body.CallSid,
      from: body.From,
      to: body.To,
      callStatus: body.CallStatus,
      direction: body.Direction,
      answeredBy: body.AnsweredBy,
      forwardedFrom: body.ForwardedFrom,
      callerName: body.CallerName,
      parentCallSid: body.ParentCallSid,
    }
  }

  processRecordingWebhook(body: any): {
    recordingSid: string
    callSid: string
    recordingUrl: string
    recordingStatus: string
    recordingDuration: number
    recordingChannels: number
    recordingSource: string
  } {
    return {
      recordingSid: body.RecordingSid,
      callSid: body.CallSid,
      recordingUrl: body.RecordingUrl,
      recordingStatus: body.RecordingStatus,
      recordingDuration: parseInt(body.RecordingDuration),
      recordingChannels: parseInt(body.RecordingChannels),
      recordingSource: body.RecordingSource,
    }
  }

  // TwiML Generation Helpers
  generateVoiceResponse(options: {
    say?: string
    play?: string
    gather?: {
      numDigits?: number
      timeout?: number
      finishOnKey?: string
      action?: string
      method?: 'GET' | 'POST'
      speechTimeout?: string
      input?: 'dtmf' | 'speech' | 'dtmf speech'
      hints?: string
    }
    record?: {
      maxLength?: number
      timeout?: number
      finishOnKey?: string
      recordingStatusCallback?: string
      transcribe?: boolean
      transcribeCallback?: string
    }
    dial?: {
      number?: string
      conference?: string
      callerId?: string
      record?: 'do-not-record' | 'record-from-answer' | 'record-from-answer-dual'
      recordingStatusCallback?: string
    }
    redirect?: string
    hangup?: boolean
  }): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response = new VoiceResponse()

    if (options.say) {
      response.say(options.say)
    }

    if (options.play) {
      response.play(options.play)
    }

    if (options.gather) {
      const gather = response.gather(options.gather)
      if (options.say) {
        gather.say(options.say)
      }
    }

    if (options.record) {
      response.record(options.record)
    }

    if (options.dial) {
      const dial = response.dial({
        callerId: options.dial.callerId,
        record: options.dial.record,
        recordingStatusCallback: options.dial.recordingStatusCallback,
      })
      
      if (options.dial.number) {
        dial.number(options.dial.number)
      }
      
      if (options.dial.conference) {
        dial.conference(options.dial.conference)
      }
    }

    if (options.redirect) {
      response.redirect(options.redirect)
    }

    if (options.hangup) {
      response.hangup()
    }

    return response.toString()
  }

  // Recruiting-specific Voice Features
  async makeRecruitingCall(options: {
    candidatePhone: string
    candidateName: string
    type: 'screening' | 'reminder' | 'offer' | 'follow_up'
    interviewDetails?: {
      date: Date
      time: string
      position: string
      interviewerName: string
    }
    offerDetails?: {
      position: string
      salary: string
      startDate: string
    }
    recordCall?: boolean
  }): Promise<CallDetails> {
    let twiml = ''
    
    switch (options.type) {
      case 'screening':
        twiml = this.generateVoiceResponse({
          say: `Hello ${options.candidateName}, this is The Well Recruiting Solutions. We received your application and would like to schedule a screening interview. Press 1 if you're interested, or press 2 if you need more information.`,
          gather: {
            numDigits: 1,
            timeout: 10,
            action: '/api/twilio/screening-response',
          },
        })
        break
        
      case 'reminder':
        if (!options.interviewDetails) throw new Error('Interview details required for reminder calls')
        twiml = this.generateVoiceResponse({
          say: `Hello ${options.candidateName}, this is a reminder about your interview for the ${options.interviewDetails.position} position on ${options.interviewDetails.date.toLocaleDateString()} at ${options.interviewDetails.time} with ${options.interviewDetails.interviewerName}. Press 1 to confirm, or press 2 to reschedule.`,
          gather: {
            numDigits: 1,
            timeout: 10,
            action: '/api/twilio/reminder-response',
          },
        })
        break
        
      case 'offer':
        if (!options.offerDetails) throw new Error('Offer details required for offer calls')
        twiml = this.generateVoiceResponse({
          say: `Hello ${options.candidateName}, congratulations! We're pleased to offer you the ${options.offerDetails.position} position with a salary of ${options.offerDetails.salary}, starting on ${options.offerDetails.startDate}. This call is being recorded. Press 1 to accept verbally, press 2 to request written details, or press 3 to decline.`,
          gather: {
            numDigits: 1,
            timeout: 15,
            action: '/api/twilio/offer-response',
          },
          record: options.recordCall ? {
            maxLength: 300,
            recordingStatusCallback: '/api/twilio/recording-complete',
          } : undefined,
        })
        break
        
      case 'follow_up':
        twiml = this.generateVoiceResponse({
          say: `Hello ${options.candidateName}, this is The Well Recruiting Solutions following up on your recent interview. Press 1 to hear an update on your application, or press 2 to speak with a recruiter.`,
          gather: {
            numDigits: 1,
            timeout: 10,
            action: '/api/twilio/followup-response',
          },
        })
        break
    }

    return await this.makeCall({
      to: options.candidatePhone,
      twiml,
      record: options.recordCall,
      statusCallback: '/api/twilio/call-status',
    })
  }

  // Conference Calling for Group Interviews
  async createConferenceCall(options: {
    conferenceName: string
    participants: Array<{
      phone: string
      name: string
      role: 'interviewer' | 'candidate'
    }>
    startTime?: Date
    endTime?: Date
    record?: boolean
    waitUrl?: string
  }): Promise<{
    conferenceName: string
    participants: Array<{
      phone: string
      callSid: string
      status: string
    }>
  }> {
    const results = []
    
    for (const participant of options.participants) {
      const twiml = this.generateVoiceResponse({
        say: `Hello ${participant.name}, you're being connected to the conference call.`,
        dial: {
          conference: options.conferenceName,
          record: options.record ? 'record-from-answer' : 'do-not-record',
          recordingStatusCallback: options.record ? '/api/twilio/conference-recording' : undefined,
        },
      })
      
      try {
        const call = await this.makeCall({
          to: participant.phone,
          twiml,
        })
        
        results.push({
          phone: participant.phone,
          callSid: call.sid,
          status: call.status,
        })
      } catch (error) {
        results.push({
          phone: participant.phone,
          callSid: '',
          status: 'failed',
        })
      }
    }
    
    return {
      conferenceName: options.conferenceName,
      participants: results,
    }
  }

  // IVR System for Candidate Screening
  async setupIVRSystem(phoneNumberSid: string): Promise<void> {
    const ivrUrl = `${this.statusCallbackUrl}/api/twilio/ivr`
    
    await this.updatePhoneNumber(phoneNumberSid, {
      voiceUrl: ivrUrl,
      statusCallback: `${this.statusCallbackUrl}/api/twilio/call-status`,
    })
  }

  generateIVRResponse(options: {
    step: 'welcome' | 'main_menu' | 'application_status' | 'schedule_interview' | 'leave_message' | 'transfer'
    candidatePhone?: string
  }): string {
    const response = new twilio.twiml.VoiceResponse()
    
    switch (options.step) {
      case 'welcome':
        response.say('Welcome to The Well Recruiting Solutions.')
        response.redirect('/api/twilio/ivr?step=main_menu')
        break
        
      case 'main_menu':
        response.say('Press 1 to check your application status. Press 2 to schedule an interview. Press 3 to leave a message. Press 0 to speak with a recruiter.')
        response.gather({
          numDigits: 1,
          timeout: 10,
          action: '/api/twilio/ivr-selection',
        })
        break
        
      case 'application_status':
        response.say('Please enter your 6-digit application ID followed by the pound key.')
        response.gather({
          numDigits: 6,
          finishOnKey: '#',
          timeout: 15,
          action: '/api/twilio/check-application',
        })
        break
        
      case 'schedule_interview':
        response.say('To schedule an interview, please leave your name and preferred time after the beep.')
        response.record({
          maxLength: 60,
          transcribe: true,
          transcribeCallback: '/api/twilio/transcription-complete',
        })
        break
        
      case 'leave_message':
        response.say('Please leave your message after the beep.')
        response.record({
          maxLength: 120,
          transcribe: true,
          transcribeCallback: '/api/twilio/transcription-complete',
        })
        break
        
      case 'transfer':
        response.say('Connecting you to a recruiter.')
        response.dial('+1234567890') // Replace with actual recruiter number
        break
    }
    
    return response.toString()
  }

  // Usage Analytics
  async getUsageStatistics(startDate: Date, endDate: Date): Promise<{
    calls: {
      total: number
      inbound: number
      outbound: number
      totalDuration: number
      totalCost: number
    }
    messages: {
      total: number
      sent: number
      received: number
      totalCost: number
    }
    recordings: {
      total: number
      totalDuration: number
      totalCost: number
    }
  }> {
    try {
      // Get call statistics
      const calls = await this.listCalls({
        startTime: startDate,
        endTime: endDate,
      })
      
      const callStats = {
        total: calls.length,
        inbound: calls.filter(c => c.direction.includes('inbound')).length,
        outbound: calls.filter(c => c.direction.includes('outbound')).length,
        totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
        totalCost: calls.reduce((sum, c) => sum + (parseFloat(c.price || '0')), 0),
      }
      
      // Get message statistics
      const messages = await this.getMessages({
        dateSentAfter: startDate,
        dateSentBefore: endDate,
      })
      
      const messageStats = {
        total: messages.length,
        sent: messages.filter((m: any) => m.direction === 'outbound-api').length,
        received: messages.filter((m: any) => m.direction === 'inbound').length,
        totalCost: messages.reduce((sum: number, m: any) => sum + (parseFloat(m.price || '0')), 0),
      }
      
      // Get recording statistics
      const recordings = await this.client.recordings.list({
        dateCreatedAfter: startDate,
        dateCreatedBefore: endDate,
      })
      
      const recordingStats = {
        total: recordings.length,
        totalDuration: recordings.reduce((sum, r) => sum + parseInt(r.duration), 0),
        totalCost: recordings.reduce((sum, r) => sum + (parseFloat(r.price || '0')), 0),
      }
      
      return {
        calls: callStats,
        messages: messageStats,
        recordings: recordingStats,
      }
    } catch (error) {
      console.error('Error getting usage statistics:', error)
      throw error
    }
  }
}

// Export a factory function for creating instances
export function createTwilioService(config?: Partial<TwilioConfig>): TwilioService {
  const fullConfig: TwilioConfig = {
    accountSid: config?.accountSid || process.env.TWILIO_ACCOUNT_SID || '',
    authToken: config?.authToken || process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: config?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || '',
    voiceUrl: config?.voiceUrl || process.env.TWILIO_VOICE_URL,
    statusCallbackUrl: config?.statusCallbackUrl || process.env.TWILIO_STATUS_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL,
  }
  
  if (!fullConfig.accountSid || !fullConfig.authToken || !fullConfig.phoneNumber) {
    throw new Error('Twilio configuration incomplete. Please check environment variables.')
  }
  
  return new TwilioService(fullConfig)
}