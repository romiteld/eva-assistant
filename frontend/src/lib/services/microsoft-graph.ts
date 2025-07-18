'use client';

import { PublicClientApplication, InteractionRequiredAuthError, AccountInfo } from '@azure/msal-browser';
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';

export interface CalendarEvent {
  id?: string;
  subject: string;
  body: {
    content: string;
    contentType: 'text' | 'html';
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  isAllDay?: boolean;
  importance?: 'low' | 'normal' | 'high';
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
  categories?: string[];
}

export interface OutlookCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
}

class MSALAuthenticationProvider implements AuthenticationProvider {
  private msalInstance: PublicClientApplication;
  private account: AccountInfo | null = null;
  private scopes: string[] = [
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/User.Read'
  ];

  constructor(msalInstance: PublicClientApplication) {
    this.msalInstance = msalInstance;
  }

  async getAccessToken(): Promise<string> {
    try {
      // Try to get token silently first
      const silentRequest = {
        scopes: this.scopes,
        account: this.account!
      };

      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // If silent request fails, try interactive request
        const interactiveRequest = {
          scopes: this.scopes,
          account: this.account!
        };

        const response = await this.msalInstance.acquireTokenPopup(interactiveRequest);
        return response.accessToken;
      }
      throw error;
    }
  }

  setAccount(account: AccountInfo) {
    this.account = account;
  }
}

