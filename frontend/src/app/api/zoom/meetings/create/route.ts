import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateZoomApiKey } from '@/lib/middleware/zoom-auth';

interface CreateMeetingRequest {
  topic: string;
  start_time: string;
  duration?: number;
  candidate_email: string;
  interviewer_email?: string;
  meeting_password?: string;
  send_reminder?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Validate Zoom API key
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateMeetingRequest = await request.json();
    
    // Validate required fields
    if (!body.topic || !body.start_time || !body.candidate_email) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, start_time, candidate_email' },
        { status: 400 }
      );
    }

    // Get authenticated user's Zoom credentials from Supabase
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's Zoom OAuth tokens
    const { data: oauthData, error: oauthError } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'zoom')
      .single();

    if (oauthError || !oauthData) {
      return NextResponse.json(
        { error: 'Zoom account not connected. Please connect your Zoom account first.' },
        { status: 400 }
      );
    }

    // Create Zoom meeting using Zoom API
    const zoomResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: body.topic,
        type: 2, // Scheduled meeting
        start_time: body.start_time,
        duration: body.duration || 60,
        timezone: 'UTC',
        password: body.meeting_password,
        agenda: `Interview with ${body.candidate_email}`,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: false,
          watermark: false,
          audio: 'both',
          auto_recording: 'cloud',
          waiting_room: true,
        },
      }),
    });

    if (!zoomResponse.ok) {
      const error = await zoomResponse.json();
      console.error('Zoom API error:', error);
      return NextResponse.json(
        { error: 'Failed to create Zoom meeting', details: error },
        { status: zoomResponse.status }
      );
    }

    const meeting = await zoomResponse.json();

    // Store meeting details in database
    const { error: dbError } = await supabase
      .from('interviews')
      .insert({
        user_id: user.id,
        candidate_email: body.candidate_email,
        interviewer_email: body.interviewer_email || user.email,
        meeting_id: meeting.id,
        meeting_url: meeting.join_url,
        start_time: body.start_time,
        duration: body.duration || 60,
        topic: body.topic,
        status: 'scheduled',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Meeting was created but couldn't save to DB
    }

    // Send email invitations if requested
    if (body.send_reminder !== false) {
      // TODO: Implement email sending
      console.log('Email reminders will be sent');
    }

    // Return meeting details
    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        topic: meeting.topic,
        start_time: meeting.start_time,
        duration: meeting.duration,
        join_url: meeting.join_url,
        password: meeting.password,
      },
      message: 'Interview meeting created successfully',
    });

  } catch (error) {
    console.error('Create meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support GET for endpoint testing
export async function GET(request: NextRequest) {
  if (!validateZoomApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid API Key' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    endpoint: 'Create Interview Meeting',
    method: 'POST',
    description: 'Creates a new Zoom meeting for candidate interviews',
    required_fields: ['topic', 'start_time', 'candidate_email'],
    optional_fields: ['duration', 'interviewer_email', 'meeting_password', 'send_reminder'],
  });
}