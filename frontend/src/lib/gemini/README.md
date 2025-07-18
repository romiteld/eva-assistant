# Gemini WebSocket Implementation

## Overview
This directory contains the client-side implementation for connecting to Google's Gemini Live API through WebSocket connections.

## Configuration

### Model Names
The current implementation uses the following Gemini model:
- Default: `gemini-2.0-flash-exp`

### WebSocket Endpoints
The Gemini Live API uses the following endpoint format:
```
wss://generativelanguage.googleapis.com/v1/models/{MODEL}:generateContent?alt=sse&key={API_KEY}
```

### Important Notes
1. The API has changed from `v1beta` to `v1`
2. The endpoint uses `:generateContent` instead of `:streamGenerateContent`
3. The `alt=sse` parameter is required for server-sent events format
4. Model names should not include the `models/` prefix in the URL

## Architecture

### Components
1. **Supabase Edge Function** (`/supabase/functions/gemini-websocket/`): 
   - Proxies WebSocket connections to Gemini API
   - Handles authentication and API key management
   - Runs on Deno runtime

2. **WebSocket Client** (`websocket-client.ts`):
   - Browser-side WebSocket client
   - Handles connection management and message formatting
   - Provides React hooks for easy integration

3. **GeminiLiveStudio Component**:
   - Main UI component for voice interactions
   - Handles audio recording and playback
   - Manages conversation state

## Security Considerations
- API keys are never exposed to the client
- All WebSocket connections go through the Supabase Edge Function
- Authentication is required via Supabase JWT tokens

## Usage Example
```typescript
import { useGeminiWebSocket } from '@/lib/gemini/websocket-client';

function MyComponent() {
  const { client, isConnected, sendMessage } = useGeminiWebSocket({
    onMessage: (data) => {
      console.log('Received:', data);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Send a message
  const handleSend = () => {
    sendMessage('Hello, Gemini!');
  };
}
```

## Troubleshooting

### Common Issues
1. **WebSocket connection fails**: 
   - Check if GEMINI_API_KEY is set in Supabase Edge Function environment
   - Verify the API key has access to Gemini Live API
   - Ensure the model name is correct

2. **Authentication errors**:
   - Verify Supabase JWT token is valid
   - Check if user is properly authenticated

3. **Model not found**:
   - Use only documented model names
   - Currently supported: `gemini-2.0-flash-exp`