export class MicrosoftGraphService {
  private msalInstance: PublicClientApplication | null = null;
  private graphClient: Client | null = null;
  private authProvider: MSALAuthenticationProvider | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeMsal();
  }

  private async initializeMsal() {
    if (typeof window === 'undefined') return;

    const msalConfig = {
      auth: {
        clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
        authority: 'https://login.microsoftonline.com/29ee1479-b5f7-48c5-b665-7de9a8a9033e',
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    };

    try {
      this.msalInstance = new PublicClientApplication(msalConfig);
      await this.msalInstance.initialize();
      
      this.authProvider = new MSALAuthenticationProvider(this.msalInstance);
      this.graphClient = Client.initWithMiddleware({ authProvider: this.authProvider });
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MSAL:', error);
    }
  }

  async signIn(): Promise<AccountInfo | null> {
    if (!this.msalInstance || !this.authProvider) {
      throw new Error('MSAL not initialized');
    }

    try {
      const loginRequest = {
        scopes: [
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/User.Read'
        ],
        prompt: 'select_account'
      };

      const response = await this.msalInstance.loginPopup(loginRequest);
      this.authProvider.setAccount(response.account);
      
      return response.account;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    if (!this.msalInstance) return;

    try {
      const logoutRequest = {
        account: this.msalInstance.getActiveAccount()
      };

      await this.msalInstance.logoutPopup(logoutRequest);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  getCurrentAccount(): AccountInfo | null {
    if (!this.msalInstance) return null;
    return this.msalInstance.getActiveAccount();
  }

  async getCalendars(): Promise<OutlookCalendar[]> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const calendars = await this.graphClient
        .api('/me/calendars')
        .get();

      return calendars.value.map((calendar: any) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        isDefaultCalendar: calendar.isDefaultCalendar,
        canEdit: calendar.canEdit
      }));
    } catch (error) {
      console.error('Failed to get calendars:', error);
      throw error;
    }
  }

  async getCalendarEvents(
    calendarId: string = 'primary',
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      let apiCall = this.graphClient.api(`/me/calendars/${calendarId}/events`);

      if (startDate && endDate) {
        const start = startDate.toISOString();
        const end = endDate.toISOString();
        apiCall = apiCall.filter(`start/dateTime ge '${start}' and end/dateTime le '${end}'`);
      }

      const events = await apiCall
        .select('id,subject,body,start,end,location,attendees,isAllDay,importance,sensitivity,categories')
        .orderby('start/dateTime')
        .get();

      return events.value.map((event: any) => ({
        id: event.id,
        subject: event.subject,
        body: {
          content: event.body?.content || '',
          contentType: event.body?.contentType || 'text'
        },
        start: {
          dateTime: event.start.dateTime,
          timeZone: event.start.timeZone
        },
        end: {
          dateTime: event.end.dateTime,
          timeZone: event.end.timeZone
        },
        location: event.location ? {
          displayName: event.location.displayName
        } : undefined,
        attendees: event.attendees?.map((attendee: any) => ({
          emailAddress: {
            address: attendee.emailAddress.address,
            name: attendee.emailAddress.name
          }
        })),
        isAllDay: event.isAllDay,
        importance: event.importance,
        sensitivity: event.sensitivity,
        categories: event.categories
      }));
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      throw error;
    }
  }

  async createCalendarEvent(
    event: Omit<CalendarEvent, 'id'>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const newEvent = await this.graphClient
        .api(`/me/calendars/${calendarId}/events`)
        .post(event);

      return {
        id: newEvent.id,
        subject: newEvent.subject,
        body: {
          content: newEvent.body?.content || '',
          contentType: newEvent.body?.contentType || 'text'
        },
        start: {
          dateTime: newEvent.start.dateTime,
          timeZone: newEvent.start.timeZone
        },
        end: {
          dateTime: newEvent.end.dateTime,
          timeZone: newEvent.end.timeZone
        },
        location: newEvent.location ? {
          displayName: newEvent.location.displayName
        } : undefined,
        attendees: newEvent.attendees?.map((attendee: any) => ({
          emailAddress: {
            address: attendee.emailAddress.address,
            name: attendee.emailAddress.name
          }
        })),
        isAllDay: newEvent.isAllDay,
        importance: newEvent.importance,
        sensitivity: newEvent.sensitivity,
        categories: newEvent.categories
      };
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async updateCalendarEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const updatedEvent = await this.graphClient
        .api(`/me/calendars/${calendarId}/events/${eventId}`)
        .patch(event);

      return {
        id: updatedEvent.id,
        subject: updatedEvent.subject,
        body: {
          content: updatedEvent.body?.content || '',
          contentType: updatedEvent.body?.contentType || 'text'
        },
        start: {
          dateTime: updatedEvent.start.dateTime,
          timeZone: updatedEvent.start.timeZone
        },
        end: {
          dateTime: updatedEvent.end.dateTime,
          timeZone: updatedEvent.end.timeZone
        },
        location: updatedEvent.location ? {
          displayName: updatedEvent.location.displayName
        } : undefined,
        attendees: updatedEvent.attendees?.map((attendee: any) => ({
          emailAddress: {
            address: attendee.emailAddress.address,
            name: attendee.emailAddress.name
          }
        })),
        isAllDay: updatedEvent.isAllDay,
        importance: updatedEvent.importance,
        sensitivity: updatedEvent.sensitivity,
        categories: updatedEvent.categories
      };
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      throw error;
    }
  }

  async deleteCalendarEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      await this.graphClient
        .api(`/me/calendars/${calendarId}/events/${eventId}`)
        .delete();
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      throw error;
    }
  }

  async createTaskEvent(
    taskTitle: string,
    taskDescription: string,
    dueDate: Date,
    priority: 'low' | 'medium' | 'high' = 'normal'
  ): Promise<CalendarEvent> {
    const event: Omit<CalendarEvent, 'id'> = {
      subject: `Task: ${taskTitle}`,
      body: {
        content: taskDescription,
        contentType: 'text'
      },
      start: {
        dateTime: dueDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      importance: priority === 'high' ? 'high' : priority === 'medium' ? 'normal' : 'low',
      categories: ['Task', 'Work']
    };

    return this.createCalendarEvent(event);
  }

  isSignedIn(): boolean {
    if (!this.msalInstance) return false;
    return this.msalInstance.getActiveAccount() !== null;
  }

  isInitialized(): boolean {
    return this.isInitialized;
  }
}

export const microsoftGraphService = new MicrosoftGraphService();