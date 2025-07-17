import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import twilio from 'twilio'
import { withRateLimit } from '@/middleware/rate-limit'

export const POST = withRateLimit(async (request: NextRequest) => {
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
    
    // Process the webhook
    const webhookData = twilioService.processVoiceWebhook(params)
    
    // Generate TwiML response based on call status
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response = new VoiceResponse()
    
    switch (webhookData.callStatus) {
      case 'initiated':
        response.say('Welcome to The Well Recruiting Solutions. Please hold while we process your request.')
        break
        
      case 'ringing':
        // Call is ringing, no action needed
        break
        
      case 'answered':
        response.say('Thank you for calling. How can we help you today?')
        response.gather({
          numDigits: 1,
          timeout: 10,
          action: '/api/twilio/webhooks/ivr-handler',
        })
        break
        
      case 'completed':
        // Call completed, log the interaction
        console.log('Call completed:', webhookData)
        break
        
      default:
        response.say('Thank you for calling The Well Recruiting Solutions.')
        response.hangup()
    }
    
    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('Voice webhook error:', error)
    
    // Return a basic TwiML response even on error
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
}, 'webhook')