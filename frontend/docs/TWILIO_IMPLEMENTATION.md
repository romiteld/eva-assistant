# Twilio Integration Documentation

## Overview

The Twilio integration in EVA provides comprehensive telephony features including voice calls, SMS messaging, IVR flows, conference calls, and real-time communication management.

## Architecture

### Frontend Components
- `/components/twilio/TwilioDashboard.tsx` - Main dashboard interface
- `/components/twilio/IVRDesigner.tsx` - Visual IVR flow designer
- `/components/twilio/ConferenceManager.tsx` - Conference call management
- `/hooks/useTwilio.ts` - State management hook
- `/hooks/useTwilioSync.ts` - Real-time sync hook

### Backend API Routes
- `/api/twilio/webhooks/voice` - Voice call webhook handler
- `/api/twilio/webhooks/call-status` - Call status tracking
- `/api/twilio/webhooks/sms` - SMS message handling
- `/api/twilio/webhooks/recording` - Recording management
- `/api/twilio/webhooks/transcription` - Transcription processing
- `/api/twilio/ivr/execute` - IVR flow execution engine
- `/api/twilio/conferences` - Conference call management
- `/api/twilio/sms/templates` - SMS template management
- `/api/twilio/sms/campaigns` - SMS campaign automation
- `/api/twilio/analytics` - Comprehensive analytics
- `/api/twilio/sync` - Real-time sync service

### Services
- `/lib/services/twilio.ts` - Core Twilio service wrapper
- `/lib/services/twilio-sync.ts` - Real-time sync service
- `/lib/utils/twilio-broadcast.ts` - Event broadcasting utilities

## Key Features

### 1. Voice Calls
- Inbound/outbound call management
- Call status tracking with database storage
- Automatic call recording
- Real-time status updates
- Failed call handling and retry logic

### 2. SMS Messaging
- Two-way SMS communication
- Automated keyword responses
- Opt-out/opt-in management
- Media message support (MMS)
- Message queuing for AI processing

### 3. IVR (Interactive Voice Response)
- Visual flow designer
- Support for multiple step types:
  - Welcome messages
  - Menu options
  - Input gathering
  - Voice recording
  - Call transfers
  - Conditional routing
- Flow execution with state tracking
- Database logging of interactions

### 4. Conference Calls
- Multi-participant conference creation
- Participant management (mute, hold, remove)
- Coach mode for silent monitoring
- Automatic recording support
- Real-time participant tracking

### 5. SMS Campaigns
- Bulk SMS sending with templates
- Variable interpolation
- Rate limiting (1 msg/second)
- Opt-out filtering
- Campaign progress tracking
- Scheduled campaigns

### 6. Recording & Transcription
- Automatic call recording storage
- Supabase Storage integration
- Transcription processing
- Keyword extraction
- Sentiment analysis
- Action item detection

### 7. Analytics & Reporting
- Usage statistics from Twilio API
- Database analytics
- Call/message trends
- Conference statistics
- Campaign performance
- Cost analysis
- AI-generated insights

### 8. Real-time Updates
- Server-Sent Events (SSE) support
- WebSocket integration
- Event broadcasting
- React hooks for easy integration
- Automatic reconnection handling

## Database Schema

### Tables Created
- `twilio_call_logs` - Call history and status
- `twilio_messages` - SMS message storage
- `twilio_recordings` - Recording metadata
- `twilio_transcriptions` - Transcription text
- `twilio_transcription_analysis` - AI analysis results
- `twilio_conferences` - Conference metadata
- `twilio_conference_participants` - Participant tracking
- `sms_templates` - Message templates
- `sms_campaigns` - Campaign management
- `sms_campaign_messages` - Individual campaign messages
- `twilio_opt_outs` - SMS opt-out tracking
- `ivr_flows` - IVR flow definitions
- `ivr_interactions` - User interaction logs

## Environment Variables Required

```env
# Twilio Credentials
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_DEFAULT_TRANSFER_NUMBER=+1234567890

# Optional
TWILIO_WORKSPACE_SID=your_workspace_sid
TWILIO_WORKFLOW_SID=your_workflow_sid
```

## Usage Examples

### 1. Making a Call
```typescript
const twilioService = createTwilioService()
const call = await twilioService.makeCall({
  to: '+1234567890',
  from: process.env.TWILIO_PHONE_NUMBER,
  url: 'https://your-app.com/api/twilio/webhooks/voice'
})
```

### 2. Sending SMS
```typescript
const message = await twilioService.sendSMS({
  to: '+1234567890',
  body: 'Hello from The Well Recruiting Solutions!'
})
```

### 3. Creating Conference
```typescript
const response = await fetch('/api/twilio/conferences', {
  method: 'POST',
  body: JSON.stringify({
    conferenceName: 'Interview Call',
    participants: [
      { phone: '+1234567890', name: 'John Doe', role: 'interviewer' },
      { phone: '+0987654321', name: 'Jane Smith', role: 'candidate' }
    ],
    record: true
  })
})
```

### 4. Using Real-time Sync
```typescript
import { useTwilioCallEvents } from '@/hooks/useTwilioSync'

function CallMonitor() {
  const sync = useTwilioCallEvents((event) => {
    console.log('Call event:', event)
  })
  
  return <div>Connected: {sync.connected ? 'Yes' : 'No'}</div>
}
```

## Security Considerations

1. **Webhook Validation**: All webhooks validate Twilio signatures
2. **Rate Limiting**: SMS campaigns limited to 1 msg/second
3. **Opt-out Compliance**: Automatic handling of STOP/START keywords
4. **Recording Storage**: Secure storage in Supabase with access controls
5. **Environment-based Security**: Stricter validation in production

## Monitoring & Debugging

1. **Logging**: Comprehensive error logging in all endpoints
2. **Analytics**: Built-in analytics endpoint for monitoring
3. **Status Tracking**: Real-time status updates via sync service
4. **Failed Operations**: Automatic queuing for retry
5. **Database Audit**: All operations logged with timestamps

## Future Enhancements

1. **AI Integration**: 
   - Smart call routing based on intent
   - Automated appointment scheduling
   - Voice sentiment analysis

2. **Advanced Features**:
   - WhatsApp Business API integration
   - Video calling support
   - Call center queue management
   - Predictive dialing

3. **Analytics**:
   - ML-based call outcome prediction
   - Advanced conversation analytics
   - Custom reporting dashboards