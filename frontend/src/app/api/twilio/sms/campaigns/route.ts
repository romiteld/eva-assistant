import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting configuration
const RATE_LIMIT = {
  messagesPerSecond: 1, // Twilio recommends 1 message per second
  maxConcurrent: 10,
  retryAttempts: 3,
  retryDelay: 5000 // 5 seconds
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    let query = supabase
      .from('sms_campaigns')
      .select(`
        *,
        sms_campaign_messages(
          id,
          status,
          sent_at,
          delivered_at,
          error_message
        )
      `)
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: campaigns, error } = await query
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch SMS campaigns' },
        { status: 500 }
      )
    }
    
    // Calculate statistics for each campaign
    const campaignsWithStats = campaigns?.map(campaign => {
      const messages = campaign.sms_campaign_messages || []
      const stats = {
        total: messages.length,
        sent: messages.filter((m: any) => m.status === 'sent').length,
        delivered: messages.filter((m: any) => m.status === 'delivered').length,
        failed: messages.filter((m: any) => m.status === 'failed').length,
        pending: messages.filter((m: any) => m.status === 'pending').length
      }
      
      return {
        ...campaign,
        stats,
        sms_campaign_messages: undefined // Remove raw messages from response
      }
    })
    
    return NextResponse.json(campaignsWithStats || [])
  } catch (error) {
    console.error('SMS campaigns GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name,
      templateId,
      recipients, // Array of { phone, variables }
      scheduledAt,
      metadata = {}
    } = body
    
    if (!name || !templateId || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Name, template, and recipients are required' },
        { status: 400 }
      )
    }
    
    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('id', templateId)
      .single()
    
    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
    
    // Validate recipients and check opt-outs
    const validatedRecipients = await validateRecipients(recipients)
    
    if (validatedRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients after opt-out filtering' },
        { status: 400 }
      )
    }
    
    // Create campaign
    const campaignId = uuidv4()
    const campaign = {
      id: campaignId,
      name,
      template_id: templateId,
      recipient_count: validatedRecipients.length,
      scheduled_at: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'pending',
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: savedCampaign, error: campaignError } = await supabase
      .from('sms_campaigns')
      .insert([campaign])
      .select()
      .single()
    
    if (campaignError) {
      console.error('Campaign creation error:', campaignError)
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      )
    }
    
    // Prepare campaign messages
    const campaignMessages = validatedRecipients.map(recipient => ({
      id: uuidv4(),
      campaign_id: campaignId,
      recipient_phone: recipient.phone,
      message_body: interpolateTemplate(template.content, recipient.variables || {}),
      status: 'pending',
      created_at: new Date().toISOString()
    }))
    
    // Store campaign messages
    const { error: messagesError } = await supabase
      .from('sms_campaign_messages')
      .insert(campaignMessages)
    
    if (messagesError) {
      console.error('Campaign messages error:', messagesError)
    }
    
    // If not scheduled, start sending immediately
    if (!scheduledAt) {
      // Queue for processing
      await queueCampaignForProcessing(campaignId)
    }
    
    return NextResponse.json({
      ...savedCampaign,
      recipientCount: validatedRecipients.length,
      status: 'created'
    })
    
  } catch (error) {
    console.error('SMS campaign creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Process campaign sending with rate limiting
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, action } = body
    
    if (!campaignId || !action) {
      return NextResponse.json(
        { error: 'Campaign ID and action are required' },
        { status: 400 }
      )
    }
    
    switch (action) {
      case 'start':
        await startCampaign(campaignId)
        break
        
      case 'pause':
        await pauseCampaign(campaignId)
        break
        
      case 'resume':
        await resumeCampaign(campaignId)
        break
        
      case 'cancel':
        await cancelCampaign(campaignId)
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
    
    return NextResponse.json({ success: true, action })
    
  } catch (error) {
    console.error('Campaign action error:', error)
    return NextResponse.json(
      { error: 'Failed to process campaign action' },
      { status: 500 }
    )
  }
}

async function validateRecipients(recipients: any[]) {
  // Get opt-out list
  const { data: optOuts } = await supabase
    .from('twilio_opt_outs')
    .select('phone_number')
    .eq('opted_out', true)
  
  const optOutNumbers = new Set(optOuts?.map(o => o.phone_number) || [])
  
  // Filter out opted-out recipients
  return recipients.filter(r => {
    const normalizedPhone = normalizePhoneNumber(r.phone)
    return !optOutNumbers.has(normalizedPhone)
  })
}

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // Add country code if missing
  if (digits.length === 10) {
    return `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  return phone
}

function interpolateTemplate(template: string, variables: Record<string, any>): string {
  let message = template
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    message = message.replace(regex, String(value))
  })
  
  // Remove any remaining placeholders
  message = message.replace(/\{\{[^}]+\}\}/g, '')
  
  return message.trim()
}

async function queueCampaignForProcessing(campaignId: string) {
  // Update campaign status
  await supabase
    .from('sms_campaigns')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
  
  // Start processing in background
  processCampaign(campaignId).catch(error => {
    console.error('Campaign processing error:', error)
  })
}

async function processCampaign(campaignId: string) {
  const twilioService = createTwilioService()
  
  // Get pending messages
  const { data: messages } = await supabase
    .from('sms_campaign_messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  
  if (!messages || messages.length === 0) {
    await completeCampaign(campaignId)
    return
  }
  
  // Process messages with rate limiting
  const chunks = chunkArray(messages, RATE_LIMIT.maxConcurrent)
  
  for (const chunk of chunks) {
    // Check if campaign is still active
    const { data: campaign } = await supabase
      .from('sms_campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()
    
    if (campaign?.status !== 'processing') {
      break // Campaign paused or cancelled
    }
    
    // Process chunk concurrently
    const promises = chunk.map(async (message) => {
      try {
        const result = await twilioService.sendSMSEnhanced({
          to: message.recipient_phone,
          body: message.message_body,
          statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/sms/status`
        })
        
        // Update message status
        await supabase
          .from('sms_campaign_messages')
          .update({
            status: 'sent',
            message_sid: result.sid,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id)
        
      } catch (error) {
        console.error(`Failed to send to ${message.recipient_phone}:`, error)
        
        // Update message with error
        await supabase
          .from('sms_campaign_messages')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id)
      }
    })
    
    await Promise.all(promises)
    
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 1000 / RATE_LIMIT.messagesPerSecond))
  }
  
  // Check if all messages are processed
  const { data: remainingMessages } = await supabase
    .from('sms_campaign_messages')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
  
  if (!remainingMessages || remainingMessages.length === 0) {
    await completeCampaign(campaignId)
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

async function startCampaign(campaignId: string) {
  await supabase
    .from('sms_campaigns')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
  
  await queueCampaignForProcessing(campaignId)
}

async function pauseCampaign(campaignId: string) {
  await supabase
    .from('sms_campaigns')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
}

async function resumeCampaign(campaignId: string) {
  await supabase
    .from('sms_campaigns')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
  
  await queueCampaignForProcessing(campaignId)
}

async function cancelCampaign(campaignId: string) {
  await supabase
    .from('sms_campaigns')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
}

async function completeCampaign(campaignId: string) {
  await supabase
    .from('sms_campaigns')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
}