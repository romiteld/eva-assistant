import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { zoomService } from '@/lib/services/zoom';
import { zoomServerToServerService } from '@/lib/services/zoom-server-to-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables first for system-level configuration
    const hasApiKey = !!process.env.ZOOM_API_KEY;
    const hasClientId = !!process.env.ZOOM_CLIENT_ID;
    const hasClientSecret = !!process.env.ZOOM_CLIENT_SECRET;
    const hasAccountId = !!process.env.ZOOM_ACCOUNT_ID;
    const hasWebhookSecret = !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    const webhookUrl = process.env.ZOOM_WEBHOOK_URL || 'https://eva.thewell.solutions/api/webhooks/zoom';

    // Determine configuration mode
    let mode = 'unconfigured';
    let isConfigured = false;
    let isAuthenticated = false;
    const issues: string[] = [];
    const recommendations: string[] = [];
    const missingVariables: string[] = [];

    if (hasApiKey && hasAccountId && hasClientId && hasClientSecret) {
      mode = 'server_to_server';
      isConfigured = true;
      
      try {
        await zoomServerToServerService.getAccessToken();
        isAuthenticated = true;
        recommendations.push('✅ Server-to-Server OAuth is working correctly');
      } catch (error) {
        isAuthenticated = false;
        issues.push('Failed to authenticate with Server-to-Server OAuth');
      }
      
      if (!hasWebhookSecret) {
        recommendations.push('💡 Consider adding ZOOM_WEBHOOK_SECRET_TOKEN for webhook signature verification');
      }
    } else if (hasClientId && hasClientSecret) {
      mode = 'oauth';
      isConfigured = true;
      
      try {
        // For traditional OAuth, check user authentication
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user) {
          // Check if user has Zoom credentials
          const { data: credentials, error: credentialsError } = await supabase
            .from('oauth_credentials')
            .select('provider, expires_at, scopes, metadata')
            .eq('user_id', user.id)
            .eq('provider', 'zoom')
            .single();

          if (!credentialsError && credentials) {
            const expiresAt = new Date(credentials.expires_at);
            const now = new Date();
            isAuthenticated = expiresAt > now;
            
            if (isAuthenticated) {
              recommendations.push('✅ Traditional OAuth is configured and authenticated');
            } else {
              recommendations.push('🔄 Zoom token expired - please reconnect');
            }
          } else {
            recommendations.push('🔗 Traditional OAuth configured - user authentication required');
          }
        } else {
          recommendations.push('🔗 Traditional OAuth configured - user login required');
        }
      } catch (error) {
        isAuthenticated = false;
        issues.push('Error checking traditional OAuth status');
      }
      
      if (!hasWebhookSecret) {
        issues.push('❌ ZOOM_WEBHOOK_SECRET_TOKEN is required for traditional OAuth webhook verification');
        missingVariables.push('ZOOM_WEBHOOK_SECRET_TOKEN');
      }
      
      recommendations.push('💡 Consider upgrading to Server-to-Server OAuth');
    } else {
      issues.push('❌ No valid Zoom configuration found');
      missingVariables.push('ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET');
    }

    // Check for missing variables based on mode
    if (mode === 'server_to_server') {
      if (!hasApiKey) {
        issues.push('❌ ZOOM_API_KEY is missing for Server-to-Server OAuth');
        missingVariables.push('ZOOM_API_KEY');
      }
      if (!hasAccountId) {
        issues.push('❌ ZOOM_ACCOUNT_ID is missing for Server-to-Server OAuth');
        missingVariables.push('ZOOM_ACCOUNT_ID');
      }
      if (!hasClientId) {
        issues.push('❌ ZOOM_CLIENT_ID is missing for Server-to-Server OAuth');
        missingVariables.push('ZOOM_CLIENT_ID');
      }
      if (!hasClientSecret) {
        issues.push('❌ ZOOM_CLIENT_SECRET is missing for Server-to-Server OAuth');
        missingVariables.push('ZOOM_CLIENT_SECRET');
      }
    } else if (mode === 'oauth') {
      if (!hasClientId) {
        issues.push('❌ ZOOM_CLIENT_ID is missing for OAuth');
        missingVariables.push('ZOOM_CLIENT_ID');
      }
      if (!hasClientSecret) {
        issues.push('❌ ZOOM_CLIENT_SECRET is missing for OAuth');
        missingVariables.push('ZOOM_CLIENT_SECRET');
      }
    }

    return NextResponse.json({
      isConfigured,
      mode,
      isAuthenticated,
      issues,
      recommendations,
      missingVariables,
      webhookUrl,
    });
  } catch (error) {
    console.error('Error checking Zoom auth status:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}