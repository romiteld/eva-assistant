// Microsoft OAuth Token Refresh Handler
// Implements 24-hour refresh token expiration handling per 2025 requirements

import { signInWithMicrosoftPKCE } from './microsoft-oauth';

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface RefreshResult {
  success: boolean;
  tokenData?: TokenData;
  error?: string;
  requiresReauth?: boolean;
}

/**
 * Attempts to refresh Microsoft OAuth tokens
 * Per 2025 requirements: SPAs have 24-hour refresh token lifetime
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
    const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;
    
    if (!clientId || !tenantId) {
      return {
        success: false,
        error: 'Microsoft OAuth configuration missing',
        requiresReauth: true
      };
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    // Attempt token refresh
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: "openid email profile offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/Contacts.ReadWrite https://graph.microsoft.com/Files.ReadWrite.All"
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check if it's a 24-hour expiration issue
      if (data.error === 'invalid_grant' || data.error === 'interaction_required') {
        console.log('[Token Refresh] Refresh token expired (24-hour limit reached)');
        return {
          success: false,
          error: 'Refresh token expired - reauthentication required',
          requiresReauth: true
        };
      }

      return {
        success: false,
        error: data.error_description || data.error || 'Token refresh failed',
        requiresReauth: false
      };
    }

    return {
      success: true,
      tokenData: data
    };

  } catch (error) {
    console.error('[Token Refresh] Error:', error);
    return {
      success: false,
      error: 'Network error during token refresh',
      requiresReauth: false
    };
  }
}

/**
 * Checks if a token needs refresh based on expiration time
 * Includes buffer time to prevent edge cases
 */
export function tokenNeedsRefresh(expiresAt: Date | string, bufferMinutes: number = 5): boolean {
  const expirationTime = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  
  return (expirationTime.getTime() - bufferMs) <= now.getTime();
}

/**
 * Handles automatic token refresh with 24-hour limit awareness
 */
export async function handleTokenRefresh(
  currentToken: { 
    access_token: string; 
    refresh_token: string; 
    expires_at: string;
    created_at?: string;
  }
): Promise<RefreshResult> {
  // Check if we're approaching the 24-hour refresh token limit
  if (currentToken.created_at) {
    const createdAt = new Date(currentToken.created_at);
    const twentyFourHoursLater = new Date(createdAt.getTime() + (24 * 60 * 60 * 1000));
    const now = new Date();
    
    // If we're within 30 minutes of the 24-hour limit, prompt for reauth
    const thirtyMinutesBeforeExpiry = new Date(twentyFourHoursLater.getTime() - (30 * 60 * 1000));
    
    if (now >= thirtyMinutesBeforeExpiry) {
      console.log('[Token Refresh] Approaching 24-hour refresh token limit');
      return {
        success: false,
        error: 'Refresh token approaching 24-hour limit',
        requiresReauth: true
      };
    }
  }

  // Check if access token needs refresh
  if (!tokenNeedsRefresh(currentToken.expires_at)) {
    return {
      success: true,
      tokenData: {
        access_token: currentToken.access_token,
        refresh_token: currentToken.refresh_token,
        expires_in: 3600, // Assume 1 hour if not expired
        token_type: 'Bearer',
        scope: 'openid email profile offline_access'
      }
    };
  }

  // Attempt to refresh the token
  return await refreshMicrosoftToken(currentToken.refresh_token);
}

/**
 * React hook for automatic token refresh
 */
export function useMicrosoftTokenRefresh() {
  // This would be implemented as a React hook in a separate file
  // For now, this is a placeholder to show the intended usage
  return {
    refreshToken: refreshMicrosoftToken,
    handleTokenRefresh: handleTokenRefresh,
    tokenNeedsRefresh: tokenNeedsRefresh
  };
}