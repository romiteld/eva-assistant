import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'

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
    
    // Process the recording webhook
    const recordingData = twilioService.processRecordingWebhook(params)
    
    console.log('Recording completed:', recordingData)
    
    // Here you could:
    // - Save recording metadata to database
    // - Trigger transcription
    // - Send notifications
    // - Update candidate records
    
    // Example: Auto-transcribe important recordings
    if (recordingData.recordingStatus === 'completed') {
      try {
        await twilioService.transcribeRecording(
          recordingData.recordingSid,
          '/api/twilio/webhooks/transcription'
        )
      } catch (error) {
        console.error('Transcription request failed:', error)
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