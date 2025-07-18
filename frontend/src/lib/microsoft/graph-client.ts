import { Client } from '@microsoft/microsoft-graph-client';
import { createClient } from '@/lib/supabase/browser';

interface TokenCredential {
  getToken: () => Promise<string>;
}

// Custom authentication provider for Microsoft Graph
class SupabaseTokenProvider implements TokenCredential {
  private userId: string;
  private supabase: ReturnType<typeof createClient>;

  constructor(userId: string) {
    this.userId = userId;
    this.supabase = createClient();
  }

  async getToken(): Promise<string> {
    const { data, error } = await this.supabase
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', this.userId)
      .eq('provider', 'microsoft')
      .single();

    if (error || !data) {
      throw new Error('No Microsoft integration found');
    }

    // Check if token is expired
    const expiresAt = new Date(data.expires_at * 1000);
    if (expiresAt < new Date()) {
      // Token is expired, refresh it
      return await this.refreshToken(data.refresh_token);
    }

    return data.access_token;
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    // Use secure server-side refresh endpoint
    const response = await fetch('/api/oauth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseAccessToken}`,
      },
      body: JSON.stringify({
        provider: 'microsoft',
        refreshToken: refreshToken
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokens = await response.json();

    // Update stored tokens
    await this.supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', this.userId)
      .eq('provider', 'microsoft');

    return tokens.access_token;
  }
}

// Create Microsoft Graph client
export function createGraphClient(userId: string): Client {
  const authProvider = {
    getAccessToken: async () => {
      const tokenProvider = new SupabaseTokenProvider(userId);
      return await tokenProvider.getToken();
    }
  };

  return Client.initWithMiddleware({
    authProvider,
    defaultVersion: 'v1.0',
  });
}

// Graph API helper functions
export const graphHelpers = {
  // Get user profile
  async getProfile(userId: string) {
    const client = createGraphClient(userId);
    return await client.api('/me').get();
  },

  // Get emails
  async getEmails(userId: string, options?: { top?: number; filter?: string }) {
    const client = createGraphClient(userId);
    let request = client.api('/me/messages');
    
    if (options?.top) request = request.top(options.top);
    if (options?.filter) request = request.filter(options.filter);
    
    return await request.get();
  },

  // Send email
  async sendEmail(userId: string, message: any) {
    const client = createGraphClient(userId);
    return await client.api('/me/sendMail').post({ message });
  },

  // Get calendar events
  async getCalendarEvents(userId: string, options?: { startDateTime?: string; endDateTime?: string }) {
    const client = createGraphClient(userId);
    let request = client.api('/me/events');
    
    if (options?.startDateTime && options?.endDateTime) {
      request = request.filter(
        `start/dateTime ge '${options.startDateTime}' and end/dateTime le '${options.endDateTime}'`
      );
    }
    
    return await request.get();
  },

  // Create calendar event
  async createCalendarEvent(userId: string, event: any) {
    const client = createGraphClient(userId);
    return await client.api('/me/events').post(event);
  },

  // Create online meeting
  async createOnlineMeeting(userId: string, meeting: any) {
    const client = createGraphClient(userId);
    return await client.api('/me/onlineMeetings').post(meeting);
  },

  // Get contacts
  async getContacts(userId: string, options?: { top?: number; filter?: string }) {
    const client = createGraphClient(userId);
    let request = client.api('/me/contacts');
    
    if (options?.top) request = request.top(options.top);
    if (options?.filter) request = request.filter(options.filter);
    
    return await request.get();
  },

  // Create contact
  async createContact(userId: string, contact: any) {
    const client = createGraphClient(userId);
    return await client.api('/me/contacts').post(contact);
  },

  // Search SharePoint/OneDrive files
  async searchFiles(userId: string, query: string) {
    const client = createGraphClient(userId);
    return await client.api('/me/drive/root/search(q=\'' + query + '\')').get();
  },
};
