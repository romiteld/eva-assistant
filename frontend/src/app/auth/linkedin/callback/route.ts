import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTokenManager } from '@/lib/auth/token-manager';
import { handleLinkedInCallback, getLinkedInProfile } from '@/lib/auth/linkedin-oauth';

// Force dynamic rendering since this route uses searchParams
export const dynamic = 'force-dynamic';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('LinkedIn OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/auth/error?message=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/auth/error?message=Missing code or state', request.url)
      );
    }

    // Validate state and get redirect URL
    const { redirectTo, state: decodedState } = await handleLinkedInCallback(code, state);

    // Exchange code for tokens (server-side)
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/linkedin/callback`,
        client_id: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/auth/error?message=Token exchange failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in, refresh_token, refresh_token_expires_in } = tokenData;

    // Get LinkedIn profile to link with user
    const profile = await getLinkedInProfile(access_token);

    // Get or create user based on email
    let userId: string;
    
    // First, try to get the user by email
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(profile.email);
    
    if (existingUser?.user) {
      userId = existingUser.user.id;
    } else {
      // Create a new user if doesn't exist
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: profile.email,
        email_confirm: true,
        user_metadata: {
          full_name: `${profile.firstName} ${profile.lastName}`,
          avatar_url: profile.profilePicture,
          linkedin_id: profile.id,
          provider: 'linkedin'
        }
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return NextResponse.redirect(
          new URL('/auth/error?message=Failed to create user', request.url)
        );
      }

      userId = newUser.user.id;

      // Create profile record
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          full_name: `${profile.firstName} ${profile.lastName}`,
          avatar_url: profile.profilePicture,
          email: profile.email,
          metadata: {
            linkedin_id: profile.id,
            linkedin_url: profile.profileUrl
          }
        });
    }

    // Store OAuth tokens
    const tokenManager = getTokenManager(
      process.env.OAUTH_ENCRYPTION_KEY!,
      {
        linkedin: {
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
        },
        // Add other providers as needed
        microsoft: {
          tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
          tenantId: process.env.MICROSOFT_TENANT_ID || 'common'
        },
        google: {
          tokenUrl: 'https://oauth2.googleapis.com/token',
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
        },
        zoom: {
          tokenUrl: 'https://zoom.us/oauth/token',
          clientId: process.env.ZOOM_CLIENT_ID || '',
          clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
          accountId: process.env.ZOOM_ACCOUNT_ID || ''
        },
        salesforce: {
          tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
          clientId: process.env.SALESFORCE_CLIENT_ID || '',
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
        },
        zoho: {
          tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
          clientId: process.env.ZOHO_CLIENT_ID || '',
          clientSecret: process.env.ZOHO_CLIENT_SECRET || ''
        }
      }
    );

    await tokenManager.storeTokens(userId, 'linkedin', {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      scope: 'r_liteprofile r_emailaddress w_member_social'
    });

    // Create a session for the user
    const { data: session, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: {
        redirectTo: redirectTo
      }
    });

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      return NextResponse.redirect(
        new URL('/auth/error?message=Failed to create session', request.url)
      );
    }

    // Redirect to the magic link URL which will log the user in
    return NextResponse.redirect(session.properties.action_link);

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return NextResponse.redirect(
      new URL('/auth/error?message=Authentication failed', request.url)
    );
  }
}