import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const twilioService = createTwilioService()
    
    // Get active conferences from Twilio
    const conferences = await twilioService.listConferences({
      status: 'in-progress',
      limit: 20
    })
    
    // Get conference details from database
    const conferenceNames = conferences.map((c: any) => c.friendlyName)
    const { data: dbConferences } = await supabase
      .from('twilio_conferences')
      .select('*')
      .in('conference_name', conferenceNames)
    
    // Merge data
    const activeConferences = conferences.map((conf: any) => {
      const dbData = dbConferences?.find(db => db.conference_name === conf.friendlyName)
      return {
        conferenceName: conf.friendlyName,
        sid: conf.sid,
        status: conf.status,
        dateCreated: conf.dateCreated,
        participants: [],
        metadata: dbData || {}
      }
    })
    
    // Get participants for each conference
    for (const conf of activeConferences) {
      const participants = await twilioService.listConferenceParticipants(conf.sid)
      
      conf.participants = participants.map((p: any) => ({
        callSid: p.callSid,
        phoneNumber: p.from || p.to,
        muted: p.muted,
        hold: p.hold,
        startTime: p.dateCreated
      }))
    }
    
    return NextResponse.json(activeConferences)
  } catch (error) {
    console.error('Error fetching conferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conferences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      conferenceName, 
      participants, 
      record = false,
      maxParticipants = 10,
      beep = true,
      waitUrl,
      statusCallback
    } = body
    
    if (!conferenceName || !participants || participants.length === 0) {
      return NextResponse.json(
        { error: 'Conference name and participants are required' },
        { status: 400 }
      )
    }
    
    const twilioService = createTwilioService()
    const conferenceId = uuidv4()
    
    // Store conference in database
    const { data: savedConference, error: dbError } = await supabase
      .from('twilio_conferences')
      .insert([{
        conference_id: conferenceId,
        conference_name: conferenceName,
        participant_count: participants.length,
        record_enabled: record,
        status: 'initiating',
        metadata: {
          maxParticipants,
          beep,
          participants: participants.map((p: any) => ({
            phone: p.phone,
            name: p.name,
            role: p.role
          }))
        },
        created_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (dbError) {
      console.error('Database error:', dbError)
    }
    
    // Call each participant
    const callResults = []
    for (const participant of participants) {
      try {
        // Generate TwiML for conference
        const twiml = twilioService.generateVoiceResponse({
          say: `Hello ${participant.name}, connecting you to the conference call.`,
          dial: {
            conference: conferenceName,
            record: record ? 'record-from-answer' : 'do-not-record',
            recordingStatusCallback: record ? '/api/twilio/webhooks/recording' : undefined
          }
        })
        
        // Make the call
        const call = await twilioService.makeCall({
          to: participant.phone,
          twiml,
          statusCallback: statusCallback || '/api/twilio/webhooks/call-status',
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        })
        
        callResults.push({
          phone: participant.phone,
          name: participant.name,
          callSid: call.sid,
          status: call.status
        })
        
        // Store participant call
        await supabase
          .from('twilio_conference_participants')
          .insert([{
            conference_id: conferenceId,
            call_sid: call.sid,
            participant_phone: participant.phone,
            participant_name: participant.name,
            participant_role: participant.role,
            status: call.status,
            created_at: new Date().toISOString()
          }])
        
      } catch (error) {
        console.error(`Error calling participant ${participant.phone}:`, error)
        callResults.push({
          phone: participant.phone,
          name: participant.name,
          callSid: null,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Update conference status
    await supabase
      .from('twilio_conferences')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('conference_id', conferenceId)
    
    return NextResponse.json({
      conferenceId,
      conferenceName,
      participants: callResults,
      record,
      status: 'initiated'
    })
    
  } catch (error) {
    console.error('Conference creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create conference' },
      { status: 500 }
    )
  }
}

// Manage conference participants
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { conferenceSid, participantCallSid, action, value } = body
    
    if (!conferenceSid || !participantCallSid || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    const twilioService = createTwilioService()
    
    switch (action) {
      case 'mute':
        await twilioService.updateConferenceParticipant(
          conferenceSid,
          participantCallSid,
          { muted: value !== false }
        )
        break
        
      case 'hold':
        await twilioService.updateConferenceParticipant(
          conferenceSid,
          participantCallSid,
          { hold: value !== false }
        )
        break
        
      case 'remove':
        await twilioService.removeConferenceParticipant(
          conferenceSid,
          participantCallSid
        )
        break
        
      case 'coach':
        // Coach mode - participant can hear but not be heard
        await twilioService.updateConferenceParticipant(
          conferenceSid,
          participantCallSid,
          { 
            muted: true
          }
        )
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
    
    return NextResponse.json({ success: true, action })
    
  } catch (error) {
    console.error('Conference management error:', error)
    return NextResponse.json(
      { error: 'Failed to manage conference participant' },
      { status: 500 }
    )
  }
}

// End conference
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conferenceSid = searchParams.get('conferenceSid')
    
    if (!conferenceSid) {
      return NextResponse.json(
        { error: 'Conference SID is required' },
        { status: 400 }
      )
    }
    
    const twilioService = createTwilioService()
    
    // Update conference status to completed
    await twilioService.updateConference(conferenceSid, { status: 'completed' })
    
    // Update database
    await supabase
      .from('twilio_conferences')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('conference_sid', conferenceSid)
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Conference end error:', error)
    return NextResponse.json(
      { error: 'Failed to end conference' },
      { status: 500 }
    )
  }
}