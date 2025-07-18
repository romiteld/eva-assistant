import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/microsoft/store-tokens
 * Store OAuth tokens after client-side exchange
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, refresh_token, expires_in, token_type, scope, id_token, user } = body;

    if (!access_token || !user) {
      return NextResponse.json(
        { error: 'Missing required data' },
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
          access_token: access_token,
          refresh_token: refresh_token,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          token_type: token_type,
          scope: scope,
          id_token: id_token,
          provider_user_id: user.id,
          provider_email: user.mail || user.userPrincipalName,
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

    // Return success (but not the tokens for security)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.mail || user.userPrincipalName,
        name: user.displayName,
        givenName: user.givenName,
        surname: user.surname,
        jobTitle: user.jobTitle,
        officeLocation: user.officeLocation,
      },
    });

  } catch (error) {
    console.error('Store tokens error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}