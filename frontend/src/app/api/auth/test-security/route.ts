import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/test-security
 * Test endpoint to verify OAuth security configuration
 */
export async function GET(request: NextRequest) {
  const securityChecks = {
    // Check environment variables
    microsoftClientId: !!process.env.MICROSOFT_CLIENT_ID,
    microsoftClientSecretExists: !!process.env.MICROSOFT_CLIENT_SECRET,
    microsoftTenantId: !!process.env.MICROSOFT_TENANT_ID,
    
    // Check if running in browser (should be false for API routes)
    isServerSide: typeof window === 'undefined',
    
    // Check public environment variables
    publicMicrosoftClientId: !!process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
    
    // Security warnings
    warnings: [] as string[]
  };

  // Add warnings if secrets might be exposed
  if (typeof window !== 'undefined') {
    securityChecks.warnings.push('This route is running client-side - security risk!');
  }
  
  // Check if client secret is exposed in public env vars
  if (process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET) {
    securityChecks.warnings.push('CRITICAL: Client secret exposed in NEXT_PUBLIC environment variable!');
  }

  return NextResponse.json({
    status: 'Security Check Complete',
    timestamp: new Date().toISOString(),
    checks: securityChecks,
    recommendation: securityChecks.warnings.length === 0 
      ? 'OAuth configuration appears secure' 
      : 'Security issues detected - review warnings'
  });
}