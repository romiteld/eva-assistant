import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/middleware/rate-limit';

/**
 * POST /api/auth/zoho/disconnect
 * Disconnect Zoho integration and revoke tokens
 */
export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get existing tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'zoho')
      .single();

    if (tokenError && tokenError.code !== 'PGRST116') {
      console.error('Error fetching Zoho tokens:', tokenError);
    }

    // Revoke tokens with Zoho if they exist
    if (tokenData?.access_token) {
      try {
        const revokeUrl = 'https://accounts.zoho.com/oauth/v2/token/revoke';
        const clientId = process.env.ZOHO_CLIENT_ID;
        const clientSecret = process.env.ZOHO_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const revokeParams = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            token: tokenData.access_token,
          });

          const revokeResponse = await fetch(revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: revokeParams.toString(),
          });

          if (!revokeResponse.ok) {
            console.warn('Failed to revoke Zoho token:', await revokeResponse.text());
          }
        }
      } catch (error) {
        console.error('Error revoking Zoho tokens:', error);
        // Continue with local cleanup even if revocation fails
      }
    }

    // Remove tokens from database
    const { error: deleteError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'zoho');

    if (deleteError) {
      console.error('Error deleting Zoho tokens:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect Zoho integration' },
        { status: 500 }
      );
    }

    // Log disconnection event
    await supabase.from('integration_events').insert({
      user_id: user.id,
      provider: 'zoho',
      event_type: 'disconnected',
      metadata: {},
    });

    return NextResponse.json({ 
      success: true,
      message: 'Zoho integration disconnected successfully'
    });

  } catch (error) {
    console.error('Zoho disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Zoho integration' },
      { status: 500 }
    );
  }
}, 'oauth-disconnect');