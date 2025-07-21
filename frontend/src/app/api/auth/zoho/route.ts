import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/middleware/rate-limit';

/**
 * GET /api/auth/zoho
 * Initiate Zoho OAuth authorization flow
 */
export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations`;
    
    // Check if user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Zoho OAuth configuration
    const clientId = process.env.ZOHO_CLIENT_ID;
    if (!clientId) {
      console.error('ZOHO_CLIENT_ID not configured');
      return NextResponse.json(
        { error: 'Zoho OAuth not configured' },
        { status: 500 }
      );
    }

    const authUrl = new URL('https://accounts.zoho.com/oauth/v2/auth');
    authUrl.searchParams.set('scope', 'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.READ');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoho/callback`);
    authUrl.searchParams.set('state', JSON.stringify({ 
      userId: user.id,
      redirectUri 
    }));

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('Zoho OAuth init error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}, 'oauth-init');

/**
 * POST /api/auth/zoho
 * Handle manual token submission (for development/testing)
 */
export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const { access_token, refresh_token, expires_in, api_domain } = await request.json();

    if (!access_token) {
      return NextResponse.json(
        { error: 'Access token required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Store tokens in database
    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: user.id,
        provider: 'zoho',
        access_token,
        refresh_token,
        expires_at: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(),
        metadata: { api_domain },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (tokenError) {
      console.error('Error storing Zoho tokens:', tokenError);
      return NextResponse.json(
        { error: 'Failed to store tokens' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Zoho tokens stored successfully'
    });

  } catch (error) {
    console.error('Zoho token storage error:', error);
    return NextResponse.json(
      { error: 'Failed to store tokens' },
      { status: 500 }
    );
  }
}, 'oauth-token');