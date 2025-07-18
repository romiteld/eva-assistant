import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'day' // day, week, month
    const metrics = searchParams.get('metrics')?.split(',') || ['calls', 'messages', 'cost']
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Get analytics data from multiple sources
    const [
      twilioStats,
      callAnalytics,
      messageAnalytics,
      recordingAnalytics,
      conferenceAnalytics,
      campaignAnalytics
    ] = await Promise.all([
      getTwilioUsageStats(start, end),
      getCallAnalytics(start, end, groupBy),
      getMessageAnalytics(start, end, groupBy),
      getRecordingAnalytics(start, end),
      getConferenceAnalytics(start, end),
      getCampaignAnalytics(start, end)
    ])
    
    // Compile comprehensive analytics
    const analytics = {
      period: {
        start: startDate,
        end: endDate
      },
      summary: twilioStats,
      trends: {
        calls: callAnalytics,
        messages: messageAnalytics
      },
      recordings: recordingAnalytics,
      conferences: conferenceAnalytics,
      campaigns: campaignAnalytics,
      insights: generateInsights(twilioStats, callAnalytics, messageAnalytics)
    }
    
    return NextResponse.json(analytics)
    
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

async function getTwilioUsageStats(startDate: Date, endDate: Date) {
  const twilioService = createTwilioService()
  const supabase = createClient()
  
  try {
    const stats = await twilioService.getUsageStatistics(startDate, endDate)
    
    // Get additional metrics from database
    const [
      uniqueContacts,
      conversionRate,
      responseRate
    ] = await Promise.all([
      getUniqueContacts(startDate, endDate),
      getConversionRate(startDate, endDate),
      getResponseRate(startDate, endDate)
    ])
    
    return {
      ...stats,
      uniqueContacts,
      conversionRate,
      responseRate,
      averageCallDuration: stats.calls.total > 0 
        ? Math.round(stats.calls.totalDuration / stats.calls.total) 
        : 0,
      costPerCall: stats.calls.total > 0 
        ? (stats.calls.totalCost / stats.calls.total).toFixed(2) 
        : '0.00',
      costPerMessage: stats.messages.total > 0 
        ? (stats.messages.totalCost / stats.messages.total).toFixed(2) 
        : '0.00'
    }
  } catch (error) {
    console.error('Twilio stats error:', error)
    return {
      calls: { total: 0, inbound: 0, outbound: 0, totalDuration: 0, totalCost: 0 },
      messages: { total: 0, sent: 0, received: 0, totalCost: 0 },
      recordings: { total: 0, totalDuration: 0, totalCost: 0 }
    }
  }
}

async function getCallAnalytics(startDate: Date, endDate: Date, groupBy: string) {
  const supabase = createClient()
  const { data: calls } = await supabase
    .from('twilio_call_logs')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })
  
  if (!calls) return []
  
  // Group data by time period
  const grouped = groupDataByPeriod(calls, groupBy, 'created_at')
  
  return Object.entries(grouped).map(([period, data]) => {
    const callsArray = data as any[]
    return {
      period,
      total: callsArray.length,
      inbound: callsArray.filter(c => c.direction?.includes('inbound')).length,
      outbound: callsArray.filter(c => c.direction?.includes('outbound')).length,
      completed: callsArray.filter(c => c.call_status === 'completed').length,
      failed: callsArray.filter(c => ['failed', 'busy', 'no-answer'].includes(c.call_status)).length,
      averageDuration: calculateAverageDuration(callsArray),
      totalCost: callsArray.reduce((sum, c) => sum + (parseFloat(c.price || '0')), 0).toFixed(2),
      uniqueCallers: new Set(callsArray.map(c => c.from_number)).size,
      peakHour: findPeakHour(callsArray)
    }
  })
}

