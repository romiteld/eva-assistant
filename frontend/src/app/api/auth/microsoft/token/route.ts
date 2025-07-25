import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/microsoft/token
 * Exchange authorization code for tokens using PKCE flow
 * 
 * IMPORTANT: This endpoint is designed for SPAs (Single-page applications)
 * which are public clients. Do NOT include client_secret in the token exchange.
 * 
 * If you see error AADSTS700025, it means your Azure AD app is configured
 * as a SPA/public client and you cannot use client secrets.
 */
export async function POST(request: NextRequest) {
  try {
    // Basic rate limiting - max 5 requests per minute per IP
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `oauth:${clientIp}:${Date.now()}`;
    
    // In a production environment, you would use Redis or similar for proper rate limiting
    // For now, this is a basic implementation
    
    const { code, codeVerifier, redirectUri } = await request.json();

    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing required parameters: code, codeVerifier, and redirectUri are all required' },
        { status: 400 }
      );
    }

    // Microsoft OAuth configuration - Use environment variables only
    const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.ENTRA_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.ENTRA_TENANT_ID;

    if (!clientId || !tenantId) {
      console.error('Microsoft OAuth configuration incomplete');
      return NextResponse.json(
        { error: 'Server configuration error: Missing client ID or tenant ID' },
        { status: 500 }
      );
    }

    // Exchange code for tokens with Microsoft
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    // For public clients (SPAs), do NOT include client_secret
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      // CRITICAL: The redirect URI must exactly match what was used during authorization
      // Since the client passes the exact URI used, we must use it as-is
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    // Check if we're using PKCE (public client) or confidential client flow
    // Azure AD app configured as SPA = public client, Web = confidential client
    // If codeVerifier is present, we're using PKCE flow (public client)
    // AADSTS700025 error means the app is configured as public/SPA
    // Since we're using PKCE with a SPA, NEVER include client_secret
    // if (clientSecret && !codeVerifier) {
    //   // Only add client_secret for confidential clients without PKCE
    //   tokenParams.append('client_secret', clientSecret);
    // }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Microsoft token exchange error:', tokenData);
      return NextResponse.json(
        { error: tokenData.error_description || 'Token exchange failed' },
        { status: 400 }
      );
    }

    // Get user info from Microsoft
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('Failed to get user info:', userData);
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 400 }
      );
    }

    // Store tokens securely in database
    const supabase = await createClient();
    
    // Get or create user
    const { data: authUser } = await supabase.auth.getUser();
    
    if (authUser?.user) {
      // Store OAuth tokens for the authenticated user
      const { error: tokenError } = await supabase
        .from('oauth_tokens')
        .upsert({
          user_id: authUser.user.id,
          provider: 'microsoft',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          id_token: tokenData.id_token,
          provider_user_id: userData.id,
          provider_email: userData.mail || userData.userPrincipalName,
          updated_at: new Date().toISOString(),
        });

      if (tokenError) {
        console.error('Error storing tokens:', tokenError);
        return NextResponse.json(
          { error: 'Failed to store authentication tokens' },
          { status: 500 }
        );
      }
    }

    // Return user data (but not the tokens for security)
    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
        givenName: userData.givenName,
        surname: userData.surname,
        jobTitle: userData.jobTitle,
        officeLocation: userData.officeLocation,
      },
      authenticated: true,
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/microsoft/token
 * Get stored tokens for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('provider_email, expires_at, scope')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'No Microsoft authentication found' },
        { status: 404 }
      );
    }

    // Check if token is expired
    const isExpired = new Date(tokenData.expires_at) < new Date();

    return NextResponse.json({
      authenticated: !isExpired,
      email: tokenData.provider_email,
      expiresAt: tokenData.expires_at,
      scope: tokenData.scope,
      needsRefresh: isExpired,
    });

  } catch (error) {
    console.error('Get token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}