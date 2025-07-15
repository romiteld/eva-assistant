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
    
    // Process the transcription
    const transcriptionSid = params.TranscriptionSid
    const transcriptionText = params.TranscriptionText
    const transcriptionStatus = params.TranscriptionStatus
    const recordingSid = params.RecordingSid
    
    console.log('Transcription completed:', {
      transcriptionSid,
      transcriptionText,
      transcriptionStatus,
      recordingSid
    })
    
    // Here you could:
    // - Save transcription to database
    // - Process with AI for sentiment analysis
    // - Extract key information (names, dates, etc.)
    // - Send notifications to recruiters
    // - Update candidate records
    
    // Example: Process transcription for key information
    if (transcriptionStatus === 'completed' && transcriptionText) {
      // Basic keyword extraction
      const keywords = extractKeywords(transcriptionText)
      
      // You could save this to database or trigger further processing
      console.log('Extracted keywords:', keywords)
      
      // Example: If it's an interview scheduling request
      if (keywords.includes('interview') || keywords.includes('schedule')) {
        // Trigger notification to recruiters
        await notifyRecruiters('New interview scheduling request', transcriptionText)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Transcription webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function extractKeywords(text: string): string[] {
  const keywords = [
    'interview', 'schedule', 'reschedule', 'cancel', 'application',
    'status', 'position', 'job', 'available', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'morning', 'afternoon',
    'evening', 'urgent', 'asap', 'callback', 'recruiter'
  ]
  
  const lowerText = text.toLowerCase()
  return keywords.filter(keyword => lowerText.includes(keyword))
}

async function notifyRecruiters(subject: string, message: string) {
  // This would integrate with your notification system
  // For example: send email, Slack message, or push notification
  console.log(`Notification: ${subject} - ${message}`)
  
  // Example implementation could be:
  // await sendEmail({
  //   to: 'recruiters@thewell.solutions',
  //   subject,
  //   body: message
  // })
}