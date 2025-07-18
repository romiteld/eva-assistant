# Microsoft OAuth Client Secret Security Assessment Report

**Date**: 2025-07-18  
**Severity**: HIGH  
**Status**: Client secret is NOT exposed in client-side code, but configuration issues exist

## Executive Summary

The Microsoft OAuth client secret (`Z_z8Q~KRb~Qek1dewI8OC6wzqjdypY6XR8hTeamA`) is currently protected from client-side exposure. However, there are configuration issues and potential security risks that need immediate attention.

## 1. Current Security Status

### ✅ What's Working Well:
- Client secret is properly handled server-side in `/api/auth/microsoft/token/route.ts`
- Frontend uses PKCE flow without exposing the secret
- OAuth tokens are stored encrypted in the database
- No hardcoded secrets found in client-side code

### ⚠️ Security Concerns:
1. **Configuration Issue**: `.env.example` incorrectly suggests using `NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET`
2. **Agent Architecture Risk**: `enhanced-lead-generation.ts` references client secrets (lines 99, 105, 110, 116, 121)
3. **Multiple Files**: Several server-side files reference the client secret environment variable

## 2. Risk Assessment

### Impact if Exposed:
- **Authentication Bypass**: Attackers could impersonate your application
- **Data Access**: Unauthorized access to Microsoft Graph API and user data
- **Rate Limit Abuse**: Exhausting your API quotas
- **Reputation Damage**: Security breach affecting user trust

### Current Risk Level: **MEDIUM**
- Secret is not exposed client-side ✅
- Configuration suggests dangerous practice ⚠️
- Agent architecture could lead to accidental exposure ⚠️

## 3. Immediate Actions Required

### 🚨 Action 1: Rotate the Client Secret
```bash
# Steps:
1. Go to Azure Portal → App Registrations
2. Select your app (ID: bfa77df6-6952-4d0f-9816-003b3101b9da)
3. Navigate to Certificates & secrets
4. Delete the current secret
5. Generate a new client secret
6. Update your .env files with the new secret
```

### 🚨 Action 2: Update Environment Variables
Update your `.env` and `.env.local` files:
```env
# CORRECT - Server-side only
MICROSOFT_CLIENT_SECRET=your_new_secret_here

# NEVER DO THIS
# NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET=NEVER_EXPOSE_THIS
```

## 4. Code Changes Needed

### Fix 1: Enhanced Lead Generation Agent
The `enhanced-lead-generation.ts` file should not handle OAuth credentials directly.

**File**: `/frontend/src/lib/agents/enhanced-lead-generation.ts`

**Current Issue** (lines 96-101):
```typescript
microsoft: {
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '', // SECURITY RISK
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common'
}
```

**Solution**: Move OAuth operations to server-side API routes:

1. Create a new API route: `/app/api/agents/oauth-refresh/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();
    const supabase = await createClient();
    
    // Get user's stored tokens
    const { data: tokens } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('provider', provider)
      .single();
    
    // Handle token refresh server-side
    // Client secrets stay on server
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

2. Update the agent to use the API:
```typescript
// In enhanced-lead-generation.ts
private async refreshOAuthToken(provider: string) {
  const response = await fetch('/api/agents/oauth-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider })
  });
  return response.json();
}
```

### Fix 2: LinkedIn Profile Route Security
Similar issues in `/app/api/linkedin/profile/route.ts` need the same treatment.

### Fix 3: Test File Security
Update `/app/api/__tests__/auth.integration.test.ts` to use mock values:
```typescript
// Use clearly fake test values
process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret-never-real'
```

## 5. Architecture Recommendations

### Implement a Token Service Pattern:
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API Routes  │────▶│  Token      │
│   (No Keys) │     │  (No Secrets)│     │  Service    │
└─────────────┘     └──────────────┘     │  (Secrets)  │
                                          └─────────────┘
```

### Benefits:
- Complete separation of concerns
- Centralized secret management
- Easier key rotation
- Better audit trails

## 6. Security Best Practices

### Environment Variable Rules:
1. **NEVER** prefix secrets with `NEXT_PUBLIC_`
2. Store secrets only in server-side environment variables
3. Use separate `.env` files for different environments
4. Add `.env*` to `.gitignore`

### Code Review Checklist:
- [ ] No secrets in client-side code
- [ ] No secrets in repository
- [ ] API routes handle all OAuth operations
- [ ] Tokens stored encrypted in database
- [ ] Regular secret rotation schedule

## 7. Implementation Plan

### Phase 1: Immediate (Today)
1. Rotate the client secret in Azure Portal
2. Update environment variables
3. Fix `.env.example` file warnings
4. Deploy updated configuration

### Phase 2: Short-term (This Week)
1. Create OAuth refresh API routes
2. Update `enhanced-lead-generation.ts` agent
3. Update LinkedIn integration routes
4. Add security tests

### Phase 3: Long-term (This Month)
1. Implement centralized token service
2. Add secret rotation automation
3. Set up security monitoring
4. Conduct security audit

## 8. Monitoring & Compliance

### Set up monitoring for:
- Unusual OAuth token requests
- Failed authentication attempts
- API rate limit warnings
- Secret exposure in logs

### Compliance Requirements:
- SOC 2 Type II: Requires encrypted secret storage
- GDPR: Protect user authentication data
- ISO 27001: Regular security assessments

## 9. Testing the Fix

After implementing changes:
```bash
# 1. Check for exposed secrets
grep -r "NEXT_PUBLIC_.*SECRET" src/

# 2. Verify server-side only usage
grep -r "process.env.MICROSOFT_CLIENT_SECRET" src/

# 3. Test OAuth flow
npm run test:auth

# 4. Security scan
npm audit
```

## 10. Incident Response Plan

If secret is ever exposed:
1. **Immediately** rotate the secret in Azure Portal
2. Review audit logs for unauthorized usage
3. Notify affected users if data was accessed
4. Update all deployed environments
5. Conduct post-mortem analysis

## Conclusion

While the client secret is currently not exposed in client-side code, the configuration and architecture pose risks. Immediate action is required to rotate the secret and implement the recommended changes to prevent future security incidents.

**Next Steps**:
1. Rotate the secret NOW
2. Implement Phase 1 changes today
3. Schedule Phase 2 implementation
4. Set up monitoring alerts

**Security Contact**: security@thewell.solutions