import { zoomService } from '@/lib/services/zoom';
import { zoomServerToServerService } from '@/lib/services/zoom-server-to-server';

/**
 * Unified Zoom Service that automatically switches between OAuth and Server-to-Server modes
 * based on environment configuration
 */
export class ZoomUnifiedService {
  private static instance: ZoomUnifiedService;
  private useServerToServer: boolean;
  
  private constructor() {
    // Determine which mode to use based on environment variables
    const hasApiKey = !!process.env.ZOOM_API_KEY || !!process.env.NEXT_PUBLIC_ZOOM_API_KEY;
    const hasOAuthConfig = !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
    
    // Prefer Server-to-Server if API key is available
    this.useServerToServer = hasApiKey;
    
    console.log(`Zoom service mode: ${this.useServerToServer ? 'Server-to-Server OAuth' : 'User OAuth'}`);
    
    if (!hasApiKey && !hasOAuthConfig) {
      console.warn('No Zoom configuration found. Please set either ZOOM_API_KEY or ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET');
    }
  }
  
  static getInstance(): ZoomUnifiedService {
    if (!ZoomUnifiedService.instance) {
      ZoomUnifiedService.instance = new ZoomUnifiedService();
    }
    return ZoomUnifiedService.instance;
  }

  /**
   * Get the appropriate service instance
   */
  private getService() {
    return this.useServerToServer ? zoomServerToServerService : zoomService;
  }

  /**
   * Check if using Server-to-Server OAuth
   */
  isServerToServer(): boolean {
    return this.useServerToServer;
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(params: any, userId?: string): Promise<any> {
    if (this.useServerToServer && userId) {
      return zoomServerToServerService.createMeeting(userId, params);
    } else if (!this.useServerToServer) {
      return zoomService.createMeeting(params);
    } else {
      throw new Error('Server-to-Server OAuth requires a userId parameter');
    }
  }

  /**
   * Get a Zoom meeting by ID
   */
  async getMeeting(meetingId: string | number): Promise<any> {
    return this.getService().getMeeting(meetingId);
  }

  /**
   * Update a Zoom meeting
   */
  async updateMeeting(meetingId: string | number, params: any): Promise<void> {
    return this.getService().updateMeeting(meetingId, params);
  }

  /**
   * Delete a Zoom meeting
   */
  async deleteMeeting(meetingId: string | number): Promise<void> {
    return this.getService().deleteMeeting(meetingId);
  }

  /**
   * List meetings
   */
  async listMeetings(params?: any, userId?: string): Promise<any> {
    if (this.useServerToServer && userId) {
      return zoomServerToServerService.listMeetings(userId, params);
    } else if (!this.useServerToServer) {
      return zoomService.listMeetings(params);
    } else {
      throw new Error('Server-to-Server OAuth requires a userId parameter');
    }
  }

  /**
   * Get user information
   */
  async getUser(userId?: string): Promise<any> {
    if (this.useServerToServer && userId) {
      return zoomServerToServerService.getUser(userId);
    } else {
      throw new Error('User information retrieval requires userId for Server-to-Server OAuth or user authentication for OAuth');
    }
  }

  /**
   * Get meeting participants
   */
  async getMeetingParticipants(meetingId: string | number): Promise<any> {
    return this.getService().getMeetingParticipants(meetingId);
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(meetingId: string | number): Promise<any> {
    return this.getService().getMeetingRecordings(meetingId);
  }

  /**
   * Create interview meeting with appropriate service
   */
  async createInterviewMeeting(
    interviewScheduleId: string, 
    details: any, 
    hostUserId?: string
  ): Promise<any> {
    if (this.useServerToServer && hostUserId) {
      return zoomServerToServerService.createInterviewMeeting(hostUserId, interviewScheduleId, details);
    } else if (!this.useServerToServer) {
      return zoomService.createInterviewMeeting(interviewScheduleId, details);
    } else {
      throw new Error('Server-to-Server OAuth requires a hostUserId parameter');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: any): Promise<void> {
    return this.getService().handleWebhook(event);
  }

  /**
   * Check authentication status
   */
  async isAuthenticated(): Promise<boolean> {
    if (this.useServerToServer) {
      // For Server-to-Server, check if we can get a token
      try {
        await zoomServerToServerService.getAccessToken();
        return true;
      } catch {
        return false;
      }
    } else {
      return zoomService.isAuthenticated();
    }
  }

  /**
   * Get authentication status and configuration info
   */
  async getAuthInfo(): Promise<{
    isAuthenticated: boolean;
    mode: 'oauth' | 'server_to_server';
    requiresUserAuth: boolean;
    configurationStatus: {
      hasApiKey: boolean;
      hasOAuthConfig: boolean;
      hasWebhookSecret: boolean;
    };
  }> {
    const hasApiKey = !!process.env.ZOOM_API_KEY || !!process.env.NEXT_PUBLIC_ZOOM_API_KEY;
    const hasOAuthConfig = !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
    const hasWebhookSecret = !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

    return {
      isAuthenticated: await this.isAuthenticated(),
      mode: this.useServerToServer ? 'server_to_server' : 'oauth',
      requiresUserAuth: !this.useServerToServer,
      configurationStatus: {
        hasApiKey,
        hasOAuthConfig,
        hasWebhookSecret,
      },
    };
  }
}

// Export singleton instance
export const zoomUnified = ZoomUnifiedService.getInstance();