import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { broadcastTwilioEvent, formatSMSEvent } from '@/lib/utils/twilio-broadcast'
import { withRateLimit } from '@/middleware/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    
    if (!isValid && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }
    
    // Extract message data
    const messageData = {
      message_sid: params.MessageSid,
      account_sid: params.AccountSid,
      from_number: params.From,
      from_city: params.FromCity,
      from_state: params.FromState,
      from_country: params.FromCountry,
      to_number: params.To,
      body: params.Body,
      num_media: params.NumMedia ? parseInt(params.NumMedia) : 0,
      media_urls: extractMediaUrls(params),
      status: params.SmsStatus || params.MessageStatus,
      direction: 'inbound',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Store message in database
    const { data: savedMessage, error } = await supabase
      .from('twilio_messages')
      .insert([messageData])
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
    }
    
    // Broadcast real-time update
    await broadcastTwilioEvent('sms:received', formatSMSEvent(params))
    
    // Process automated responses
    const MessagingResponse = twilio.twiml.MessagingResponse
    const response = new MessagingResponse()
    
    // Check for keywords and handle accordingly
    const bodyLower = messageData.body.toLowerCase()
    
    if (bodyLower.includes('stop') || bodyLower.includes('unsubscribe')) {
      // Handle opt-out
      await handleOptOut(messageData.from_number)
      response.message('You have been unsubscribed from The Well Recruiting Solutions. Reply START to resubscribe.')
    } else if (bodyLower.includes('start') || bodyLower.includes('subscribe')) {
      // Handle opt-in
      await handleOptIn(messageData.from_number)
      response.message('Welcome back! You are now subscribed to messages from The Well Recruiting Solutions.')
    } else if (bodyLower.includes('status') || bodyLower.includes('application')) {
      // Application status inquiry
      response.message('To check your application status, please visit our portal at portal.thewell.solutions or call us at 1-800-RECRUIT.')
    } else if (bodyLower.includes('interview') || bodyLower.includes('schedule')) {
      // Interview scheduling
      response.message('Thank you for your interest in scheduling an interview. A recruiter will contact you within 24 hours. For immediate assistance, call 1-800-RECRUIT.')
    } else if (bodyLower.includes('help') || bodyLower === '?') {
      // Help message
      response.message('The Well Recruiting Solutions\n\nKeywords:\n- STATUS: Check application\n- INTERVIEW: Schedule meeting\n- HELP: This message\n- STOP: Unsubscribe\n\nCall: 1-800-RECRUIT')
    } else {
      // Default response with AI processing queue
      await queueForAIProcessing(savedMessage)
      response.message('Thank you for contacting The Well Recruiting Solutions. Your message has been received and will be reviewed by our team shortly.')
    }
    
    // Log automated response
    if (response.toString().includes('<Message>')) {
      await logAutomatedResponse(messageData.message_sid, response.toString())
    }
    
    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('SMS webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}, 'webhook')

function extractMediaUrls(params: Record<string, any>): string[] {
  const urls: string[] = []
  const numMedia = parseInt(params.NumMedia || '0')
  
  for (let i = 0; i < numMedia; i++) {
    const url = params[`MediaUrl${i}`]
    if (url) urls.push(url)
  }
  
  return urls
}

async function handleOptOut(phoneNumber: string) {
  try {
    await supabase
      .from('twilio_opt_outs')
      .upsert([{
        phone_number: phoneNumber,
        opted_out: true,
        opted_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'phone_number'
      })
  } catch (error) {
    console.error('Error handling opt-out:', error)
  }
}

async function handleOptIn(phoneNumber: string) {
  try {
    await supabase
      .from('twilio_opt_outs')
      .upsert([{
        phone_number: phoneNumber,
        opted_out: false,
        opted_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'phone_number'
      })
  } catch (error) {
    console.error('Error handling opt-in:', error)
  }
}

async function queueForAIProcessing(message: any) {
  try {
    await supabase
      .from('twilio_ai_queue')
      .insert([{
        message_id: message.id,
        message_sid: message.message_sid,
        from_number: message.from_number,
        body: message.body,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
  } catch (error) {
    console.error('Error queuing for AI:', error)
  }
}

async function logAutomatedResponse(messageSid: string, response: string) {
  try {
    await supabase
      .from('twilio_automated_responses')
      .insert([{
        original_message_sid: messageSid,
        response_body: response,
        created_at: new Date().toISOString()
      }])
  } catch (error) {
    console.error('Error logging automated response:', error)
  }
}