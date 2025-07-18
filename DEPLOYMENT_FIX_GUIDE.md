# EVA Assistant - Deployment Fix Guide

## 🚨 Critical Issues and Solutions

### 1. Gemini Live API WebSocket Issues ✅ FIXED

**Problem**: Incorrect WebSocket URL and model names
**Solution Implemented**:

1. ✅ Updated Supabase Edge Function (`supabase/functions/gemini-websocket/index.ts`):
```typescript
// Changed from v1beta to v1 with proper streaming format
const geminiUrl = `wss://generativelanguage.googleapis.com/v1/models/${model}:generateContent?alt=sse&key=${GEMINI_API_KEY}`
```

2. ✅ Updated model names in `GeminiLiveStudio.tsx`:
```typescript
// Now using single documented model for both modes
const modelName = 'gemini-2.0-flash-exp';
```

3. ✅ Fixed WebSocket proxy implementations to use correct endpoint

4. **Deploy the updated Edge Function**:
```bash
cd frontend
npx supabase functions deploy gemini-websocket
```

### 2. Microsoft Entra ID (Azure AD) Authentication

**Problem**: Environment variable mismatch and PKCE state issues
**Solution**:

1. Create consistent environment variables:
```env
# In .env.local and production environment
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your-client-id
NEXT_PUBLIC_MICROSOFT_TENANT_ID=your-tenant-id
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=https://your-domain.com/auth/microsoft/callback

# Server-side only
ENTRA_CLIENT_ID=your-client-id
ENTRA_CLIENT_SECRET=your-client-secret
ENTRA_TENANT_ID=your-tenant-id
```

2. Ensure Azure App Registration has correct redirect URIs:
   - For local: `http://localhost:3000/auth/microsoft/callback`
   - For production: `https://your-domain.com/auth/microsoft/callback`

3. Enable proper cookie settings for production:
   - Set `SameSite=None` for cross-origin OAuth flow
   - Ensure HTTPS is used in production

### 3. WebSocket Proxy Server

**Problem**: Silent failures in WebSocket proxy initialization
**Solution**:

1. Replace the WebSocket proxy with the fixed version:
```bash
cp src/app/api/gemini/websocket-proxy-fixed.js src/app/api/gemini/websocket-proxy.js
```

2. Update `server.js` to handle errors:
```javascript
// Initialize Gemini WebSocket proxy after server creation
try {
  const { initializeGeminiWebSocketProxy } = require('./src/app/api/gemini/websocket-proxy.js');
  geminiProxy = initializeGeminiWebSocketProxy(server);
  console.log('> Gemini WebSocket proxy initialized at /api/gemini/ws');
} catch (error) {
  console.error('Failed to initialize Gemini WebSocket proxy:', error);
  // Don't fail the entire server, just log the error
}
```

### 4. Production Deployment Steps

1. **Set Environment Variables on Vercel/Your Host**:
```bash
# Required for Gemini
GEMINI_API_KEY=your-api-key

# Required for Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Required for Microsoft Auth
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your-client-id
NEXT_PUBLIC_MICROSOFT_TENANT_ID=your-tenant-id
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=https://your-domain.com/auth/microsoft/callback
ENTRA_CLIENT_ID=your-client-id
ENTRA_CLIENT_SECRET=your-client-secret
ENTRA_TENANT_ID=your-tenant-id

# NextAuth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://your-domain.com
```

2. **Deploy Supabase Edge Functions**:
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy gemini-websocket --no-verify-jwt
```

3. **Update CORS and Security Headers**:
   - Add your production domain to Supabase allowed origins
   - Configure proper CORS headers for WebSocket connections

### 5. Debug and Testing

1. **Run the debug script**:
```bash
cd frontend
node scripts/debug-connections.js
```

2. **Test WebSocket connection manually**:
```javascript
// In browser console
const ws = new WebSocket('wss://your-supabase-url.supabase.co/functions/v1/gemini-websocket?model=gemini-2.0-flash-exp&token=YOUR_TOKEN');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('Error:', e);
```

3. **Check browser console for errors**:
   - Look for CORS errors
   - Check for 401/403 authentication errors
   - Verify WebSocket upgrade headers

### 6. Common Issues and Solutions

**Issue**: "Failed to connect to Gemini WebSocket"
- Check if GEMINI_API_KEY is set in Supabase Edge Function environment
- Verify the API key has access to Gemini Live API
- Check if the model name is correct

**Issue**: "PKCE code verifier not found"
- Ensure cookies are enabled
- Check if running on HTTPS in production
- Verify SameSite cookie settings

**Issue**: "WebSocket connection timeout"
- Check if Supabase Edge Function is deployed
- Verify WebSocket upgrade is allowed by your hosting provider
- Check browser network tab for blocked requests

### 7. Monitoring and Logs

1. **Supabase Edge Function Logs**:
```bash
supabase functions logs gemini-websocket --tail
```

2. **Client-side logs**:
   - Add verbose logging to WebSocket connections
   - Use browser DevTools to monitor WebSocket frames

3. **Server logs**:
   - Check Vercel/hosting provider logs for server errors
   - Monitor custom server output for WebSocket proxy issues

## 🚀 Quick Fix Checklist

- [ ] Update Gemini WebSocket URL in Edge Function
- [ ] Fix model names to use `gemini-2.0-flash-exp`
- [ ] Set all required environment variables
- [ ] Deploy updated Supabase Edge Function
- [ ] Verify Azure App Registration redirect URIs
- [ ] Test with debug script
- [ ] Check browser console for errors
- [ ] Monitor Edge Function logs

Gemini Live API WebSocket and Entra SPA authentication. Here's a comprehensive breakdown:
🔴 Critical Issues Found
1. Gemini Live WebSocket - Incorrect API Endpoint
Problem: Your WebSocket implementation is using the wrong Gemini API endpoint:
javascript// Current (INCORRECT):
const geminiUrl = `wss://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
Solution: The Gemini Live API requires a different endpoint structure. You need to:

