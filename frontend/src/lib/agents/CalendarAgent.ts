import { z } from 'zod';
import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage } from './base/types';
import { Client } from '@microsoft/microsoft-graph-client';

// Types
interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

// Input/Output schemas
const CreateEventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  isOnline: z.boolean().optional(),
  reminder: z.number().optional(), // minutes before event
  recurrence: z.object({
    pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number(),
    endDate: z.string().datetime().optional(),
  }).optional(),
});

const UpdateEventSchema = z.object({
  eventId: z.string(),
  updates: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
  }),
});

const DeleteEventSchema = z.object({
  eventId: z.string(),
  notifyAttendees: z.boolean().optional(),
});

const GetEventsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  calendarId: z.string().optional(),
  includeRecurring: z.boolean().optional(),
});

const FindFreeSlotsSchema = z.object({
  participants: z.array(z.string().email()),
  duration: z.number(), // minutes
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  workingHours: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

const ScheduleMeetingSchema = z.object({
  title: z.string(),
  participants: z.array(z.string().email()),
  duration: z.number(), // minutes

  preferredTimes: z.array(z.string().datetime()).optional(),
  isOnline: z.boolean().optional(),
  agenda: z.string().optional(),
});

export class CalendarAgent extends Agent {
  private graphClient?: Client;

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'Calendar Agent',
      type: AgentType.CALENDAR,
      description: 'Manages calendar events, meetings, and scheduling',
      ...config,
    });

    this.registerActions();
  }

  protected async onInitialize(): Promise<void> {
    // Initialize Microsoft Graph client
    // This would typically use the user's access token from authentication
    // For now, we'll set up the structure
    const accessToken = process.env.GRAPH_ACCESS_TOKEN;
    
    if (accessToken) {
      this.graphClient = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
    } else {
      console.warn('Microsoft Graph access token not found. Calendar functionality will be limited.');
    }
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any resources
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
      case 'create_event':
        return this.createEvent(payload);
      case 'update_event':
        return this.updateEvent(payload);
      case 'delete_event':
        return this.deleteEvent(payload);
      case 'get_events':
        return this.getEvents(payload);
      case 'find_free_slots':
        return this.findFreeSlots(payload);
      case 'schedule_meeting':
        return this.scheduleMeeting(payload);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private registerActions(): void {
    this.registerAction('create_event', {
      name: 'create_event',
      description: 'Create a calendar event',
      inputSchema: CreateEventSchema,
      outputSchema: z.object({
        id: z.string(),
        title: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        webLink: z.string().optional(),
        onlineMeetingUrl: z.string().optional(),
      }),
    });

    this.registerAction('update_event', {
      name: 'update_event',
      description: 'Update an existing event',
      inputSchema: UpdateEventSchema,
      outputSchema: z.object({
        id: z.string(),
        updated: z.boolean(),
        changes: z.array(z.string()),
      }),
    });

    this.registerAction('delete_event', {
      name: 'delete_event',
      description: 'Delete a calendar event',
      inputSchema: DeleteEventSchema,
      outputSchema: z.object({
        deleted: z.boolean(),
        notifiedAttendees: z.boolean(),
      }),
    });

    this.registerAction('get_events', {
      name: 'get_events',
      description: 'Get calendar events',
      inputSchema: GetEventsSchema,
      outputSchema: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        startTime: z.string(),
        endTime: z.string(),
        location: z.string().optional(),
        attendees: z.array(z.string()),
        isOnline: z.boolean(),
        onlineMeetingUrl: z.string().optional(),
      })),
    });

    this.registerAction('find_free_slots', {
      name: 'find_free_slots',
      description: 'Find available time slots',
      inputSchema: FindFreeSlotsSchema,
      outputSchema: z.array(z.object({
        start: z.string(),
        end: z.string(),
        participants: z.array(z.string()),
      })),
    });

    this.registerAction('schedule_meeting', {
      name: 'schedule_meeting',
      description: 'Schedule a meeting with participants',
      inputSchema: ScheduleMeetingSchema,
      outputSchema: z.object({
        eventId: z.string(),
        scheduledTime: z.string(),
        participants: z.array(z.object({
          email: z.string(),
          status: z.string(),
        })),
        meetingLink: z.string().optional(),
      }),
    });
  }

  private async createEvent(input: z.infer<typeof CreateEventSchema>) {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const event = {
        subject: input.title,
        body: {
          contentType: 'HTML',
          content: input.description || '',
        },
        start: {
          dateTime: input.startTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: input.endTime,
          timeZone: 'UTC',
        },
        location: input.location ? { displayName: input.location } : undefined,
        attendees: input.attendees?.map(email => ({
          emailAddress: { address: email },
          type: 'required',
        })),
        isOnlineMeeting: input.isOnline,
        reminderMinutesBeforeStart: input.reminder,
      };

      const result = await this.graphClient
        .api('/me/calendar/events')
        .post(event);

      this.broadcast('event_created', {
        eventId: result.id,
        title: input.title,
        startTime: input.startTime,
      });

      return {
        id: result.id,
        title: result.subject,
        startTime: result.start.dateTime,
        endTime: result.end.dateTime,
        webLink: result.webLink,
        onlineMeetingUrl: result.onlineMeeting?.joinUrl,
      };
    } catch (error) {
      this.broadcast('event_creation_failed', {
        title: input.title,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async updateEvent(input: z.infer<typeof UpdateEventSchema>) {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const updates: any = {};
      const changes: string[] = [];

      if (input.updates.title) {
        updates.subject = input.updates.title;
        changes.push('title');
      }
      if (input.updates.description) {
        updates.body = {
          contentType: 'HTML',
          content: input.updates.description,
        };
        changes.push('description');
      }
      if (input.updates.startTime) {
        updates.start = {
          dateTime: input.updates.startTime,
          timeZone: 'UTC',
        };
        changes.push('start time');
      }
      if (input.updates.endTime) {
        updates.end = {
          dateTime: input.updates.endTime,
          timeZone: 'UTC',
        };
        changes.push('end time');
      }
      if (input.updates.location) {
        updates.location = { displayName: input.updates.location };
        changes.push('location');
      }
      if (input.updates.attendees) {
        updates.attendees = input.updates.attendees.map(email => ({
          emailAddress: { address: email },
          type: 'required',
        }));
        changes.push('attendees');
      }

      await this.graphClient
        .api(`/me/calendar/events/${input.eventId}`)
        .patch(updates);

      this.broadcast('event_updated', {
        eventId: input.eventId,
        changes,
      });

      return {
        id: input.eventId,
        updated: true,
        changes,
      };
    } catch (error) {
      this.broadcast('event_update_failed', {
        eventId: input.eventId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async deleteEvent(input: z.infer<typeof DeleteEventSchema>) {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      await this.graphClient
        .api(`/me/calendar/events/${input.eventId}`)
        .delete();

      this.broadcast('event_deleted', {
        eventId: input.eventId,
        notifiedAttendees: input.notifyAttendees || false,
      });

      return {
        deleted: true,
        notifiedAttendees: input.notifyAttendees || false,
      };
    } catch (error) {
      this.broadcast('event_deletion_failed', {
        eventId: input.eventId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async getEvents(input: z.infer<typeof GetEventsSchema>) {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const filter = `start/dateTime ge '${input.startDate}' and end/dateTime le '${input.endDate}'`;
      
      const result = await this.graphClient
        .api('/me/calendar/events')
        .filter(filter)
        .select('id,subject,body,start,end,location,attendees,isOnlineMeeting,onlineMeeting')
        .get();

      const events = result.value.map((event: any) => ({
        id: event.id,
        title: event.subject,
        description: event.body?.content,
        startTime: event.start.dateTime,
        endTime: event.end.dateTime,
        location: event.location?.displayName,
        attendees: event.attendees?.map((a: any) => a.emailAddress.address) || [],
        isOnline: event.isOnlineMeeting || false,
        onlineMeetingUrl: event.onlineMeeting?.joinUrl,
      }));

      this.broadcast('events_retrieved', {
        count: events.length,
        startDate: input.startDate,
        endDate: input.endDate,
      });

      return events;
    } catch (error) {
      throw new Error(`Failed to get events: ${(error as Error).message}`);
    }
  }

  private async findFreeSlots(input: z.infer<typeof FindFreeSlotsSchema>) {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      // Use Microsoft Graph findMeetingTimes API
      const request = {
        attendees: input.participants.map(email => ({
          emailAddress: { address: email },
          type: 'required',
        })),
        timeConstraint: {
          activityDomain: 'work',
          timeSlots: [{
            start: {
              dateTime: input.startDate,
              timeZone: 'UTC',
            },
            end: {
              dateTime: input.endDate,
              timeZone: 'UTC',
            },
          }],
        },
        meetingDuration: `PT${input.duration}M`,
        isOrganizerOptional: false,
      };

      const result = await this.graphClient
        .api('/me/findMeetingTimes')
        .post(request);

      const freeSlots = result.meetingTimeSuggestions.map((suggestion: any) => ({
        start: suggestion.meetingTimeSlot.start.dateTime,
        end: suggestion.meetingTimeSlot.end.dateTime,
        participants: input.participants,
      }));

      this.broadcast('free_slots_found', {
        count: freeSlots.length,
        duration: input.duration,
      });

      return freeSlots;
    } catch (error) {
      throw new Error(`Failed to find free slots: ${(error as Error).message}`);
    }
  }

  private async scheduleMeeting(input: z.infer<typeof ScheduleMeetingSchema>) {
    try {
      // First, find available slots
      const slots = await this.findFreeSlots({
        participants: input.participants,
        duration: input.duration,
        startDate: input.preferredTimes?.[0] || new Date().toISOString(),
        endDate: input.preferredTimes?.[input.preferredTimes.length - 1] || 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      });

      if (slots.length === 0) {
        throw new Error('No available time slots found');
      }

      // Use the first available slot or match with preferred times
      let selectedSlot = slots[0];
      if (input.preferredTimes) {
        // Find the best matching slot
        for (const preferred of input.preferredTimes) {
          const match = slots.find((slot: TimeSlot) => 
            new Date(slot.start).getTime() <= new Date(preferred).getTime() &&
            new Date(slot.end).getTime() >= new Date(preferred).getTime()
          );
          if (match) {
            selectedSlot = match;
            break;
          }
        }
      }

      // Create the event
      const event = await this.createEvent({
        title: input.title,
        description: input.agenda,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        attendees: input.participants,
        isOnline: input.isOnline,
      });

      this.broadcast('meeting_scheduled', {
        eventId: event.id,
        title: input.title,
        scheduledTime: selectedSlot.start,
      });

      return {
        eventId: event.id,
        scheduledTime: selectedSlot.start,
        participants: input.participants.map(email => ({
          email,
          status: 'invited',
        })),
        meetingLink: event.onlineMeetingUrl,
      };
    } catch (error) {
      this.broadcast('meeting_scheduling_failed', {
        title: input.title,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}