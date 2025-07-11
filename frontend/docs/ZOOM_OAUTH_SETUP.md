# Zoom OAuth App Configuration Guide

This guide will walk you through setting up a Zoom OAuth app for the EVA Assistant platform.

## Prerequisites
- A Zoom account with developer access
- Access to the Zoom App Marketplace

## Step 1: Create a Zoom OAuth App

1. Go to the [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click on **Develop** → **Build App**
4. Select **OAuth** as the app type
5. Click **Create**

## Step 2: Configure Basic Information

Fill in the following information:

- **App Name**: EVA Assistant
- **Short Description**: AI-powered recruitment platform with integrated video interviewing
- **Company Name**: The Well Recruiting Solutions
- **Developer Name**: Your name
- **Developer Email**: Your email

## Step 3: Configure OAuth Settings

### App Credentials
Save these credentials securely:
- **Client ID**: `ZOOM_CLIENT_ID`
- **Client Secret**: `ZOOM_CLIENT_SECRET`

### Redirect URLs
Add the following redirect URLs:
- Development: `http://localhost:3000/api/auth/zoom/callback`
- Production: `https://your-domain.com/api/auth/zoom/callback`

### OAuth Scopes
Request the following scopes for the integration:

**Meeting Scopes:**
- `meeting:write:admin` - Create, update, and delete meetings
- `meeting:read:admin` - View meeting details
- `meeting:read` - View meeting details for the user

**User Scopes:**
- `user:read` - View user information
- `user:read:email` - View user email

**Recording Scopes (optional):**
- `recording:read` - View cloud recordings
- `recording:write` - Manage cloud recordings

**Webinar Scopes (optional):**
- `webinar:read` - View webinar details
- `webinar:write` - Create and manage webinars

## Step 4: Configure App Features

### Deauthorization Endpoint
Set the deauthorization endpoint URL:
- `https://your-domain.com/api/auth/zoom/deauthorize`

### Event Subscriptions (Webhooks)
Enable event subscriptions and add the following event types:

1. **Meeting Events:**
   - `meeting.started`
   - `meeting.ended`
   - `meeting.participant_joined`
   - `meeting.participant_left`

2. **Recording Events:**
   - `recording.completed`
   - `recording.started`

Set the Event notification endpoint URL:
- `https://your-domain.com/api/webhooks/zoom`

### Webhook Verification Token
Generate and save the verification token for webhook security.

## Step 5: Development Settings

For local development, you can use ngrok to expose your local server:

```bash
ngrok http 3000
```

Then update your redirect URLs and webhook endpoints with the ngrok URL.

## Step 6: Testing

1. Click **Add** to install the app to your account
2. Test the OAuth flow by visiting:
   ```
   http://localhost:3000/api/auth/zoom
   ```

## Step 7: Production Deployment

Before going to production:

1. Update all URLs to use your production domain
2. Enable HTTPS for all endpoints
3. Set up proper error handling and logging
4. Implement token refresh logic
5. Add rate limiting to comply with Zoom's API limits

## Environment Variables

Add these to your `.env.local` file:

```env
# Zoom OAuth
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_REDIRECT_URI=http://localhost:3000/api/auth/zoom/callback
ZOOM_WEBHOOK_SECRET_TOKEN=your_webhook_secret

# Optional: For JWT App (deprecated but may be needed for some features)
ZOOM_JWT_API_KEY=your_jwt_api_key
ZOOM_JWT_API_SECRET=your_jwt_api_secret
```

## API Rate Limits

Be aware of Zoom's rate limits:
- **Daily limit**: 10,000 requests per day
- **Per-second limit**: 10 requests per second

Implement proper rate limiting and caching to stay within these limits.

## Security Best Practices

1. **Never expose your Client Secret** in client-side code
2. **Always validate webhooks** using the verification token
3. **Store tokens securely** in your database with encryption
4. **Implement token refresh** before expiration
5. **Log all API interactions** for debugging and audit purposes
6. **Use HTTPS** for all production endpoints

## Troubleshooting

### Common Issues:

1. **Invalid redirect URI**: Ensure the redirect URI in your app matches exactly
2. **Scope errors**: Make sure you've requested all necessary scopes
3. **Token expiration**: Implement automatic token refresh
4. **Webhook failures**: Check your endpoint is publicly accessible and returns 200 OK

## Resources

- [Zoom OAuth Documentation](https://marketplace.zoom.us/docs/guides/auth/oauth)
- [Zoom API Reference](https://marketplace.zoom.us/docs/api-reference/zoom-api)
- [Zoom Webhooks Documentation](https://marketplace.zoom.us/docs/api-reference/webhook-reference)