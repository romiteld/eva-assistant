import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'
import { broadcastTwilioEvent, formatCallEvent } from '@/lib/utils/twilio-broadcast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    
    if (!isValid && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }
    
    // Extract call details
    const callData = {
      call_sid: params.CallSid,
      parent_call_sid: params.ParentCallSid,
      account_sid: params.AccountSid,
      from_number: params.From,
      to_number: params.To,
      call_status: params.CallStatus,
      direction: params.Direction,
      timestamp: params.Timestamp,
      api_version: params.ApiVersion,
      forwarded_from: params.ForwardedFrom,
      caller_name: params.CallerName,
      duration: params.CallDuration ? parseInt(params.CallDuration) : null,
      answered_by: params.AnsweredBy,
      price: params.Price,
      price_unit: params.PriceUnit,
      recording_url: params.RecordingUrl,
      recording_sid: params.RecordingSid,
      recording_duration: params.RecordingDuration ? parseInt(params.RecordingDuration) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Store call status in database
    const { error } = await supabase
      .from('twilio_call_logs')
      .upsert([callData], {
        onConflict: 'call_sid',
        ignoreDuplicates: false
      })
    
    if (error) {
      console.error('Database error:', error)
    }
    
    // Broadcast real-time update
    const eventType = params.CallStatus === 'initiated' ? 'call:new' : 
                      params.CallStatus === 'completed' ? 'call:ended' : 'call:status'
    await broadcastTwilioEvent(eventType, formatCallEvent(params))
    
    // Handle specific call statuses
    switch (params.CallStatus) {
      case 'completed':
        // Process completed call
        if (params.RecordingSid) {
          // Queue recording for transcription
          await queueTranscription(params.RecordingSid, params.CallSid)
        }
        break
        
      case 'failed':
      case 'busy':
      case 'no-answer':
        // Handle failed calls
        await handleFailedCall(params)
        break
    }
    
    // Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Call status webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function queueTranscription(recordingSid: string, callSid: string) {
  try {
    // Store transcription request
    await supabase
      .from('twilio_transcription_queue')
      .insert([{
        recording_sid: recordingSid,
        call_sid: callSid,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
    
    // Initiate transcription
    const twilioService = createTwilioService()
    await twilioService.transcribeRecording(
      recordingSid,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/webhooks/transcription`
    )
  } catch (error) {
    console.error('Error queuing transcription:', error)
  }
}

async function handleFailedCall(params: Record<string, any>) {
  try {
    // Log failed call details
    await supabase
      .from('twilio_failed_calls')
      .insert([{
        call_sid: params.CallSid,
        from_number: params.From,
        to_number: params.To,
        status: params.CallStatus,
        reason: params.ErrorMessage || params.CallStatus,
        created_at: new Date().toISOString()
      }])
    
    // TODO: Send notification or retry logic
  } catch (error) {
    console.error('Error handling failed call:', error)
  }
}