async function getMessageAnalytics(startDate: Date, endDate: Date, groupBy: string) {
  const supabase = createClient()
  const { data: messages } = await supabase
    .from('twilio_messages')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })
  
  if (!messages) return []
  
  const grouped = groupDataByPeriod(messages, groupBy, 'created_at')
  
  return Object.entries(grouped).map(([period, data]) => {
    const messagesArray = data as any[]
    return {
      period,
      total: messagesArray.length,
      sent: messagesArray.filter(m => m.direction === 'outbound-api').length,
      received: messagesArray.filter(m => m.direction === 'inbound').length,
      delivered: messagesArray.filter(m => m.status === 'delivered').length,
      failed: messagesArray.filter(m => m.status === 'failed').length,
      uniqueRecipients: new Set(messagesArray.map(m => m.to_number || m.from_number)).size,
      mediaMessages: messagesArray.filter(m => m.num_media > 0).length,
      averageLength: calculateAverageLength(messagesArray),
      keywords: extractTopKeywords(messagesArray)
    }
  })
}

async function getRecordingAnalytics(startDate: Date, endDate: Date) {
  const supabase = createClient()
  const { data: recordings } = await supabase
    .from('twilio_recordings')
    .select(`
      *,
      twilio_transcriptions(
        transcription_text,
        twilio_transcription_analysis(
          sentiment,
          keywords,
          action_items
        )
      )
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  if (!recordings) return {}
  
  const transcribedCount = recordings.filter(r => r.twilio_transcriptions?.length > 0).length
  const sentiments = recordings
    .flatMap(r => r.twilio_transcriptions || [])
    .flatMap(t => t.twilio_transcription_analysis || [])
    .map(a => a.sentiment)
    .filter(Boolean)
  
  return {
    total: recordings.length,
    totalDuration: recordings.reduce((sum, r) => sum + (r.recording_duration || 0), 0),
    transcribed: transcribedCount,
    transcriptionRate: recordings.length > 0 ? (transcribedCount / recordings.length * 100).toFixed(1) : '0',
    sentimentBreakdown: {
      positive: sentiments.filter(s => s === 'positive').length,
      neutral: sentiments.filter(s => s === 'neutral').length,
      negative: sentiments.filter(s => s === 'negative').length
    },
    averageDuration: recordings.length > 0 
      ? Math.round(recordings.reduce((sum, r) => sum + (r.recording_duration || 0), 0) / recordings.length)
      : 0,
    storageUsed: calculateStorageUsed(recordings)
  }
}

async function getConferenceAnalytics(startDate: Date, endDate: Date) {
  const supabase = createClient()
  const { data: conferences } = await supabase
    .from('twilio_conferences')
    .select(`
      *,
      twilio_conference_participants(*)
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  if (!conferences) return {}
  
  const totalParticipants = conferences.reduce((sum, c) => 
    sum + (c.twilio_conference_participants?.length || 0), 0
  )
  
  return {
    total: conferences.length,
    completed: conferences.filter(c => c.status === 'completed').length,
    averageParticipants: conferences.length > 0 
      ? (totalParticipants / conferences.length).toFixed(1)
      : '0',
    totalParticipants,
    recordedConferences: conferences.filter(c => c.record_enabled).length,
    averageDuration: calculateAverageConferenceDuration(conferences),
    peakDay: findPeakConferenceDay(conferences),
    participantRoles: countParticipantRoles(conferences)
  }
}

async function getCampaignAnalytics(startDate: Date, endDate: Date) {
  const supabase = createClient()
  const { data: campaigns } = await supabase
    .from('sms_campaigns')
    .select(`
      *,
      sms_campaign_messages(*)
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  if (!campaigns) return {}
  
  const allMessages = campaigns.flatMap(c => c.sms_campaign_messages || [])
  const deliveredMessages = allMessages.filter(m => m.status === 'delivered')
  
  return {
    totalCampaigns: campaigns.length,
    completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
    totalMessages: allMessages.length,
    deliveredMessages: deliveredMessages.length,
    deliveryRate: allMessages.length > 0 
      ? (deliveredMessages.length / allMessages.length * 100).toFixed(1)
      : '0',
    averageRecipientsPerCampaign: campaigns.length > 0
      ? Math.round(allMessages.length / campaigns.length)
      : 0,
    topPerformingCampaigns: getTopPerformingCampaigns(campaigns),
    campaignsByTemplate: groupCampaignsByTemplate(campaigns)
  }
}

function groupDataByPeriod(data: any[], groupBy: string, dateField: string) {
  const grouped: Record<string, any[]> = {}
  
  data.forEach(item => {
    const date = new Date(item[dateField])
    let key: string
    
    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0]
        break
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      default:
        key = date.toISOString().split('T')[0]
    }
    
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })
  
  return grouped
}

function calculateAverageDuration(calls: any[]) {
  const completedCalls = calls.filter(c => c.duration)
  if (completedCalls.length === 0) return 0
  
  const totalDuration = completedCalls.reduce((sum, c) => sum + c.duration, 0)
  return Math.round(totalDuration / completedCalls.length)
}

function calculateAverageLength(messages: any[]) {
  if (messages.length === 0) return 0
  
  const totalLength = messages.reduce((sum, m) => sum + (m.body?.length || 0), 0)
  return Math.round(totalLength / messages.length)
}

function findPeakHour(calls: any[]) {
  const hourCounts: Record<number, number> = {}
  
  calls.forEach(call => {
    const hour = new Date(call.created_at).getHours()
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  })
  
  const peakHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]
  
  return peakHour ? parseInt(peakHour[0]) : null
}

function extractTopKeywords(messages: any[], limit = 5) {
  const keywords: Record<string, number> = {}
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'])
  
  messages.forEach(message => {
    if (!message.body) return
    
    const words = message.body.toLowerCase().split(/\s+/)
    words.forEach((word: string) => {
      const cleaned = word.replace(/[^a-z0-9]/g, '')
      if (cleaned.length > 3 && !stopWords.has(cleaned)) {
        keywords[cleaned] = (keywords[cleaned] || 0) + 1
      }
    })
  })
  
  return Object.entries(keywords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}

async function getUniqueContacts(startDate: Date, endDate: Date) {
  const supabase = createClient()
  const { data: calls } = await supabase
    .from('twilio_call_logs')
    .select('from_number, to_number')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  const { data: messages } = await supabase
    .from('twilio_messages')
    .select('from_number, to_number')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  const allNumbers = new Set<string>()
  
  calls?.forEach(c => {
    if (c.from_number) allNumbers.add(c.from_number)
    if (c.to_number) allNumbers.add(c.to_number)
  })
  
  messages?.forEach(m => {
    if (m.from_number) allNumbers.add(m.from_number)
    if (m.to_number) allNumbers.add(m.to_number)
  })
  
  // Remove our own numbers
  const ownNumbers = new Set([process.env.TWILIO_PHONE_NUMBER])
  return Array.from(allNumbers).filter(n => !ownNumbers.has(n)).length
}

async function getConversionRate(startDate: Date, endDate: Date) {
  // This is a simplified example - you'd implement your actual conversion logic
  const supabase = createClient()
  const { data: conversions } = await supabase
    .from('candidate_conversions')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  const { data: totalContacts } = await supabase
    .from('twilio_call_logs')
    .select('from_number')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  if (!totalContacts || totalContacts.length === 0) return 0
  
  return ((conversions?.length || 0) / totalContacts.length * 100).toFixed(1)
}

async function getResponseRate(startDate: Date, endDate: Date) {
  const supabase = createClient()
  const { data: outbound } = await supabase
    .from('twilio_messages')
    .select('*')
    .eq('direction', 'outbound-api')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  const { data: responses } = await supabase
    .from('twilio_messages')
    .select('*')
    .eq('direction', 'inbound')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  if (!outbound || outbound.length === 0) return 0
  
  return ((responses?.length || 0) / outbound.length * 100).toFixed(1)
}

function calculateStorageUsed(recordings: any[]) {
  // Estimate storage based on duration and quality
  const bytesPerSecond = 16000 // Approximate for compressed audio
  const totalBytes = recordings.reduce((sum, r) => 
    sum + (r.recording_duration || 0) * bytesPerSecond, 0
  )
  
  return (totalBytes / (1024 * 1024)).toFixed(2) // Convert to MB
}

function calculateAverageConferenceDuration(conferences: any[]) {
  const completed = conferences.filter(c => c.ended_at)
  if (completed.length === 0) return 0
  
  const totalDuration = completed.reduce((sum, c) => {
    const start = new Date(c.created_at).getTime()
    const end = new Date(c.ended_at).getTime()
    return sum + (end - start) / 1000 / 60 // Convert to minutes
  }, 0)
  
  return Math.round(totalDuration / completed.length)
}

function findPeakConferenceDay(conferences: any[]) {
  const dayCounts: Record<string, number> = {}
  
  conferences.forEach(conf => {
    const day = new Date(conf.created_at).toISOString().split('T')[0]
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })
  
  const peakDay = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)[0]
  
  return peakDay ? peakDay[0] : null
}

function countParticipantRoles(conferences: any[]) {
  const roles: Record<string, number> = {}
  
  conferences.forEach(conf => {
    conf.twilio_conference_participants?.forEach((p: any) => {
      const role = p.participant_role || 'unknown'
      roles[role] = (roles[role] || 0) + 1
    })
  })
  
  return roles
}

function getTopPerformingCampaigns(campaigns: any[], limit = 5) {
  return campaigns
    .map(campaign => {
      const messages = campaign.sms_campaign_messages || []
      const delivered = messages.filter((m: any) => m.status === 'delivered').length
      const deliveryRate = messages.length > 0 ? delivered / messages.length : 0
      
      return {
        name: campaign.name,
        recipientCount: messages.length,
        deliveryRate: (deliveryRate * 100).toFixed(1),
        status: campaign.status
      }
    })
    .sort((a, b) => parseFloat(b.deliveryRate) - parseFloat(a.deliveryRate))
    .slice(0, limit)
}

function groupCampaignsByTemplate(campaigns: any[]) {
  const byTemplate: Record<string, number> = {}
  
  campaigns.forEach(campaign => {
    const templateId = campaign.template_id || 'custom'
    byTemplate[templateId] = (byTemplate[templateId] || 0) + 1
  })
  
  return byTemplate
}

function generateInsights(summary: any, callTrends: any[], messageTrends: any[]) {
  const insights = []
  
  // Call volume insights
  if (summary.calls.total > 0) {
    const inboundRate = (summary.calls.inbound / summary.calls.total * 100).toFixed(1)
    insights.push({
      type: 'call_volume',
      message: `${inboundRate}% of calls were inbound, indicating ${parseFloat(inboundRate) > 50 ? 'high' : 'moderate'} candidate engagement`,
      importance: parseFloat(inboundRate) > 70 ? 'high' : 'medium'
    })
  }
  
  // Cost efficiency
  const totalCost = summary.calls.totalCost + summary.messages.totalCost
  if (totalCost > 0) {
    const costPerContact = (totalCost / summary.uniqueContacts).toFixed(2)
    insights.push({
      type: 'cost_efficiency',
      message: `Average cost per unique contact: $${costPerContact}`,
      importance: parseFloat(costPerContact) > 5 ? 'high' : 'low'
    })
  }
  
  // Response rate insight
  if (parseFloat(summary.responseRate) < 20) {
    insights.push({
      type: 'engagement',
      message: `Response rate is ${summary.responseRate}%. Consider improving message personalization or timing.`,
      importance: 'high'
    })
  }
  
  // Peak usage patterns
  if (callTrends.length > 0) {
    const peakHours = callTrends
      .flatMap(t => t.peakHour)
      .filter(Boolean)
    
    if (peakHours.length > 0) {
      const mostCommonHour = mode(peakHours)
      insights.push({
        type: 'timing',
        message: `Peak call activity occurs around ${mostCommonHour}:00. Schedule important calls during this time.`,
        importance: 'medium'
      })
    }
  }
  
  return insights
}

function mode(arr: number[]): number {
  const counts: Record<number, number> = {}
  arr.forEach(val => {
    counts[val] = (counts[val] || 0) + 1
  })
  
  return parseInt(
    Object.entries(counts)
      .sort(([, a], [, b]) => b - a)[0][0]
  )
}