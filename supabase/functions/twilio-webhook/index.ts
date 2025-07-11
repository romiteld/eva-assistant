import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import twilio from 'https://esm.sh/twilio@4.19.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioWebhookBody {
  MessageSid?: string
  AccountSid?: string
  From?: string
  To?: string
  Body?: string
  NumMedia?: string
  MessageStatus?: string
  ErrorCode?: string
  ErrorMessage?: string
  CallSid?: string
  CallStatus?: string
  Direction?: string
  AnsweredBy?: string
  RecordingSid?: string
  RecordingUrl?: string
  RecordingStatus?: string
  RecordingDuration?: string
  TranscriptionSid?: string
  TranscriptionText?: string
  TranscriptionStatus?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the webhook signature
    const signature = req.headers.get('X-Twilio-Signature')
    if (!signature) {
      return new Response('Unauthorized: Missing signature', { status: 401 })
    }
    
    // Get the request body
    const formData = await req.formData()
    const body: TwilioWebhookBody = {}
    for (const [key, value] of formData.entries()) {
      body[key as keyof TwilioWebhookBody] = value as string
    }
    
    // Validate the webhook signature
    const url = req.url
    const params = Object.fromEntries(formData.entries())
    const isValid = twilio.validateRequest(
      twilioAuthToken,
      signature,
      url,
      params
    )
    
    if (!isValid) {
      return new Response('Unauthorized: Invalid signature', { status: 401 })
    }
    
    // Store the webhook event
    const { error: eventError } = await supabase
      .from('twilio_webhook_events')
      .insert({
        event_type: body.MessageSid ? 'message' : body.CallSid ? 'call' : body.RecordingSid ? 'recording' : 'unknown',
        resource_type: body.MessageSid ? 'message' : body.CallSid ? 'call' : body.RecordingSid ? 'recording' : 'unknown',
        resource_sid: body.MessageSid || body.CallSid || body.RecordingSid || 'unknown',
        account_sid: body.AccountSid || 'unknown',
        payload: body,
        processed: false,
      })
    
    if (eventError) {
      console.error('Error storing webhook event:', eventError)
    }
    
    // Process different webhook types
    if (body.MessageSid && body.MessageStatus) {
      // SMS status update
      await handleSMSStatusUpdate(supabase, body)
    } else if (body.MessageSid && body.Body) {
      // Incoming SMS
      await handleIncomingSMS(supabase, body)
    } else if (body.CallSid && body.CallStatus) {
      // Call status update
      await handleCallStatusUpdate(supabase, body)
    } else if (body.RecordingSid && body.RecordingStatus) {
      // Recording status update
      await handleRecordingStatusUpdate(supabase, body)
    } else if (body.TranscriptionSid && body.TranscriptionStatus) {
      // Transcription status update
      await handleTranscriptionStatusUpdate(supabase, body)
    }
    
    // Return TwiML response for incoming messages/calls
    if (body.MessageSid && body.Body && !body.MessageStatus) {
      const twiml = new twilio.twiml.MessagingResponse()
      twiml.message('Thank you for your message. A recruiter will get back to you soon.')
      
      return new Response(twiml.toString(), {
        headers: {
          'Content-Type': 'text/xml',
          ...corsHeaders,
        },
      })
    } else if (body.CallSid && body.Direction === 'inbound' && !body.CallStatus) {
      const twiml = new twilio.twiml.VoiceResponse()
      twiml.say('Welcome to The Well Recruiting Solutions. Please hold while we connect you to a recruiter.')
      twiml.dial('+1234567890') // Replace with actual recruiter number
      
      return new Response(twiml.toString(), {
        headers: {
          'Content-Type': 'text/xml',
          ...corsHeaders,
        },
      })
    }
    
    return new Response('OK', {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    })
  }
})

async function handleSMSStatusUpdate(supabase: any, body: TwilioWebhookBody) {
  const { error } = await supabase
    .from('twilio_messages')
    .update({
      status: body.MessageStatus,
      error_code: body.ErrorCode ? parseInt(body.ErrorCode) : null,
      error_message: body.ErrorMessage,
      date_updated: new Date().toISOString(),
    })
    .eq('sid', body.MessageSid)
  
  if (error) {
    console.error('Error updating message status:', error)
  }
}

