import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // Handle errors
  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${error}&error_description=${encodeURIComponent(errorDescription || '')}`, requestUrl.origin)
    );
  }

  if (code) {
    try {
      const supabase = createClient();
      
      // Exchange the code for a session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError);
        return NextResponse.redirect(
          new URL(`/login?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
        );
      }

      if (!data.session) {
        return NextResponse.redirect(
          new URL('/login?error=no_session', requestUrl.origin)
        );
      }

      // Get the response that will redirect to the dashboard
      const redirectUrl = new URL(next, requestUrl.origin);
      const response = NextResponse.redirect(redirectUrl);

      // Set auth cookies from the session
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      };

      // Set the access token cookie
      response.cookies.set('sb-access-token', data.session.access_token, cookieOptions);
      
      // Set the refresh token cookie
      response.cookies.set('sb-refresh-token', data.session.refresh_token, cookieOptions);

      return response;
    } catch (err) {
      console.error('Unexpected error in auth callback:', err);
      return NextResponse.redirect(
        new URL('/login?error=callback_error', requestUrl.origin)
      );
    }
  }

  // No code parameter, redirect to login
  return NextResponse.redirect(
    new URL('/login?error=no_code', requestUrl.origin)
  );
}