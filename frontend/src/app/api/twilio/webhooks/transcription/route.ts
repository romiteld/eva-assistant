import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'

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
    
    // Extract transcription data
    const transcriptionData = {
      transcription_sid: params.TranscriptionSid,
      recording_sid: params.RecordingSid,
      transcription_text: params.TranscriptionText,
      transcription_status: params.TranscriptionStatus,
      duration: params.Duration ? parseInt(params.Duration) : null,
      price: params.Price,
      price_unit: params.PriceUnit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Store transcription in database
    const { data: savedTranscription, error: dbError } = await supabase
      .from('twilio_transcriptions')
      .insert([transcriptionData])
      .select()
      .single()
    
    if (dbError) {
      console.error('Database error:', dbError)
    }
    
    // Update recording with transcription status
    await supabase
      .from('twilio_recordings')
      .update({
        transcription_status: transcriptionData.transcription_status,
        transcription_sid: transcriptionData.transcription_sid,
        updated_at: new Date().toISOString()
      })
      .eq('recording_sid', transcriptionData.recording_sid)
    
    // Process completed transcriptions
    if (transcriptionData.transcription_status === 'completed' && transcriptionData.transcription_text) {
      try {
        // Extract insights from transcription
        const analysis = await analyzeTranscription(transcriptionData.transcription_text)
        
        // Store analysis results
        if (savedTranscription) {
          await supabase
            .from('twilio_transcription_analysis')
            .insert([{
              transcription_id: savedTranscription.id,
              keywords: analysis.keywords,
              sentiment: analysis.sentiment,
              action_items: analysis.actionItems,
              entities: analysis.entities,
              summary: analysis.summary,
              created_at: new Date().toISOString()
            }])
        }
        
        // Handle specific types of calls
        if (analysis.callType === 'interview_scheduling') {
          await handleInterviewScheduling(transcriptionData, analysis)
        } else if (analysis.callType === 'application_inquiry') {
          await handleApplicationInquiry(transcriptionData, analysis)
        } else if (analysis.callType === 'offer_discussion') {
          await handleOfferDiscussion(transcriptionData, analysis)
        }
        
        // Notify relevant parties if urgent
        if (analysis.urgency === 'high') {
          await notifyUrgentTranscription(transcriptionData, analysis)
        }
        
      } catch (error) {
        console.error('Transcription analysis error:', error)
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

async function analyzeTranscription(text: string) {
  // Extract keywords
  const keywords = extractKeywords(text)
  
  // Determine sentiment
  const sentiment = analyzeSentiment(text)
  
  // Extract entities (names, dates, times, locations)
  const entities = extractEntities(text)
  
  // Identify action items
  const actionItems = extractActionItems(text)
  
  // Generate summary
  const summary = generateSummary(text)
  
  // Determine call type
  const callType = determineCallType(keywords, text)
  
  // Assess urgency
  const urgency = assessUrgency(text, keywords)
  
  return {
    keywords,
    sentiment,
    entities,
    actionItems,
    summary,
    callType,
    urgency
  }
}

function extractKeywords(text: string): string[] {
  const importantKeywords = [
    'interview', 'schedule', 'reschedule', 'cancel', 'application',
    'status', 'position', 'job', 'offer', 'salary', 'benefits',
    'available', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    'morning', 'afternoon', 'evening', 'urgent', 'asap', 'callback',
    'recruiter', 'candidate', 'qualification', 'experience', 'start date'
  ]
  
  const lowerText = text.toLowerCase()
  return importantKeywords.filter(keyword => lowerText.includes(keyword))
}

function analyzeSentiment(text: string): string {
  const positiveWords = ['great', 'excellent', 'excited', 'interested', 'perfect', 'wonderful', 'appreciate']
  const negativeWords = ['cancel', 'decline', 'not interested', 'withdraw', 'problem', 'issue', 'complaint']
  
  const lowerText = text.toLowerCase()
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
  
  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}

function extractEntities(text: string) {
  const entities = {
    names: [] as string[],
    dates: [] as string[],
    times: [] as string[],
    phoneNumbers: [] as string[],
    emails: [] as string[]
  }
  
  // Extract dates (simple pattern)
  const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/gi
  entities.dates = text.match(datePattern) || []
  
  // Extract times
  const timePattern = /\b(\d{1,2}:\d{2}\s*(am|pm|AM|PM)?|\d{1,2}\s*(am|pm|AM|PM))\b/gi
  entities.times = text.match(timePattern) || []
  
  // Extract phone numbers
  const phonePattern = /\b(\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})\b/g
  entities.phoneNumbers = text.match(phonePattern) || []
  
  // Extract emails
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  entities.emails = text.match(emailPattern) || []
  
  return entities
}

function extractActionItems(text: string): string[] {
  const actionPhrases = [
    'please call',
    'need to schedule',
    'would like to',
    'can you',
    'I need',
    'follow up',
    'send me',
    'contact me',
    'let me know'
  ]
  
  const lowerText = text.toLowerCase()
  const actions: string[] = []
  
  actionPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      const startIndex = lowerText.indexOf(phrase)
      const endIndex = Math.min(startIndex + 100, text.length)
      const actionText = text.substring(startIndex, endIndex).split('.')[0]
      actions.push(actionText)
    }
  })
  
  return actions
}

