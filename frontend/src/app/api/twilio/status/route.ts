import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/browser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const body: any = {}
    for (const [key, value] of formData.entries()) {
      body[key] = value
    }
    
    // Store webhook event
    await supabase
      .from('twilio_webhook_events')
      .insert({
        event_type: body.MessageSid ? 'message_status' : body.CallSid ? 'call_status' : 'unknown',
        resource_type: body.MessageSid ? 'message' : body.CallSid ? 'call' : 'unknown',
        resource_sid: body.MessageSid || body.CallSid || 'unknown',
        account_sid: body.AccountSid || 'unknown',
        payload: body,
        processed: false,
      })
    
    // Update message or call status
    if (body.MessageSid && body.MessageStatus) {
      await supabase
        .from('twilio_messages')
        .update({
          status: body.MessageStatus,
          error_code: body.ErrorCode ? parseInt(body.ErrorCode) : null,
          error_message: body.ErrorMessage,
          date_updated: new Date().toISOString(),
        })
        .eq('sid', body.MessageSid)
    } else if (body.CallSid && body.CallStatus) {
      const updates: any = {
        status: body.CallStatus,
        date_updated: new Date().toISOString(),
      }
      
      if (body.CallStatus === 'completed' && body.CallDuration) {
        updates.duration = parseInt(body.CallDuration)
        updates.end_time = new Date().toISOString()
      }
      
      await supabase
        .from('twilio_calls')
        .update(updates)
        .eq('sid', body.CallSid)
    }
    
    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Error in status webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}