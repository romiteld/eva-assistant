/**
 * Client-side Zoho OAuth utilities
 * Handles OAuth flow initialization and status checking without exposing secrets
 */

export interface ZohoConnectionStatus {
  connected: boolean;
  status: 'connected' | 'expired' | 'invalid' | 'not_connected';
  expires_at?: string;
  expires_in_minutes?: number;
  api_domain?: string;
  scope?: string;
  connected_at?: string;
  last_refreshed?: string;
  user_info?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    org: string;
  };
  rate_limit?: {
    limit: string | null;
    remaining: string | null;
    reset: string | null;
  };
}

export class ZohoOAuthClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  }

  /**
   * Initiate Zoho OAuth flow
   */
  async startOAuthFlow(redirectUri?: string): Promise<void> {
    const params = new URLSearchParams();
    if (redirectUri) {
      params.append('redirect_uri', redirectUri);
    }

    const authUrl = `/api/auth/zoho${params.toString() ? `?${params.toString()}` : ''}`;
    window.location.href = authUrl;
  }

  /**
   * Check connection status
   */
  async getConnectionStatus(): Promise<ZohoConnectionStatus> {
    try {
      const response = await fetch('/api/auth/zoho/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to check Zoho connection status:', error);
      return {
        connected: false,
        status: 'not_connected'
      };
    }
  }

  /**
   * Disconnect Zoho integration
   */
  async disconnect(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch('/api/auth/zoho/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to disconnect');
      }

      return result;
    } catch (error) {
      console.error('Failed to disconnect Zoho:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test API connection by making a simple call
   */
  async testConnection(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const status = await this.getConnectionStatus();
      
      if (!status.connected) {
        return {
          success: false,
          error: 'Not connected to Zoho CRM'
        };
      }

      return {
        success: true,
        data: {
          user: status.user_info,
          api_domain: status.api_domain,
          rate_limit: status.rate_limit
        }
      };
    } catch (error) {
      console.error('Zoho connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get OAuth configuration for client-side use (no secrets)
   */
  getOAuthConfig() {
    return {
      clientId: process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID,
      authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
      scopes: [
        'ZohoCRM.modules.ALL',
        'ZohoCRM.settings.ALL',
        'ZohoCRM.users.READ'
      ],
      redirectUri: `${this.baseUrl}/api/auth/zoho/callback`
    };
  }

  /**
   * Check if OAuth is properly configured
   */
  isConfigured(): boolean {
    const config = this.getOAuthConfig();
    return !!(config.clientId && this.baseUrl);
  }

  /**
   * Store tokens manually (for development/testing)
   */
  async storeTokens(tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    api_domain?: string;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch('/api/auth/zoho', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokens),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to store tokens');
      }

      return result;
    } catch (error) {
      console.error('Failed to store Zoho tokens:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Create singleton instance
export const zohoOAuthClient = new ZohoOAuthClient();