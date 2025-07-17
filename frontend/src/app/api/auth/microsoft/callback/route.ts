import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/middleware/rate-limit';

// Microsoft OAuth configuration
const MICROSOFT_TENANT_ID = '29ee1479-b5f7-48c5-b665-7de9a8a9033e';
const MICROSOFT_CLIENT_ID = 'bfa77df6-6952-4d0f-9816-003b3101b9da';
// Note: This is a public client app, no client secret needed for PKCE flow

export const GET = withRateLimit(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${request.nextUrl.origin}/login?error=${error}&error_description=${encodeURIComponent(errorDescription || '')}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${request.nextUrl.origin}/login?error=no_code`);
  }

  try {
    // Parse state to get the code verifier
    const stateData = state ? JSON.parse(atob(state)) : {};
    const codeVerifier = stateData.codeVerifier;
    
    if (!codeVerifier) {
      // Try to get from cookie as backup
      const cookies = request.cookies;
      const cookieVerifier = cookies.get('pkce_verifier')?.value;
      if (!cookieVerifier) {
        console.error('PKCE code verifier not found in state or cookie');
        return NextResponse.redirect(`${request.nextUrl.origin}/login?error=pkce_missing`);
      }
      stateData.codeVerifier = cookieVerifier;
    }
    
    // Exchange code for tokens with Microsoft
    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
    
    // For public clients (SPAs), don't include client_secret
    const tokenParams = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${request.nextUrl.origin}/api/auth/microsoft/callback`,
      code_verifier: stateData.codeVerifier || codeVerifier,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return NextResponse.redirect(
        `${request.nextUrl.origin}/login?error=token_exchange_failed&message=${encodeURIComponent(tokenData.error_description || '')}`
      );
    }

    // Get user info from Microsoft
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // For now, we'll store the Microsoft user data in session storage and redirect to a page
    // that will handle the Supabase authentication
    const userEmail = userData.mail || userData.userPrincipalName;
    const userName = userData.displayName || userData.givenName || 'User';
    
    // Create a temporary token to pass user data securely
    const tempToken = btoa(JSON.stringify({
      email: userEmail,
      name: userName,
      microsoftId: userData.id,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    }));
    
    // Redirect to a page that will handle the Supabase sign-in
    const redirectUrl = new URL('/auth/microsoft/complete', request.nextUrl.origin);
    redirectUrl.searchParams.set('token', tempToken);
    redirectUrl.searchParams.set('redirect', stateData.redirectTo || '/dashboard');
    
    const response = NextResponse.redirect(redirectUrl);
    
    // Clear the PKCE cookie
    response.cookies.set('pkce_verifier', '', {
      maxAge: 0,
      path: '/',
    });
    
    return response;
    
  } catch (error) {
    console.error('Unexpected error in Microsoft OAuth callback:', error);
    return NextResponse.redirect(`${request.nextUrl.origin}/login?error=unexpected_error`);
  }
}, 'auth');