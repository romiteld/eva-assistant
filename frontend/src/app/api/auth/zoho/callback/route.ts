import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/middleware/rate-limit';

/**
 * GET /api/auth/zoho/callback
 * Handle Zoho OAuth callback and exchange code for tokens
 */
export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Handle OAuth errors
    if (error) {
      console.error('Zoho OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=oauth_error`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=missing_parameters`);
    }

    // Parse state
    let stateData: { userId: string; redirectUri: string };
    try {
      stateData = JSON.parse(state);
    } catch {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=invalid_state`);
    }

    // Verify user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== stateData.userId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=unauthorized`);
    }

    // Exchange code for tokens
    const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Zoho OAuth credentials not configured');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=config_error`);
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoho/callback`,
      code,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Zoho token exchange failed:', errorData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Zoho token response error:', tokenData.error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=token_error`);
    }

    // Get user info to determine API domain
    const userInfoResponse = await fetch(`${tokenData.api_domain || 'https://www.zohoapis.com'}/crm/v2/users/me`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
      },
    });

    let apiDomain = tokenData.api_domain || 'https://www.zohoapis.com';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      // Store additional user metadata if needed
    }

    // Store tokens in database
    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: user.id,
        provider: 'zoho',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        metadata: { 
          api_domain: apiDomain,
          scope: tokenData.scope
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (tokenError) {
      console.error('Error storing Zoho tokens:', tokenError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=storage_error`);
    }

    // Log successful connection
    await supabase.from('integration_events').insert({
      user_id: user.id,
      provider: 'zoho',
      event_type: 'connected',
      metadata: {
        api_domain: apiDomain,
        scope: tokenData.scope
      },
    });

    // Redirect to success page
    const redirectUrl = stateData.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations`;
    return NextResponse.redirect(`${redirectUrl}?success=zoho_connected`);

  } catch (error) {
    console.error('Zoho OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=callback_error`);
  }
}, 'oauth-callback');