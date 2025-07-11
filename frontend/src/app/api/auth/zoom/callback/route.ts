import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID!;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET!;
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI || 'http://localhost:3000/api/auth/zoom/callback';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('Zoom OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/dashboard/interview-center?error=${error}&description=${encodeURIComponent(errorDescription || '')}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/interview-center?error=invalid_request', request.url)
    );
  }

  try {
    // Validate state
    const storedState = request.cookies.get('zoom_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('State mismatch in Zoom OAuth callback');
      return NextResponse.redirect(
        new URL('/dashboard/interview-center?error=state_mismatch', request.url)
      );
    }

    // Parse state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    
    // Exchange code for tokens
    const tokenResponse = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ZOOM_REDIRECT_URI,
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Failed to exchange code for tokens:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard/interview-center?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info from Zoom
    const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userResponse.ok) {
      console.error('Failed to get Zoom user info');
      return NextResponse.redirect(
        new URL('/dashboard/interview-center?error=user_info_failed', request.url)
      );
    }

    const zoomUser = await userResponse.json();

    // Store credentials in Supabase
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== stateData.userId) {
      console.error('Authentication mismatch');
      return NextResponse.redirect(
        new URL('/dashboard/interview-center?error=auth_mismatch', request.url)
      );
    }

    // Upsert Zoom credentials
    const { error: dbError } = await supabase
      .from('zoom_credentials')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        scope: tokens.scope,
        zoom_user_id: zoomUser.id,
        zoom_email: zoomUser.email,
        zoom_account_id: zoomUser.account_id,
        is_active: true,
        last_refreshed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Failed to store Zoom credentials:', dbError);
      return NextResponse.redirect(
        new URL('/dashboard/interview-center?error=storage_failed', request.url)
      );
    }

    // Clear state cookie and redirect
    const response = NextResponse.redirect(
      new URL(`${stateData.redirectTo || '/dashboard/interview-center'}?zoom=connected`, request.url)
    );
    
    response.cookies.delete('zoom_oauth_state');
    
    return response;
  } catch (error) {
    console.error('Unexpected error in Zoom OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard/interview-center?error=unexpected_error', request.url)
    );
  }
}