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
 * Get meeting recordings
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

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Get recordings from Zoom API
    const response = await fetch(
      `${ZOOM_API_BASE_URL}/meetings/${meetingId}/recordings`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to fetch meeting recordings:', error);
      return NextResponse.json(
        { error: `Failed to fetch recordings: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const recordings = await response.json();

    return NextResponse.json(recordings);
  } catch (error) {
    console.error('Error fetching meeting recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Delete meeting recordings
 */
export async function DELETE(
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
    const action = searchParams.get('action') || 'trash'; // 'trash' or 'delete'

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Delete recordings via Zoom API
    const response = await fetch(
      `${ZOOM_API_BASE_URL}/meetings/${meetingId}/recordings?action=${action}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to delete meeting recordings:', error);
      return NextResponse.json(
        { error: `Failed to delete recordings: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}