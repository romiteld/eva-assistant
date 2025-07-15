import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

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
    
    // Process the recording webhook
    const recordingData = twilioService.processRecordingWebhook(params)
    
    // Store recording metadata in database
    const recordingMetadata = {
      recording_sid: recordingData.recordingSid,
      call_sid: recordingData.callSid,
      recording_url: recordingData.recordingUrl,
      recording_status: recordingData.recordingStatus,
      recording_duration: recordingData.recordingDuration,
      recording_channels: recordingData.recordingChannels,
      recording_source: recordingData.recordingSource,
      storage_path: null, // Will be updated after storage
      transcription_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: savedRecording, error: dbError } = await supabase
      .from('twilio_recordings')
      .insert([recordingMetadata])
      .select()
      .single()
    
    if (dbError) {
      console.error('Database error:', dbError)
    }
    
    // Process completed recordings
    if (recordingData.recordingStatus === 'completed') {
      try {
        // Download and store recording in Supabase Storage
        const storagePath = await storeRecording(recordingData)
        
        // Update database with storage path
        if (storagePath && savedRecording) {
          await supabase
            .from('twilio_recordings')
            .update({ storage_path: storagePath })
            .eq('id', savedRecording.id)
        }
        
        // Queue for transcription
        const transcriptionCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/webhooks/transcription`
        await twilioService.transcribeRecording(
          recordingData.recordingSid,
          transcriptionCallback
        )
        
        // Check if this is a conference recording
        const callData = await twilioService.getCall(recordingData.callSid)
        if (callData.to?.includes('conference')) {
          await handleConferenceRecording(recordingData, callData)
        }
        
        // Check if this is an interview recording
        await checkAndNotifyInterview(recordingData.callSid)
        
      } catch (error) {
        console.error('Recording processing error:', error)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Recording webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function storeRecording(recordingData: any): Promise<string | null> {
  try {
    const twilioService = createTwilioService()
    const recordingUrl = await twilioService.getRecordingUrl(recordingData.recordingSid, 'mp3')
    
    // Fetch recording from Twilio
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch recording')
    }
    
    const recordingBuffer = await response.arrayBuffer()
    const fileName = `${recordingData.callSid}_${recordingData.recordingSid}.mp3`
    const storagePath = `recordings/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('twilio-recordings')
      .upload(storagePath, recordingBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      })
    
    if (error) {
      console.error('Storage error:', error)
      return null
    }
    
    return data.path
  } catch (error) {
    console.error('Error storing recording:', error)
    return null
  }
}

async function handleConferenceRecording(recordingData: any, callData: any) {
  try {
    // Extract conference name from the call details
    const conferenceName = callData.to.replace('conference:', '')
    
    // Update conference recording status
    await supabase
      .from('twilio_conference_recordings')
      .insert([{
        conference_name: conferenceName,
        recording_sid: recordingData.recordingSid,
        call_sid: recordingData.callSid,
        duration: recordingData.recordingDuration,
        created_at: new Date().toISOString()
      }])
    
    // Send notification about conference recording availability
    // TODO: Implement notification logic
  } catch (error) {
    console.error('Error handling conference recording:', error)
  }
}

async function checkAndNotifyInterview(callSid: string) {
  try {
    // Check if this call is associated with an interview
    const { data: interview } = await supabase
      .from('interviews')
      .select('*')
      .eq('call_sid', callSid)
      .single()
    
    if (interview) {
      // Update interview with recording status
      await supabase
        .from('interviews')
        .update({
          has_recording: true,
          recording_status: 'available',
          updated_at: new Date().toISOString()
        })
        .eq('id', interview.id)
      
      // Send notification to recruiter
      // TODO: Implement recruiter notification
    }
  } catch (error) {
    console.error('Error checking interview association:', error)
  }
}