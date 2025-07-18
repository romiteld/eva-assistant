import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/oauth/refresh
 * Universal OAuth token refresh endpoint - handles all providers server-side
 * This prevents exposing client secrets in client-side code
 */
export async function POST(request: NextRequest) {
  try {
    const { provider, refreshToken } = await request.json();

    if (!provider || !refreshToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provider-specific token refresh logic
    let tokenUrl: string;
    let clientId: string;
    let clientSecret: string;
    let refreshParams: URLSearchParams;

    switch (provider) {
      case 'microsoft':
        tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`;
        clientId = process.env.MICROSOFT_CLIENT_ID || '';
        clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
        
        refreshParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'openid email profile offline_access User.Read Mail.ReadWrite Mail.Send Calendar.ReadWrite Contacts.ReadWrite Files.ReadWrite.All Sites.ReadWrite.All'
        });
        break;

      case 'linkedin':
        tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
        clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || '';
        clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
        
        refreshParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });
        break;

      case 'google':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
        clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        
        refreshParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });
        break;

      case 'zoom':
        tokenUrl = 'https://zoom.us/oauth/token';
        clientId = process.env.ZOOM_CLIENT_ID || '';
        clientSecret = process.env.ZOOM_CLIENT_SECRET || '';
        
        // Zoom uses Basic Auth for client credentials
        const zoomAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        const zoomResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${zoomAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          }).toString(),
        });

        const zoomData = await zoomResponse.json();

        if (!zoomResponse.ok) {
          console.error('Zoom token refresh error:', zoomData);
          return NextResponse.json(
            { error: zoomData.reason || 'Token refresh failed' },
            { status: 400 }
          );
        }

        // Update stored tokens
        const { error: updateError } = await supabase
          .from('oauth_tokens')
          .update({
            access_token: zoomData.access_token,
            refresh_token: zoomData.refresh_token || refreshToken,
            expires_at: new Date(Date.now() + zoomData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider', provider);

        if (updateError) {
          console.error('Error updating tokens:', updateError);
          return NextResponse.json(
            { error: 'Failed to update tokens' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          access_token: zoomData.access_token,
          refresh_token: zoomData.refresh_token || refreshToken,
          expires_in: zoomData.expires_in,
          token_type: zoomData.token_type,
        });

      case 'salesforce':
        tokenUrl = 'https://login.salesforce.com/services/oauth2/token';
        clientId = process.env.SALESFORCE_CLIENT_ID || '';
        clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';
        
        refreshParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });
        break;

      case 'zoho':
        tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
        clientId = process.env.ZOHO_CLIENT_ID || '';
        clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
        
        refreshParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported provider' },
          { status: 400 }
        );
    }

    // Skip if we already handled the provider (like Zoom)
    if (provider === 'zoom') {
      return NextResponse.json({ success: true });
    }

    if (!clientSecret) {
      console.error(`${provider.toUpperCase()}_CLIENT_SECRET not configured`);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Refresh the token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: refreshParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(`${provider} token refresh error:`, tokenData);
      return NextResponse.json(
        { error: tokenData.error_description || 'Token refresh failed' },
        { status: 400 }
      );
    }

    // Update stored tokens in database
    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (updateError) {
      console.error('Error updating tokens:', updateError);
      return NextResponse.json(
        { error: 'Failed to update tokens' },
        { status: 500 }
      );
    }

    // Return new tokens (but not the client secret!)
    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}