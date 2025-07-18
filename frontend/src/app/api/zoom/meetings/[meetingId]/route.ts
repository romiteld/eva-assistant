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
 * Get meeting details
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

    // Get meeting from Zoom API
    const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to fetch Zoom meeting:', error);
      return NextResponse.json(
        { error: `Failed to fetch meeting: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const meeting = await response.json();

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Error fetching Zoom meeting:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update meeting
 */
export async function PATCH(
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

    // Get request body
    const updateData = await request.json();

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Update meeting via Zoom API
    const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to update Zoom meeting:', error);
      return NextResponse.json(
        { error: `Failed to update meeting: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    // Update meeting in database
    const { error: dbError } = await supabase
      .from('zoom_meetings')
      .update({
        topic: updateData.topic,
        type: updateData.type,
        start_time: updateData.start_time,
        duration: updateData.duration,
        timezone: updateData.timezone,
        agenda: updateData.agenda,
        settings: updateData.settings,
        updated_at: new Date().toISOString(),
      })
      .eq('meeting_id', meetingId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Failed to update meeting in database:', dbError);
      // Don't fail the request if database update fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating Zoom meeting:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Delete meeting
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

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Delete meeting via Zoom API
    const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to delete Zoom meeting:', error);
      return NextResponse.json(
        { error: `Failed to delete meeting: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    // Delete meeting from database
    const { error: dbError } = await supabase
      .from('zoom_meetings')
      .delete()
      .eq('meeting_id', meetingId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Failed to delete meeting from database:', dbError);
      // Don't fail the request if database deletion fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Zoom meeting:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}