async function handleIncomingSMS(supabase: any, body: TwilioWebhookBody) {
  // First, try to find the user associated with this phone number
  const { data: phoneNumber } = await supabase
    .from('twilio_phone_numbers')
    .select('user_id')
    .eq('phone_number', body.To)
    .single()
  
  if (phoneNumber) {
    const { error } = await supabase
      .from('twilio_messages')
      .insert({
        sid: body.MessageSid,
        user_id: phoneNumber.user_id,
        from_number: body.From,
        to_number: body.To,
        body: body.Body,
        status: 'received',
        direction: 'inbound',
        num_media: body.NumMedia ? parseInt(body.NumMedia) : 0,
        date_created: new Date().toISOString(),
        date_sent: new Date().toISOString(),
      })
    
    if (error) {
      console.error('Error storing incoming message:', error)
    }
  }
}

async function handleCallStatusUpdate(supabase: any, body: TwilioWebhookBody) {
  const updates: any = {
    status: body.CallStatus,
    answered_by: body.AnsweredBy,
    date_updated: new Date().toISOString(),
  }
  
  if (body.CallStatus === 'completed') {
    updates.end_time = new Date().toISOString()
  }
  
  const { error } = await supabase
    .from('twilio_calls')
    .update(updates)
    .eq('sid', body.CallSid)
  
  if (error) {
    console.error('Error updating call status:', error)
  }
}

async function handleRecordingStatusUpdate(supabase: any, body: TwilioWebhookBody) {
  // First, get the call associated with this recording
  const { data: recording } = await supabase
    .from('twilio_recordings')
    .select('user_id, call_sid')
    .eq('sid', body.RecordingSid)
    .single()
  
  if (!recording) {
    // If recording doesn't exist, we need to get the call first
    const { data: call } = await supabase
      .from('twilio_calls')
      .select('user_id')
      .eq('sid', body.CallSid)
      .single()
    
    if (call) {
      const { error } = await supabase
        .from('twilio_recordings')
        .insert({
          sid: body.RecordingSid,
          call_sid: body.CallSid,
          user_id: call.user_id,
          status: body.RecordingStatus,
          duration: body.RecordingDuration ? parseInt(body.RecordingDuration) : 0,
          uri: body.RecordingUrl || '',
          date_created: new Date().toISOString(),
        })
      
      if (error) {
        console.error('Error storing recording:', error)
      }
      
      // Update the call with the recording SID
      await supabase
        .from('twilio_calls')
        .update({ recording_sid: body.RecordingSid })
        .eq('sid', body.CallSid)
    }
  } else {
    // Update existing recording
    const { error } = await supabase
      .from('twilio_recordings')
      .update({
        status: body.RecordingStatus,
        uri: body.RecordingUrl || recording.uri,
        date_updated: new Date().toISOString(),
      })
      .eq('sid', body.RecordingSid)
    
    if (error) {
      console.error('Error updating recording:', error)
    }
  }
}

async function handleTranscriptionStatusUpdate(supabase: any, body: TwilioWebhookBody) {
  // First check if transcription exists
  const { data: existing } = await supabase
    .from('twilio_transcriptions')
    .select('id')
    .eq('sid', body.TranscriptionSid)
    .single()
  
  if (!existing) {
    // Get the recording this transcription belongs to
    const recordingSid = body.RecordingSid || ''
    const { data: recording } = await supabase
      .from('twilio_recordings')
      .select('user_id')
      .eq('sid', recordingSid)
      .single()
    
    if (recording) {
      const { error } = await supabase
        .from('twilio_transcriptions')
        .insert({
          sid: body.TranscriptionSid,
          recording_sid: recordingSid,
          user_id: recording.user_id,
          status: body.TranscriptionStatus,
          transcription_text: body.TranscriptionText,
          duration: 0, // Will be updated later
          date_created: new Date().toISOString(),
        })
      
      if (error) {
        console.error('Error storing transcription:', error)
      }
      
      // Update the call with the transcription SID
      const { data: recordingData } = await supabase
        .from('twilio_recordings')
        .select('call_sid')
        .eq('sid', recordingSid)
        .single()
      
      if (recordingData) {
        await supabase
          .from('twilio_calls')
          .update({ transcription_sid: body.TranscriptionSid })
          .eq('sid', recordingData.call_sid)
      }
    }
  } else {
    // Update existing transcription
    const { error } = await supabase
      .from('twilio_transcriptions')
      .update({
        status: body.TranscriptionStatus,
        transcription_text: body.TranscriptionText,
        date_updated: new Date().toISOString(),
      })
      .eq('sid', body.TranscriptionSid)
    
    if (error) {
      console.error('Error updating transcription:', error)
    }
  }
}