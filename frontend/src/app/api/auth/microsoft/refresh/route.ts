import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refreshMicrosoftToken } from '@/lib/auth/microsoft-token-refresh';

/**
 * POST /api/auth/microsoft/refresh
 * Refreshes Microsoft OAuth tokens
 * Handles 24-hour refresh token expiration per 2025 requirements
 */
export async function POST(request: NextRequest) {
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
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'No Microsoft authentication found', requiresReauth: true },
        { status: 404 }
      );
    }

    // Check if we're approaching the 24-hour limit
    const createdAt = new Date(tokenData.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation >= 23.5) { // 30 minutes before 24-hour limit
      return NextResponse.json(
        { 
          error: 'Refresh token approaching 24-hour limit. Please re-authenticate.',
          requiresReauth: true,
          hoursRemaining: 24 - hoursSinceCreation
        },
        { status: 401 }
      );
    }

    // Attempt to refresh the token
    const result = await refreshMicrosoftToken(tokenData.refresh_token);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          requiresReauth: result.requiresReauth
        },
        { status: result.requiresReauth ? 401 : 500 }
      );
    }

    // Update stored tokens
    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update({
        access_token: result.tokenData!.access_token,
        refresh_token: result.tokenData!.refresh_token || tokenData.refresh_token,
        expires_at: new Date(Date.now() + result.tokenData!.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', 'microsoft');

    if (updateError) {
      console.error('Error updating tokens:', updateError);
      return NextResponse.json(
        { error: 'Failed to update tokens' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expiresAt: new Date(Date.now() + result.tokenData!.expires_in * 1000).toISOString(),
      hoursUntil24HourLimit: 24 - hoursSinceCreation
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}