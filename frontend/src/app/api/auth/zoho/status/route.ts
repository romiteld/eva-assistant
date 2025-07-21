import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/middleware/rate-limit';

/**
 * GET /api/auth/zoho/status
 * Check Zoho integration status and token validity
 */
export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at, metadata, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('provider', 'zoho')
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({
        connected: false,
        status: 'not_connected',
        message: 'Zoho integration not set up'
      });
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const isExpired = expiresAt <= now;
    const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    // Test token validity by making a simple API call
    let isValid = false;
    let userInfo = null;
    let rateLimitInfo = null;

    if (!isExpired) {
      try {
        const apiDomain = tokenData.metadata?.api_domain || 'https://www.zohoapis.com';
        const testResponse = await fetch(`${apiDomain}/crm/v2/users/me`, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (testResponse.ok) {
          isValid = true;
          const responseData = await testResponse.json();
          userInfo = responseData.users?.[0] || responseData;
          
          // Extract rate limit info from headers
          rateLimitInfo = {
            limit: testResponse.headers.get('x-ratelimit-limit'),
            remaining: testResponse.headers.get('x-ratelimit-remaining'),
            reset: testResponse.headers.get('x-ratelimit-reset')
          };
        } else {
          const errorText = await testResponse.text();
          console.error('Zoho API test failed:', testResponse.status, errorText);
        }
      } catch (error) {
        console.error('Error testing Zoho token:', error);
      }
    }

    return NextResponse.json({
      connected: isValid,
      status: isValid ? 'connected' : (isExpired ? 'expired' : 'invalid'),
      expires_at: tokenData.expires_at,
      expires_in_minutes: expiresInMinutes,
      api_domain: tokenData.metadata?.api_domain || 'https://www.zohoapis.com',
      scope: tokenData.metadata?.scope,
      connected_at: tokenData.created_at,
      last_refreshed: tokenData.updated_at,
      user_info: userInfo ? {
        id: userInfo.id,
        full_name: userInfo.full_name,
        email: userInfo.email,
        role: userInfo.role?.name,
        org: userInfo.org?.company_name
      } : null,
      rate_limit: rateLimitInfo
    });

  } catch (error) {
    console.error('Zoho status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check Zoho status' },
      { status: 500 }
    );
  }
}, 'oauth-status');