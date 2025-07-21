import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { getLinkedInProfile } from '@/lib/auth/linkedin-oauth';

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { code, state, redirectUri } = body;
    const userId = request.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get LinkedIn credentials from environment
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('LinkedIn credentials not configured. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in server environment variables.');
      return NextResponse.json({ error: 'LinkedIn integration not configured' }, { status: 500 });
    }

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LinkedIn token exchange failed:', errorData);
      return NextResponse.json({ error: 'Failed to exchange authorization code' }, { status: 400 });
    }

    const tokenData: LinkedInTokenResponse = await tokenResponse.json();

    // Get LinkedIn profile information
    const profile = await getLinkedInProfile(tokenData.access_token);

    // Store integration in database
    const supabase = createClient();
    
    // First, check if integration already exists
    const { data: existingIntegration } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .single();

    const integrationData = {
      user_id: userId,
      provider: 'linkedin',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null,
      scope: tokenData.scope,
      metadata: {
        profile,
        tokenType: tokenData.token_type,
        connectedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingIntegration) {
      // Update existing integration
      const { data, error } = await supabase
        .from('user_integrations')
        .update(integrationData)
        .eq('id', existingIntegration.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new integration
      const { data, error } = await supabase
        .from('user_integrations')
        .insert({
          ...integrationData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    // Log the successful integration
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action: 'linkedin_integration_connected',
        metadata: {
          profileId: profile.id,
          profileName: `${profile.firstName} ${profile.lastName}`,
          email: profile.email,
          timestamp: new Date().toISOString(),
        },
      });

    return NextResponse.json({
      success: true,
      integration: {
        id: result.id,
        provider: result.provider,
        connected_at: result.created_at,
        profile: {
          id: profile.id,
          name: `${profile.firstName} ${profile.lastName}`,
          email: profile.email,
          profileUrl: profile.profileUrl,
        },
      },
    });

  } catch (error: any) {
    console.error('LinkedIn token exchange error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect LinkedIn account' },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndRateLimit(handlePost, 'auth');