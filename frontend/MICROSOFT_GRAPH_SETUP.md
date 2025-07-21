# Microsoft Graph Integration Setup for EVA Assistant (2025 Requirements)

This document provides a comprehensive guide for setting up Microsoft Graph integration in the EVA Assistant application, updated for Microsoft Entra ID 2025 requirements.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Azure AD App Registration](#azure-ad-app-registration)
3. [Permissions Configuration](#permissions-configuration)
4. [Environment Variables](#environment-variables)
5. [Authentication Flow](#authentication-flow)
6. [2025 Specific Requirements](#2025-specific-requirements)
7. [Testing the Integration](#testing-the-integration)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Azure Active Directory (Azure AD) / Microsoft Entra ID tenant
- Microsoft 365 or Outlook.com account
- Admin access to Azure AD (for app registration)
- Understanding of OAuth 2.0 with PKCE flow

## 1. Azure AD App Registration

### Step 1: Create App Registration

1. Navigate to the [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** (formerly Azure AD) → **App registrations** → **New registration**
3. Fill in the registration details:
   - **Name**: `EVA Assistant`
   - **Supported account types**: `Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts`
   - **Redirect URI**: 
     - **Platform**: `Single-page application (SPA)` ⚠️ **CRITICAL: Must be SPA, not Web**
     - **URIs**: 
       - `http://localhost:3000/auth/microsoft/callback` (development)
       - `https://your-domain.com/auth/microsoft/callback` (production)

### Step 2: Configure Authentication

1. In **Authentication** section:
   - ✅ Ensure all redirect URIs are under **Single-page application** platform
   - ✅ Enable **Allow public client flows**: `Yes`
   - ✅ Remove any **Web** platform configurations (causes AADSTS700025 error)

### Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `openid` - Sign in (REQUIRED for PKCE flow)
   - `email` - View email address
   - `profile` - View basic profile
   - `offline_access` - Maintain access (REQUIRED for refresh tokens)
   - `User.Read` - Sign in and read user profile
   - `Calendars.ReadWrite` - Access user calendars
   - `Mail.ReadWrite` - Access user mail
   - `Mail.Send` - Send mail as user
   - `Contacts.ReadWrite` - Access user contacts
   - `Files.ReadWrite.All` - Access user files
4. **Grant admin consent** if you have admin rights

### Step 4: Note Application Details

From your app registration overview:
- **Application (client) ID** → `NEXT_PUBLIC_MICROSOFT_CLIENT_ID`
- **Directory (tenant) ID** → `NEXT_PUBLIC_MICROSOFT_TENANT_ID`

## 2. Environment Variables

Add to your `.env.local` file:

```bash
# Client-side variables (public) - REQUIRED
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your-client-id-here
NEXT_PUBLIC_MICROSOFT_TENANT_ID=your-tenant-id-here
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/microsoft/callback

# Server-side variables (for API calls) - REQUIRED
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_TENANT_ID=your-tenant-id-here

# DO NOT include MICROSOFT_CLIENT_SECRET for SPAs!
# SPAs are public clients and cannot securely store secrets
```

## 3. Authentication Flow

### PKCE (Proof Key for Code Exchange) Implementation

The app implements the OAuth 2.0 authorization code flow with PKCE, which is mandatory for SPAs:

1. **Code Verifier**: 43-character cryptographically random string
2. **Code Challenge**: SHA256 hash of verifier, base64url encoded
3. **Response Type**: `code id_token` (updated for 2025)
4. **Response Mode**: `fragment` (prevents CORS issues)
5. **Nonce**: Included for replay attack prevention

### Multi-Layer Storage Strategy

To handle various browser configurations and security settings:

1. **SessionStorage** (primary)
2. **LocalStorage** (fallback)
3. **Cookies** (tertiary fallback)
4. **Window object** (quaternary fallback)
5. **Timestamped keys** (conflict prevention)
6. **State parameter** (ultimate fallback - includes PKCE verifier)

## 4. 2025 Specific Requirements

### Critical Updates for 2025 Compliance

1. **24-Hour Refresh Token Expiration**
   - SPAs have a hard limit of 24 hours for refresh tokens
   - Users must re-authenticate every 24 hours
   - Implement graceful handling with countdown timers

2. **Mandatory MFA (Multi-Factor Authentication)**
   - Starting February 2025: MFA required for Microsoft 365 admin center
   - Starting September 2025: MFA required for Azure CLI, PowerShell, and APIs
   - Prepare users for increased authentication requirements

3. **Response Type Requirements**
   - Use `response_type=code id_token` (not just `code`)
   - Include `nonce` parameter for security
   - Use `response_mode=fragment` to avoid CORS issues

4. **CORS Configuration**
   - Redirect URIs MUST be registered as SPA type
   - Web platform registrations will cause CORS errors
   - Error: "cross-origin token redemption is permitted only for the 'Single-Page Application' client-type"

## 5. Token Management

### Access Token
- Lifetime: 1 hour
- Automatically refreshed using refresh token

### Refresh Token
- Lifetime: 24 hours (hard limit for SPAs)
- Cannot be extended beyond 24 hours
- Requires user re-authentication after expiry

### Implementation Features
- Automatic token refresh before expiration
- 24-hour countdown timer
- Graceful re-authentication prompts
- Token storage in secure database

## 6. Testing the Integration

### Development Testing

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Test authentication flow**:
   - Navigate to sign-in page
   - Click "Sign in with Microsoft"
   - Complete authentication
   - Verify redirect to dashboard

3. **Test token refresh**:
   - Wait for access token to near expiration (50 minutes)
   - Verify automatic refresh occurs
   - Check 24-hour limit handling

### Production Testing

1. Verify all redirect URIs are registered
2. Test with different account types:
   - Personal Microsoft accounts
   - Work/school accounts
   - Multi-tenant scenarios
3. Test error scenarios:
   - Expired refresh tokens
   - Revoked permissions
   - Network failures

## 7. Common Issues and Solutions

### AADSTS700025 Error
**Error**: "Client is public so neither 'client_assertion' nor 'client_secret' should be presented"

**Solution**: 
- Remove client_secret from token exchange
- Ensure app is registered as SPA, not Web
- Check that PKCE parameters are included

### State Mismatch Error
**Error**: "State mismatch - possible CSRF attack"

**Solution**:
- Check browser cookie settings
- Verify storage APIs are not blocked
- Ensure redirect URI matches exactly
- Check for URL encoding issues

### CORS Error
**Error**: "cross-origin token redemption is permitted only for the 'Single-Page Application' client-type"

**Solution**:
- Change platform from Web to SPA in app registration
- Update all redirect URIs to SPA platform
- Use response_mode=fragment

### 24-Hour Token Expiration
**Error**: "Refresh token expired - reauthentication required"

**Solution**:
- This is expected behavior for SPAs
- Implement user-friendly re-authentication flow
- Show countdown timer for token expiration
- Store initial authentication timestamp

## 8. Security Best Practices

1. **Never store client secrets in SPAs**
2. **Always use PKCE for authorization code flow**
3. **Implement proper state validation**
4. **Handle token storage securely**
5. **Prepare for mandatory MFA in 2025**
6. **Implement proper error handling**
7. **Use HTTPS in production**
8. **Validate all redirect URIs**

## 9. Migration from Implicit Flow

If migrating from implicit flow:

1. **Update app registration**:
   - Change platform to SPA
   - Remove implicit grant settings

2. **Update authentication code**:
   - Implement PKCE flow
   - Update to MSAL.js v3 or later
   - Change response_type to `code id_token`

3. **Test thoroughly**:
   - Verify token acquisition
   - Test refresh token handling
   - Ensure 24-hour limit is handled

## 10. Support Resources

- [Microsoft Entra ID Documentation](https://docs.microsoft.com/en-us/entra/identity-platform/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [OAuth 2.0 with PKCE](https://oauth.net/2/pkce/)
- [SPA Authentication Best Practices](https://docs.microsoft.com/en-us/entra/identity-platform/scenario-spa-overview)

## Important Notes

- This implementation follows Microsoft's 2025 requirements for SPAs
- Regular updates may be needed as Microsoft updates their platform
- Monitor Microsoft's identity platform blog for changes
- Test thoroughly before deploying to production