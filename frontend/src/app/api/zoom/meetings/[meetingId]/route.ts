import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateZoomApiKey } from '@/lib/middleware/zoom-auth';

// GET /api/zoom/meetings/[meetingId] - Get meeting details
export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const { data: interview, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('meeting_id', params.meetingId)
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

// PUT /api/zoom/meetings/[meetingId] - Update meeting
export async function PUT(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const supabase = createClient();
    
    // Update in database
    const { data: interview, error } = await supabase
      .from('interviews')
      .update({
        start_time: body.start_time,
        duration: body.duration,
        topic: body.topic,
        status: body.status,
        notes: body.notes,
      })
      .eq('meeting_id', params.meetingId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update meeting' },
        { status: 400 }
      );
    }

    // TODO: Also update in Zoom API if needed

    return NextResponse.json({
      success: true,
      meeting: interview,
      message: 'Meeting updated successfully',
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/zoom/meetings/[meetingId] - Cancel meeting
export async function DELETE(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    
    // Update status to cancelled
    const { error } = await supabase
      .from('interviews')
      .update({ status: 'cancelled' })
      .eq('meeting_id', params.meetingId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to cancel meeting' },
        { status: 400 }
      );
    }

    // TODO: Also cancel in Zoom API

    return NextResponse.json({
      success: true,
      message: 'Meeting cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}