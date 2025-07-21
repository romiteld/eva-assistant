import { NextRequest, NextResponse } from 'next/server';
import { withWebhookValidation, logWebhookEvent } from '@/middleware/webhook-validation';
import { createClient } from '@/lib/supabase/server';

async function handleTwilioWebhook(request: NextRequest, body: any) {
  const supabase = createClient();
  
  try {
    // Log the webhook event
    await logWebhookEvent('twilio', body.EventType || 'unknown', 'success', body);
    
    // Handle different Twilio event types
    switch (body.EventType) {
      case 'onMessageSent':
        // Handle SMS sent confirmation
        await supabase
          .from('sms_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            message_sid: body.MessageSid,
          })
          .eq('sid', body.MessageSid);
        break;
        
      case 'onMessageStatusUpdate':
        // Handle SMS status updates (delivered, failed, etc.)
        await supabase
          .from('sms_messages')
          .update({
            status: body.MessageStatus,
            error_code: body.ErrorCode,
            error_message: body.ErrorMessage,
          })
          .eq('sid', body.MessageSid);
        break;
        
      case 'onRecordingStatusUpdate':
        // Handle recording status updates
        if (body.RecordingStatus === 'completed') {
          await supabase
            .from('call_recordings')
            .update({
              status: 'completed',
              recording_url: body.RecordingUrl,
              duration: body.RecordingDuration,
            })
            .eq('recording_sid', body.RecordingSid);
        }
        break;
        
      case 'onTranscriptionComplete':
        // Handle transcription completion
        await supabase
          .from('transcriptions')
          .insert({
            recording_sid: body.RecordingSid,
            transcription_sid: body.TranscriptionSid,
            transcription_text: body.TranscriptionText,
            status: 'completed',
          });
        break;
        
      default:
        console.log('Unhandled Twilio event type:', body.EventType);
    }
    
    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logWebhookEvent('twilio', body.EventType || 'unknown', 'error', body, errorMessage);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Export the handler with webhook validation
export const POST = withWebhookValidation(handleTwilioWebhook, 'twilio');