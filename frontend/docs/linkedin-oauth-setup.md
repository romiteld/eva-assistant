# LinkedIn OAuth Setup Guide

## Prerequisites
- LinkedIn Developer Account
- Access to LinkedIn Developer Portal (https://www.linkedin.com/developers/)

## Step 1: Create LinkedIn App

1. Go to https://www.linkedin.com/developers/
2. Click "Create app"
3. Fill in the app details:
   - **App name**: EVA Assistant
   - **LinkedIn Page**: Select or create a company page
   - **App logo**: Upload your app logo
   - **Legal agreement**: Check the box

## Step 2: Configure OAuth Settings

1. In your app dashboard, go to the "Auth" tab
2. Add OAuth 2.0 redirect URLs:
   ```
   http://localhost:3000/auth/linkedin/callback
   https://your-production-domain.com/auth/linkedin/callback
   ```

3. Request access to the following OAuth 2.0 scopes:
   - `r_liteprofile` - Read basic profile information
   - `r_emailaddress` - Read email address
   - `w_member_social` - Post on behalf of the user (optional)

## Step 3: Get Your Credentials

1. Go to the "Auth" tab
2. Copy your:
   - **Client ID**
   - **Client Secret**

## Step 4: Configure Environment Variables

Add the following to your `.env.local` file:

```env
# LinkedIn OAuth
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback
```

## Step 5: Product Access Request

For production use, you'll need to request access to certain products:

1. Go to "Products" tab in your LinkedIn app
2. Request access to:
   - **Share on LinkedIn** - For posting capabilities
   - **Sign In with LinkedIn** - For authentication
   - **Marketing Developer Platform** (if needed for advanced features)

## Rate Limits

LinkedIn enforces the following rate limits:
- **Daily Application Rate Limit**: 500,000 requests per day
- **Daily Member Rate Limit**: 100 requests per day per member
- **Throttle Limit**: 3 calls per second per member

## Important Notes

1. **Development vs Production**: In development mode, you can only authenticate users who are admins of your LinkedIn app
2. **Profile Data**: The `r_liteprofile` scope provides limited data. For full profile access, you need `r_fullprofile` which requires special approval
3. **Token Expiry**: LinkedIn access tokens expire after 60 days
4. **Refresh Tokens**: LinkedIn supports refresh tokens which expire after 1 year

## Security Best Practices

1. Never expose your Client Secret in client-side code
2. Always validate the state parameter to prevent CSRF attacks
3. Use HTTPS in production
4. Store tokens securely (encrypted in database)
5. Implement proper token refresh logic

## Testing

To test your integration:
1. Add test users as app administrators in the LinkedIn Developer Portal
2. Use the test redirect URL for local development
3. Monitor the rate limits in the Analytics section