# Zoom Connector Configuration for EVA Assistant

Fill in the following values in the Zoom connector form:

## Field Values:

### 1. Connection Name
```
EVA Recruitment Assistant
```

### 2. Base URL
```
https://eva.thewell.solutions/api
```

### 3. Add To
Select the appropriate option from the dropdown (likely your Zoom account or organization)

### 4. Algorithm
Keep as `HS256` (already selected)

### 5. Secret
Use your ZOOM_WEBHOOK_SECRET_TOKEN from your environment variables. This is used to sign and verify webhook requests between Zoom and EVA Assistant.

### 6. Payload(Token)
Create a JWT payload with the following structure:

```json
{
  "iss": "eva-assistant",
  "sub": "zoom-connector",
  "aud": "https://api.zoom.us",
  "iat": 1736937600,
  "exp": 1768473600,
  "jti": "eva-zoom-connector-001",
  "scope": "meeting:write meeting:read user:read recording:read webhook:write",
  "app_key": "YOUR_ZOOM_CLIENT_ID"
}
```

## How to Generate the JWT Token:

You can use this Node.js script to generate the token:

```javascript
const jwt = require('jsonwebtoken');

const payload = {
  iss: "eva-assistant",
  sub: "zoom-connector", 
  aud: "https://api.zoom.us",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year expiry
  jti: "eva-zoom-connector-001",
  scope: "meeting:write meeting:read user:read recording:read webhook:write",
  app_key: process.env.ZOOM_CLIENT_ID
};

const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

console.log("JWT Token:", token);
```

## Important Notes:

1. Make sure your production environment has these environment variables set:
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`
   - `ZOOM_WEBHOOK_SECRET_TOKEN`
   - `ZOOM_REDIRECT_URI=https://eva.thewell.solutions/api/auth/zoom/callback`

2. The Base URL should match your production API endpoint

3. The Secret must be the same one used in your webhook signature verification

4. After configuration, Zoom will send webhooks to your endpoints for meeting events

## Webhook Endpoints that will receive events:
- `/api/webhooks/zoom` - Main webhook endpoint
- `/api/webhooks/zoom/chat` - Chat-specific webhooks

## OAuth Callback:
- `/api/auth/zoom/callback` - OAuth authorization callback