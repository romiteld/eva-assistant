import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic';

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

/**
 * Get user's Zoom access token
 */
async function getZoomAccessToken(userId: string): Promise<string> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('oauth_credentials')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'zoom')
    .single();

  if (error || !data) {
    throw new Error('No Zoom authentication found. Please connect your Zoom account.');
  }

  // Check if token is expired
  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  
  if (expiresAt <= now) {
    throw new Error('Zoom token expired. Please reconnect your Zoom account.');
  }

  return data.access_token;
}

/**
 * Get meeting participants
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    // Authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { meetingId } = params;
    
    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const pageSize = parseInt(searchParams.get('page_size') || '30');
    const nextPageToken = searchParams.get('next_page_token');

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Build query parameters
    const params_url = new URLSearchParams({
      page_size: pageSize.toString(),
    });

    if (nextPageToken) {
      params_url.append('next_page_token', nextPageToken);
    }

    // Get participants from Zoom API
    const response = await fetch(
      `${ZOOM_API_BASE_URL}/meetings/${meetingId}/participants?${params_url}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to fetch meeting participants:', error);
      return NextResponse.json(
        { error: `Failed to fetch participants: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const participants = await response.json();

    return NextResponse.json(participants);
  } catch (error) {
    console.error('Error fetching meeting participants:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}