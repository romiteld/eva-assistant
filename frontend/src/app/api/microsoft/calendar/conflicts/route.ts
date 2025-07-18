import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Microsoft365Client } from '@/lib/integrations/microsoft365';
import { z } from 'zod';

const ConflictCheckSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { start, end } = ConflictCheckSchema.parse(body);

    // Get Microsoft access token
    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (!creds?.access_token) {
      return NextResponse.json({ 
        error: 'Microsoft integration not configured',
        events: []
      }, { status: 200 });
    }

    // Initialize Microsoft client
    const microsoft = new Microsoft365Client();
    await microsoft.initialize(creds.access_token, creds.refresh_token);

    // Get calendar events for the time period
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Expand search window to catch overlapping events
    const searchStart = new Date(startDate.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
    const searchEnd = new Date(endDate.getTime() + (2 * 60 * 60 * 1000)); // 2 hours after

    const events = await microsoft.calendar.getEvents({
      startDateTime: searchStart.toISOString(),
      endDateTime: searchEnd.toISOString(),
      top: 50,
      select: ['subject', 'start', 'end', 'showAs', 'isAllDay', 'organizer']
    });

    // Filter for actual conflicts (overlapping events)
    const conflicts = events.filter(event => {
      if (event.isAllDay) return false; // Skip all-day events
      if (event.showAs === 'free') return false; // Skip free time events
      
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      
      // Check for overlap
      return (
        (startDate < eventEnd && endDate > eventStart) || // Standard overlap check
        (eventStart < endDate && eventEnd > startDate)
      );
    });

    return NextResponse.json({
      events: conflicts.map(event => ({
        id: event.id,
        subject: event.subject,
        start: event.start,
        end: event.end,
        organizer: event.organizer?.emailAddress?.name || 'Unknown',
        showAs: event.showAs
      }))
    });

  } catch (error) {
    console.error('Calendar conflict check error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Failed to check calendar conflicts',
      events: []
    }, { status: 500 });
  }
}