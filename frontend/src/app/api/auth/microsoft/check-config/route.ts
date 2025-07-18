import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/microsoft/check-config
 * Check Microsoft OAuth configuration
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.ENTRA_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.ENTRA_TENANT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.ENTRA_CLIENT_SECRET;
  
  return NextResponse.json({
    configured: !!(clientId && tenantId),
    hasSecret: !!clientSecret,
    publicClientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID,
    publicTenantId: process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.NEXT_PUBLIC_ENTRA_TENANT_ID,
    appType: clientSecret ? 'confidential' : 'public',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/microsoft/callback`,
    note: 'If you are getting AADSTS9002327, ensure your Azure AD app is configured as a Web application (not SPA) since we are using server-side token exchange.'
  });
}