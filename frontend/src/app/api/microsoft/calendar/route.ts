import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { graphHelpers } from '@/lib/microsoft/graph-client';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

async function handleGet(request: AuthenticatedRequest) {
  try {

    // Get current date range (this week)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    endDate.setHours(23, 59, 59, 999);

    const events = await graphHelpers.getCalendarEvents(request.user?.id || '', {
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication and API rate limiting
export const GET = withAuthAndRateLimit(handleGet, 'api');

async function handlePost(request: AuthenticatedRequest) {
  try {

    const body = await request.json();
    const { subject, start, end, attendees, isOnline } = body;

    const event: any = {
      subject,
      start: {
        dateTime: start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: end,
        timeZone: 'UTC',
      },
    };

    if (attendees && attendees.length > 0) {
      event.attendees = attendees.map((email: string) => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    if (isOnline) {
      event.isOnlineMeeting = true;
      event.onlineMeetingProvider = 'teamsForBusiness';
    }

    const result = await graphHelpers.createCalendarEvent(request.user?.id || '', event);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and API rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'api');
