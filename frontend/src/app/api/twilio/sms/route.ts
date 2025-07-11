import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { supabase } from '@/lib/supabase/browser'

export async function POST(req: NextRequest) {
  try {
    const twilioService = createTwilioService()
    const formData = await req.formData()
    
    // Process incoming SMS webhook
    const body: any = {}
    for (const [key, value] of formData.entries()) {
      body[key] = value
    }
    
    const incomingMessage = twilioService.processIncomingWebhook(body)
    
    // Store in database
    const { data: phoneNumber } = await supabase
      .from('twilio_phone_numbers')
      .select('user_id')
      .eq('phone_number', incomingMessage.to)
      .single()
    
    if (phoneNumber) {
      await supabase
        .from('twilio_messages')
        .insert({
          sid: incomingMessage.messageSid,
          user_id: phoneNumber.user_id,
          from_number: incomingMessage.from,
          to_number: incomingMessage.to,
          body: incomingMessage.body,
          status: 'received',
          direction: 'inbound',
          date_created: new Date().toISOString(),
        })
    }
    
    // Generate auto-response
    const MessagingResponse = require('twilio').twiml.MessagingResponse
    const twiml = new MessagingResponse()
    twiml.message('Thank you for your message. A recruiter will get back to you soon.')
    
    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('Error in SMS webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}