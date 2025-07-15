import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateZoomApiKey } from '@/lib/middleware/zoom-auth';

// Alternative endpoint for Zoom that accepts meetingId as query param or body
export async function GET(request: NextRequest) {
  try {
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }

    // Get meetingId from query params
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data: interview, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (error || !interview) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      meeting: interview,
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for Zoom's interface quirks
export async function POST(request: NextRequest) {
  try {
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const meetingId = body.meetingId;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data: interview, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (error || !interview) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      meeting: interview,
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}