function generateSummary(text: string): string {
  // Simple summary: first 200 characters or first two sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  if (sentences.length >= 2) {
    return sentences.slice(0, 2).join('. ') + '.'
  }
  return text.substring(0, 200) + '...'
}

function determineCallType(keywords: string[], text: string): string {
  const lowerText = text.toLowerCase()
  
  if (keywords.includes('interview') || keywords.includes('schedule')) {
    return 'interview_scheduling'
  }
  if (keywords.includes('application') || keywords.includes('status')) {
    return 'application_inquiry'
  }
  if (keywords.includes('offer') || keywords.includes('salary')) {
    return 'offer_discussion'
  }
  if (lowerText.includes('cancel') || lowerText.includes('withdraw')) {
    return 'cancellation'
  }
  
  return 'general_inquiry'
}

function assessUrgency(text: string, keywords: string[]): string {
  const urgentIndicators = ['urgent', 'asap', 'immediately', 'today', 'emergency']
  const lowerText = text.toLowerCase()
  
  const hasUrgentKeyword = urgentIndicators.some(indicator => lowerText.includes(indicator))
  if (hasUrgentKeyword) return 'high'
  
  if (keywords.includes('interview') || keywords.includes('offer')) return 'medium'
  
  return 'low'
}

async function handleInterviewScheduling(transcription: any, analysis: any) {
  // Create task for recruiter to schedule interview
  await supabase
    .from('tasks')
    .insert([{
      title: 'Schedule Interview - Transcription Request',
      description: `Call transcription indicates interview scheduling request.\n\nSummary: ${analysis.summary}\n\nAction Items: ${analysis.actionItems.join(', ')}`,
      priority: analysis.urgency === 'high' ? 'high' : 'medium',
      type: 'interview_scheduling',
      metadata: {
        transcription_id: transcription.transcription_sid,
        entities: analysis.entities
      },
      created_at: new Date().toISOString()
    }])
}

async function handleApplicationInquiry(transcription: any, analysis: any) {
  // Log inquiry for follow-up
  await supabase
    .from('application_inquiries')
    .insert([{
      transcription_id: transcription.transcription_sid,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      created_at: new Date().toISOString()
    }])
}

async function handleOfferDiscussion(transcription: any, analysis: any) {
  // Flag for immediate attention
  await supabase
    .from('offer_discussions')
    .insert([{
      transcription_id: transcription.transcription_sid,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      urgency: 'high',
      created_at: new Date().toISOString()
    }])
}

async function notifyUrgentTranscription(transcription: any, analysis: any) {
  // Send notification through your preferred channel
  console.log('URGENT TRANSCRIPTION:', {
    summary: analysis.summary,
    callType: analysis.callType,
    actionItems: analysis.actionItems
  })
  
  // TODO: Implement actual notification (email, SMS, Slack, etc.)
}