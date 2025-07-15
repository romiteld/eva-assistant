// Utility function to broadcast Twilio events through sync service
export async function broadcastTwilioEvent(event: string, data: any) {
  try {
    // Broadcast via REST API endpoint
    await fetch('/api/twilio/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ event, data })
    })
  } catch (error) {
    console.error('Failed to broadcast Twilio event:', error)
  }
}

// Helper function to format call events
export function formatCallEvent(params: any) {
  return {
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
    direction: params.Direction,
    status: params.CallStatus,
    duration: params.CallDuration ? parseInt(params.CallDuration) : undefined,
    timestamp: new Date().toISOString()
  }
}

// Helper function to format SMS events
export function formatSMSEvent(params: any) {
  return {
    messageSid: params.MessageSid || params.SmsSid,
    from: params.From,
    to: params.To,
    body: params.Body,
    status: params.MessageStatus || params.SmsStatus,
    numMedia: params.NumMedia ? parseInt(params.NumMedia) : 0,
    timestamp: new Date().toISOString()
  }
}

// Helper function to format conference events
export function formatConferenceEvent(params: any) {
  return {
    conferenceSid: params.ConferenceSid,
    conferenceName: params.FriendlyName,
    status: params.StatusCallbackEvent,
    participantCount: params.ParticipantCount ? parseInt(params.ParticipantCount) : 0,
    timestamp: new Date().toISOString()
  }
}

// Helper function to format recording events
export function formatRecordingEvent(params: any) {
  return {
    recordingSid: params.RecordingSid,
    callSid: params.CallSid,
    duration: params.RecordingDuration ? parseInt(params.RecordingDuration) : 0,
    url: params.RecordingUrl,
    status: params.RecordingStatus,
    timestamp: new Date().toISOString()
  }
}