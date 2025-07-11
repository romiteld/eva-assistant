import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'

export async function POST(req: NextRequest) {
  try {
    const twilioService = createTwilioService()
    
    // Generate a simple voice response
    const twiml = twilioService.generateVoiceResponse({
      say: 'Hello from The Well Recruiting Solutions. This is your AI recruiting assistant.',
      gather: {
        numDigits: 1,
        timeout: 10,
        action: '/api/twilio/voice/gather',
        speechTimeout: 'auto',
        input: 'dtmf speech',
        hints: 'yes, no, representative',
      },
    })
    
    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('Error in voice webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}