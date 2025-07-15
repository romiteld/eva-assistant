import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const ZOOM_WEBHOOK_SECRET_TOKEN = process.env.ZOOM_WEBHOOK_SECRET_TOKEN!

// Verify webhook signature
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-zm-signature')
  const timestamp = request.headers.get('x-zm-request-timestamp')
  
  if (!signature || !timestamp) {
    return false
  }

  const message = `v0:${timestamp}:${body}`
  const hashForVerify = crypto
    .createHmac('sha256', ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest('hex')
  
  const expectedSignature = `v0=${hashForVerify}`
  
  return signature === expectedSignature
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    // Verify webhook signature
    if (!verifyWebhookSignature(request, body)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = JSON.parse(body)
    const supabase = createClient()

    // Handle webhook validation
    if (event.event === 'endpoint.url_validation') {
      const hashForValidate = crypto
        .createHmac('sha256', ZOOM_WEBHOOK_SECRET_TOKEN)
        .update(event.payload.plainToken)
        .digest('hex')

      return NextResponse.json({
        plainToken: event.payload.plainToken,
        encryptedToken: hashForValidate
      })
    }

    // Store webhook event for processing
    const { error: insertError } = await supabase
      .from('zoom_webhook_events')
      .insert({
        event_type: event.event,
        event_ts: new Date(event.event_ts).toISOString(),
        zoom_meeting_id: event.payload?.object?.id || null,
        payload: event,
        processed: false
      })

    if (insertError) {
      console.error('Failed to store webhook event:', insertError)
      return NextResponse.json(
        { error: 'Failed to store event' },
        { status: 500 }
      )
    }

    // Process specific events
    switch (event.event) {
      case 'meeting.started':
        await handleMeetingStarted(event, supabase)
        break
      
      case 'meeting.ended':
        await handleMeetingEnded(event, supabase)
        break
      
      case 'meeting.participant_joined':
        await handleParticipantJoined(event, supabase)
        break
      
      case 'meeting.participant_left':
        await handleParticipantLeft(event, supabase)
        break
      
      case 'recording.completed':
        await handleRecordingCompleted(event, supabase)
        break
      
      default:
        console.log('Unhandled webhook event:', event.event)
    }

    // Mark event as processed
    await supabase
      .from('zoom_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('event_type', event.event)
      .eq('event_ts', new Date(event.event_ts).toISOString())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleMeetingStarted(event: any, supabase: any) {
  const meeting = event.payload.object
  
  // Update meeting status
  await supabase
    .from('zoom_meetings')
    .update({
      status: 'started',
      updated_at: new Date().toISOString()
    })
    .eq('zoom_meeting_id', meeting.id)
}

async function handleMeetingEnded(event: any, supabase: any) {
  const meeting = event.payload.object
  
  // Update meeting status
  await supabase
    .from('zoom_meetings')
    .update({
      status: 'ended',
      updated_at: new Date().toISOString()
    })
    .eq('zoom_meeting_id', meeting.id)
}

async function handleParticipantJoined(event: any, supabase: any) {
  const { meeting_id } = event.payload.object
  const participant = event.payload.object.participant
  
  // Get current participants
  const { data: meetingData } = await supabase
    .from('zoom_meetings')
    .select('participants')
    .eq('zoom_meeting_id', meeting_id)
    .single()
  
  if (meetingData) {
    const participants = meetingData.participants || []
    participants.push({
      id: participant.id,
      user_id: participant.user_id,
      name: participant.user_name,
      email: participant.email,
      join_time: new Date().toISOString(),
      leave_time: null,
      duration: 0
    })
    
    await supabase
      .from('zoom_meetings')
      .update({
        participants,
        updated_at: new Date().toISOString()
      })
      .eq('zoom_meeting_id', meeting_id)
  }
}

async function handleParticipantLeft(event: any, supabase: any) {
  const { meeting_id } = event.payload.object
  const participant = event.payload.object.participant
  
  // Get current participants
  const { data: meetingData } = await supabase
    .from('zoom_meetings')
    .select('participants')
    .eq('zoom_meeting_id', meeting_id)
    .single()
  
  if (meetingData) {
    const participants = meetingData.participants || []
    const updatedParticipants = participants.map((p: any) => {
      if (p.id === participant.id) {
        const leaveTime = new Date()
        const joinTime = new Date(p.join_time)
        const duration = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000)
        
        return {
          ...p,
          leave_time: leaveTime.toISOString(),
          duration
        }
      }
      return p
    })
    
    await supabase
      .from('zoom_meetings')
      .update({
        participants: updatedParticipants,
        updated_at: new Date().toISOString()
      })
      .eq('zoom_meeting_id', meeting_id)
  }
}

async function handleRecordingCompleted(event: any, supabase: any) {
  const meeting = event.payload.object
  const recordingFiles = meeting.recording_files || []
  
  // Update meeting with recording URLs
  const recordingUrls = recordingFiles.map((file: any) => ({
    id: file.id,
    file_type: file.file_type,
    file_size: file.file_size,
    download_url: file.download_url,
    play_url: file.play_url,
    recording_type: file.recording_type,
    recording_start: file.recording_start,
    recording_end: file.recording_end
  }))
  
  await supabase
    .from('zoom_meetings')
    .update({
      recording_urls: recordingUrls,
      updated_at: new Date().toISOString()
    })
    .eq('zoom_meeting_id', meeting.id)
}