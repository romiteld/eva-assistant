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
 * Create a new meeting
 */
export async function POST(request: NextRequest) {
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

    // Get request body
    const meetingData = await request.json();
    
    // Validate required fields
    if (!meetingData.topic) {
      return NextResponse.json(
        { error: 'Meeting topic is required' },
        { status: 400 }
      );
    }

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Create meeting via Zoom API
    const response = await fetch(`${ZOOM_API_BASE_URL}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: meetingData.topic,
        type: meetingData.type || 2, // Default to scheduled meeting
        start_time: meetingData.start_time,
        duration: meetingData.duration || 30, // Default 30 minutes
        timezone: meetingData.timezone || 'UTC',
        password: meetingData.password,
        agenda: meetingData.agenda,
        settings: {
          host_video: meetingData.settings?.host_video ?? true,
          participant_video: meetingData.settings?.participant_video ?? true,
          join_before_host: meetingData.settings?.join_before_host ?? false,
          mute_upon_entry: meetingData.settings?.mute_upon_entry ?? true,
          watermark: meetingData.settings?.watermark ?? false,
          use_pmi: meetingData.settings?.use_pmi ?? false,
          approval_type: meetingData.settings?.approval_type ?? 0,
          auto_recording: meetingData.settings?.auto_recording ?? 'none',
          waiting_room: meetingData.settings?.waiting_room ?? true,
          meeting_authentication: meetingData.settings?.meeting_authentication ?? false,
          alternative_hosts: meetingData.settings?.alternative_hosts,
          ...meetingData.settings,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create Zoom meeting:', error);
      return NextResponse.json(
        { error: `Failed to create meeting: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const meeting = await response.json();

    // Store meeting in database for tracking
    const { error: dbError } = await supabase
      .from('zoom_meetings')
      .insert({
        user_id: user.id,
        meeting_id: meeting.id,
        uuid: meeting.uuid,
        host_id: meeting.host_id,
        topic: meeting.topic,
        type: meeting.type,
        status: meeting.status,
        start_time: meeting.start_time,
        duration: meeting.duration,
        timezone: meeting.timezone,
        agenda: meeting.agenda,
        start_url: meeting.start_url,
        join_url: meeting.join_url,
        password: meeting.password,
        settings: meeting.settings,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Failed to store meeting in database:', dbError);
      // Don't fail the request if database storage fails
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * List user's meetings
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'scheduled';
    const pageSize = parseInt(searchParams.get('page_size') || '30');
    const pageNumber = parseInt(searchParams.get('page_number') || '1');
    const nextPageToken = searchParams.get('next_page_token');

    // Get access token
    const accessToken = await getZoomAccessToken(user.id);

    // Build query parameters
    const params = new URLSearchParams({
      type,
      page_size: pageSize.toString(),
      page_number: pageNumber.toString(),
    });

    if (nextPageToken) {
      params.append('next_page_token', nextPageToken);
    }

    // Get meetings from Zoom API
    const response = await fetch(`${ZOOM_API_BASE_URL}/users/me/meetings?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to fetch Zoom meetings:', error);
      return NextResponse.json(
        { error: `Failed to fetch meetings: ${error.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const meetings = await response.json();

    return NextResponse.json(meetings);
  } catch (error) {
    console.error('Error fetching Zoom meetings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}