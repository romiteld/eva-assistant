import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('X-Twilio-Signature') || ''
    const url = request.url
    
    // Parse form data
    const formData = new URLSearchParams(body)
    const params = Object.fromEntries(formData)
    
    // Validate webhook signature
    const twilioService = createTwilioService()
    const isValid = twilioService.validateWebhookSignature(
      signature,
      url,
      params
    )
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }
    
    // Get the user's input
    const digits = params.Digits
    const from = params.From
    
    // Generate TwiML response based on user input
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response = new VoiceResponse()
    
    switch (digits) {
      case '1':
        // Check application status
        response.say('Please enter your 6-digit application ID followed by the pound key.')
        response.gather({
          numDigits: 6,
          finishOnKey: '#',
          timeout: 15,
          action: '/api/twilio/webhooks/check-application',
        })
        break
        
      case '2':
        // Schedule interview
        response.say('To schedule an interview, please leave your name and preferred time after the beep.')
        response.record({
          maxLength: 60,
          transcribe: true,
          transcribeCallback: '/api/twilio/webhooks/transcription',
          action: '/api/twilio/webhooks/schedule-interview',
        })
        break
        
      case '3':
        // Leave message
        response.say('Please leave your message after the beep.')
        response.record({
          maxLength: 120,
          transcribe: true,
          transcribeCallback: '/api/twilio/webhooks/transcription',
          action: '/api/twilio/webhooks/process-message',
        })
        break
        
      case '0':
        // Transfer to recruiter
        response.say('Connecting you to a recruiter. Please hold.')
        response.dial('+1234567890') // Replace with actual recruiter number
        break
        
      default:
        // Invalid input
        response.say('Invalid selection. Please try again.')
        response.redirect('/api/twilio/webhooks/voice')
        break
    }
    
    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('IVR handler error:', error)
    
    // Return error response
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response = new VoiceResponse()
    response.say('We are experiencing technical difficulties. Please try again later.')
    response.hangup()
    
    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}