import { NextRequest, NextResponse } from 'next/server';
import { graphHelpers } from '@/lib/microsoft/graph-client';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

async function handleGet(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    if (teamId) {
      // Get channels for specific team
      const channels = await graphHelpers.getTeamChannels(request.user?.id || '', teamId);
      return NextResponse.json(channels);
    } else {
      // Get all teams
      const teams = await graphHelpers.getTeams(request.user?.id || '');
      return NextResponse.json(teams);
    }
  } catch (error: any) {
    console.error('Failed to fetch teams:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { teamId, channelId, action, data } = body;

    if (action === 'send_message') {
      // Send message to channel
      const result = await graphHelpers.sendTeamsMessage(
        request.user?.id || '',
        teamId,
        channelId,
        data.message
      );
      return NextResponse.json({ success: true, result });
    } else if (action === 'create_channel') {
      // Create new channel
      const result = await graphHelpers.createTeamsChannel(
        request.user?.id || '',
        teamId,
        data
      );
      return NextResponse.json({ success: true, result });
    } else if (action === 'create_meeting') {
      // Create Teams meeting
      const result = await graphHelpers.createTeamsMeeting(
        request.user?.id || '',
        data
      );
      return NextResponse.json({ success: true, result });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Failed to perform Teams action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform Teams action' },
      { status: 500 }
    );
  }
}

// Export the handlers with authentication and rate limiting
export const GET = withAuthAndRateLimit(handleGet, 'api');
export const POST = withAuthAndRateLimit(handlePost, 'api');