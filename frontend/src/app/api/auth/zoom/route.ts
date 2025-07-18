import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize';
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID!;
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI || 'http://localhost:3000/api/auth/zoom/callback';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.redirect(new URL('/login?error=unauthenticated', request.url));
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      redirectTo: request.nextUrl.searchParams.get('redirectTo') || '/dashboard/interview-center'
    })).toString('base64');

    // Store state in cookie for validation
    const response = NextResponse.redirect(
      `${ZOOM_AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: ZOOM_CLIENT_ID,
        redirect_uri: ZOOM_REDIRECT_URI,
        state: state,
      }).toString()
    );

    response.cookies.set('zoom_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Error initiating Zoom OAuth:', error);
    return NextResponse.redirect(
      new URL('/dashboard/interview-center?error=oauth_init_failed', request.url)
    );
  }
}