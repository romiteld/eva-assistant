import { getTokenManager } from '@/lib/auth/token-manager';

export class AuthenticatedAPI {
  private tokenManager: ReturnType<typeof getTokenManager>;
  
  constructor(
    encryptionKey: string,
    refreshConfigs: any
  ) {
    this.tokenManager = getTokenManager(
      encryptionKey,
      refreshConfigs
    );
  }

  // Microsoft Graph API calls
  async microsoftGraphAPI(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.tokenManager.getValidToken(userId, 'microsoft');
    if (!token) {
      throw new Error('No valid Microsoft token available');
    }

    return fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // LinkedIn API calls
  async linkedInAPI(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.tokenManager.getValidToken(userId, 'linkedin');
    if (!token) {
      throw new Error('No valid LinkedIn token available');
    }

    return fetch(`https://api.linkedin.com/v2${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
  }

  // Zoom API calls
  async zoomAPI(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.tokenManager.getValidToken(userId, 'zoom');
    if (!token) {
      throw new Error('No valid Zoom token available');
    }

    return fetch(`https://api.zoom.us/v2${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Zoho CRM API calls
  async zohoCRMAPI(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.tokenManager.getValidToken(userId, 'zoho');
    if (!token) {
      throw new Error('No valid Zoho token available');
    }

    // Zoho uses different API domains based on the account
    const apiDomain = token.metadata?.api_domain || 'https://www.zohoapis.com';

    return fetch(`${apiDomain}/crm/v2${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Zoho-oauthtoken ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Generic authenticated request
  async authenticatedRequest(
    userId: string,
    provider: 'microsoft' | 'google' | 'linkedin' | 'zoom' | 'salesforce' | 'zoho',
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.tokenManager.getValidToken(userId, provider);
    if (!token) {
      throw new Error(`No valid ${provider} token available`);
    }

    const authHeader = provider === 'zoho' 
      ? `Zoho-oauthtoken ${token.accessToken}`
      : `Bearer ${token.accessToken}`;

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
  }

  // Helper methods for common operations

  // Get Microsoft user profile
  async getMicrosoftProfile(userId: string) {
    const response = await this.microsoftGraphAPI(userId, '/me');
    if (!response.ok) {
      throw new Error(`Failed to get Microsoft profile: ${response.statusText}`);
    }
    return response.json();
  }

  // Get Microsoft calendar events
  async getMicrosoftCalendarEvents(userId: string, startDate?: Date, endDate?: Date) {
    let endpoint = '/me/calendar/events';
    const params = new URLSearchParams();
    
    if (startDate && endDate) {
      params.append('$filter', 
        `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`
      );
    }
    
    params.append('$orderby', 'start/dateTime');
    params.append('$top', '50');
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await this.microsoftGraphAPI(userId, endpoint);
    if (!response.ok) {
      throw new Error(`Failed to get calendar events: ${response.statusText}`);
    }
    return response.json();
  }

  // Create Microsoft calendar event
  async createMicrosoftCalendarEvent(userId: string, event: any) {
    const response = await this.microsoftGraphAPI(userId, '/me/calendar/events', {
      method: 'POST',
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create calendar event: ${response.statusText}`);
    }
    return response.json();
  }

  // Get LinkedIn profile
  async getLinkedInProfile(userId: string) {
    const response = await this.linkedInAPI(userId, '/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))');
    if (!response.ok) {
      throw new Error(`Failed to get LinkedIn profile: ${response.statusText}`);
    }
    return response.json();
  }

  // Create Zoom meeting
  async createZoomMeeting(userId: string, meetingData: any) {
    const response = await this.zoomAPI(userId, '/users/me/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create Zoom meeting: ${response.statusText}`);
    }
    return response.json();
  }

  // Get Zoho CRM leads
  async getZohoLeads(userId: string, params?: any) {
    let endpoint = '/Leads';
    if (params) {
      const searchParams = new URLSearchParams(params);
      endpoint += `?${searchParams.toString()}`;
    }

    const response = await this.zohoCRMAPI(userId, endpoint);
    if (!response.ok) {
      throw new Error(`Failed to get Zoho leads: ${response.statusText}`);
    }
    return response.json();
  }

  // Create Zoho CRM lead
  async createZohoLead(userId: string, leadData: any) {
    const response = await this.zohoCRMAPI(userId, '/Leads', {
      method: 'POST',
      body: JSON.stringify({
        data: [leadData]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create Zoho lead: ${response.statusText}`);
    }
    return response.json();
  }

  // SharePoint file operations
  async uploadToSharePoint(userId: string, siteId: string, filePath: string, content: Blob) {
    const endpoint = `/sites/${siteId}/drive/root:/${filePath}:/content`;
    
    const response = await this.microsoftGraphAPI(userId, endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': content.type
      },
      body: content
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload to SharePoint: ${response.statusText}`);
    }
    return response.json();
  }

  // Send email via Microsoft Graph
  async sendMicrosoftEmail(userId: string, emailData: any) {
    const response = await this.microsoftGraphAPI(userId, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }
    return response.json();
  }
}

// Singleton instance
let apiInstance: AuthenticatedAPI | null = null;

export function getAuthenticatedAPI(
  encryptionKey: string,
  refreshConfigs: any
): AuthenticatedAPI {
  if (!apiInstance) {
    apiInstance = new AuthenticatedAPI(
      encryptionKey,
      refreshConfigs
    );
  }
  return apiInstance;
}