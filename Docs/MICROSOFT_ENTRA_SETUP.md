# Microsoft Entra ID Integration Setup

This guide explains how to configure Microsoft Entra ID (formerly Azure AD) authentication for the EVA Assistant application.

## Overview

The EVA Assistant supports dual authentication methods:
1. **Magic Link Authentication** (via Supabase) - for simple email-based login
2. **Microsoft Entra ID OAuth 2.0** - for enterprise users with Microsoft 365 integration

## Environment Variables

Add these variables to your `.env.local` file:

```bash
# Microsoft Entra ID Configuration
ENTRA_CLIENT_ID=your-client-id-from-carlos
ENTRA_CLIENT_SECRET=your-secret-value-from-carlos
ENTRA_TENANT_ID=your-tenant-id-from-carlos
NEXT_PUBLIC_ENTRA_CLIENT_ID=your-client-id-from-carlos
NEXT_PUBLIC_ENTRA_TENANT_ID=your-tenant-id-from-carlos

# NextAuth Configuration
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Supabase Configuration (existing)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Microsoft Graph API Permissions

The app registration includes these delegated permissions:
- `User.Read` - Basic sign-in
- `offline_access` - Refresh tokens
- `Mail.ReadWrite`, `Mail.Send` - Inbox triage + send drafted replies
- `MailboxSettings.Read` - Read user timezone for scheduling
- `Calendars.ReadWrite` - Create/edit events
- `OnlineMeetings.ReadWrite` - Auto-generate Teams/Zoom links
- `Contacts.ReadWrite` - Push new candidate/client contacts
- `Sites.Read.All` - Pull attachments from SharePoint/OneDrive

## Authentication Flow

1. User clicks "Sign in with Microsoft" on login page
2. Redirected to Microsoft login
3. After successful authentication, redirected back to `/api/auth/callback`
4. OAuth tokens stored in `user_integrations` table in Supabase
5. Tokens automatically refreshed when expired

## API Usage Examples

### Fetch User's Emails
```javascript
const response = await fetch('/api/microsoft/emails');
const emails = await response.json();
```

### Send Email
```javascript
const response = await fetch('/api/microsoft/emails', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Meeting Follow-up',
    content: '<p>Thank you for the meeting today...</p>'
  })
});
```

### Using Graph Client Directly
```javascript
import { graphHelpers } from '@/lib/microsoft/graph-client';

// Get calendar events
const events = await graphHelpers.getCalendarEvents(userId, {
  startDateTime: '2025-01-01T00:00:00Z',
  endDateTime: '2025-01-31T23:59:59Z'
});

// Create a contact
const contact = await graphHelpers.createContact(userId, {
  givenName: 'John',
  surname: 'Doe',
  emailAddresses: [{
    address: 'john.doe@example.com',
    name: 'John Doe'
  }]
});
```

## Database Schema

The `user_integrations` table stores OAuth tokens:

```sql
CREATE TABLE public.user_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    scope TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);
```

## Troubleshooting

### Token Refresh Issues
- Tokens are automatically refreshed when expired
- Check `expires_at` field in `user_integrations` table
- Ensure `ENTRA_CLIENT_SECRET` is correct in environment

### Permission Errors
- Verify all required scopes are granted in Entra ID app registration
- Admin consent may be required for some permissions
- Check if user has necessary licenses in Microsoft 365

### Callback URL Mismatch
- Ensure redirect URIs in Entra ID match exactly:
  - Production: `https://eva.thewell.solutions/api/auth/callback`
  - Local: `http://localhost:3000/api/auth/callback`

## Security Considerations

1. **Token Storage**: OAuth tokens are encrypted at rest in Supabase
2. **RLS Policies**: Users can only access their own integration data
3. **Token Refresh**: Automatic refresh prevents expired token usage
4. **Scope Limitation**: Only requested scopes are accessible

## Next Steps

1. Test Microsoft login on local environment
2. Verify Graph API calls work correctly
3. Deploy to production with proper environment variables
4. Monitor token refresh and API usage

For questions or issues, contact the development team.