Use the correct WebSocket endpoint for Gemini Live
Implement proper Pipecat transport protocol
Handle the bidirectional audio/video streaming correctly

2. Entra ID Authentication - OAuth Flow vs SPA Flow
Problem: Your authentication is configured for server-side OAuth flow, not SPA (Single Page Application) flow:

Using clientSecret in NextAuth (server-side only)
Missing PKCE (Proof Key for Code Exchange) implementation
Incorrect token handling for SPA

Solution: For SPA authentication, you need to:

Use MSAL.js (Microsoft Authentication Library) for client-side auth
Remove server-side secrets from client code
Implement proper PKCE flow

3. WebSocket Proxy Architecture Issue
Problem: Trying to proxy WebSocket connections through Next.js API routes won't work in production:

Vercel and most hosting providers don't support WebSocket upgrades in API routes
The proxy pattern breaks the real-time nature of WebSocket connections

🛠️ Recommended Fixes
Fix 1: Implement Proper Gemini Live WebSocket Client
Create a new client-side WebSocket handler:
typescript// src/lib/gemini/GeminiLiveClient.ts
import { GeminiLiveWebsocketTransport } from '@pipecat-ai/gemini-live-websocket-transport';

export class GeminiLiveClient {
  private transport: GeminiLiveWebsocketTransport;
  
  constructor(apiKey: string) {
    this.transport = new GeminiLiveWebsocketTransport({
      apiKey,
      model: 'gemini-2.0-flash-exp',
      // Configure audio/video settings
      audioFormat: 'pcm16',
      sampleRate: 16000,
    });
  }
  
  async connect() {
    await this.transport.connect();
  }
  
  // Implement bidirectional streaming methods
}
Fix 2: Implement MSAL.js for SPA Authentication
Replace NextAuth with MSAL for client-side auth:
typescript// src/lib/auth/msal-config.ts
import { PublicClientApplication } from '@azure/msal-browser';

export const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ENTRA_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_APP_URL + '/auth/callback',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
Fix 3: Use Supabase Edge Functions for WebSocket
Deploy a Supabase Edge Function to handle WebSocket connections:
typescript// supabase/functions/gemini-live/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Connect to Gemini Live API
  // Handle bidirectional streaming
  
  return response;
});
Fix 4: Update Environment Variables
Add these to your .env.local and production environment:
env# Gemini Live API
NEXT_PUBLIC_GEMINI_API_KEY=your-api-key
NEXT_PUBLIC_GEMINI_LIVE_ENDPOINT=wss://your-gemini-endpoint

# MSAL Configuration
NEXT_PUBLIC_ENTRA_CLIENT_ID=bfa77df6-6952-4d0f-9816-003b3101b9da
NEXT_PUBLIC_ENTRA_TENANT_ID=29ee1479-b5f7-48c5-b665-7de9a8a9033e
NEXT_PUBLIC_ENTRA_REDIRECT_URI=https://eva.thewell.solutions/auth/callback

# Remove server-side auth secrets from client
🚀 Implementation Steps

Install MSAL:
bashnpm install @azure/msal-browser @azure/msal-react

Update Azure App Registration:

Change to SPA platform (not Web)
Add redirect URIs for SPA
Enable PKCE
Remove client secret requirement


Deploy Supabase Edge Function:
bashsupabase functions deploy gemini-live --no-verify-jwt

Test WebSocket Connection:
javascript// Test in browser console
const ws = new WebSocket('wss://your-supabase-url/functions/v1/gemini-live');
ws.onopen = () => console.log('Connected!');


📋 Quick Validation
Run these commands to verify your setup:
bash# Check if Pipecat package is properly installed
npm list @pipecat-ai/gemini-live-websocket-transport

# Test Supabase Edge Function
curl https://your-supabase-url/functions/v1/gemini-live

# Verify environment variables
node -e "console.log(process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID)"
Would you like me to help you implement any of these fixes step by step? I can also create the proper WebSocket client implementation or help configure MSAL for your SPA authentication.Claude can make mistakes. Please double-check responses.