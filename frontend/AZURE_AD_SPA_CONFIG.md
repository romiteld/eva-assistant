# Azure AD Single-Page Application (SPA) Configuration

## Error: AADSTS700025 Fix

If you're seeing the error:
```
AADSTS700025: Client is public so neither 'client_assertion' nor 'client_secret' should be presented.
```

This means your Azure AD app is configured as a SPA (public client) but the code was trying to use a client secret. This has been fixed in the codebase.

## Correct Azure AD Configuration for SPAs

### 1. App Registration Platform Configuration

In the Azure Portal:

1. Go to your App Registration
2. Navigate to **Authentication** → **Platform configurations**
3. Ensure you have **Single-page application** platform added (NOT Web)
4. Your redirect URIs should be under the SPA section:
   - `http://localhost:3000/auth/microsoft/callback` (development)
   - `https://your-domain.com/auth/microsoft/callback` (production)

### 2. Authentication Settings

Under **Authentication** → **Advanced settings**:
- ✅ Allow public client flows: **Yes**
- ✅ Enable the following mobile and desktop flows: **Yes** (optional, for future mobile support)

### 3. API Permissions

Ensure these Microsoft Graph permissions are granted:
- `User.Read` (Sign in and read user profile)
- `Calendars.ReadWrite` (Access calendars)
- `Mail.ReadWrite` (Access mail)
- `Mail.Send` (Send mail)
- `Contacts.ReadWrite` (Access contacts)
- `Files.ReadWrite.All` (Access files)

### 4. Environment Variables

For SPAs, you only need public configuration:

```env
# Client-side variables (public)
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your-client-id
NEXT_PUBLIC_MICROSOFT_TENANT_ID=your-tenant-id
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/microsoft/callback

# Server-side variables (still needed for API calls but NOT for authentication)
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_TENANT_ID=your-tenant-id
# DO NOT include MICROSOFT_CLIENT_SECRET for SPAs!
```

### 5. Important Notes

- **SPAs are public clients**: They cannot securely store secrets
- **Use PKCE flow**: This is automatically handled by the implementation
- **No client secrets**: Never include client_secret in SPA authentication flows
- **Token storage**: Tokens are stored securely in the browser and backend database

### 6. Testing the Fix

1. Clear your browser cache and cookies
2. Try signing in again with Microsoft
3. The authentication should now work without the AADSTS700025 error

### 7. Security Considerations

Even though SPAs are public clients, the implementation includes:
- PKCE (Proof Key for Code Exchange) for secure OAuth flow
- Secure token storage with multiple fallback mechanisms
- Proper CORS and redirect URI validation
- Token refresh handling

## Troubleshooting

If you still see authentication errors:

1. **Verify Platform Type**: Ensure your app is registered as "Single-page application"
2. **Check Redirect URIs**: Must exactly match what's in your code
3. **Clear Browser Data**: Sometimes old tokens can cause issues
4. **Review Permissions**: Ensure all required permissions are granted

## Migration from Web to SPA

If you previously had a "Web" platform configuration:

1. Add a new "Single-page application" platform
2. Copy your redirect URIs to the SPA configuration
3. Remove the "Web" platform configuration
4. Remove any client secrets from your environment variables
5. Restart your application

The application is now properly configured for SPA authentication with Microsoft Identity Platform.