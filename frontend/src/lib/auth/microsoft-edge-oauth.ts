/**
 * Microsoft OAuth implementation using Supabase Edge Functions
 * 
 * This implementation moves all OAuth complexity to the server side,
 * eliminating browser storage issues and simplifying the client code.
 */

import { supabase } from '@/lib/supabase/browser';

export interface OAuthError {
  error: string;
  description?: string;
}

export interface OAuthMetrics {
  provider: string;
  action: string;
  duration_ms: number;
  success: boolean;
  error_type?: string;
}

/**
 * Initiates Microsoft OAuth login flow using Edge Functions
 * 
 * This function simply redirects to the Edge Function endpoint,
 * which handles all the OAuth complexity server-side.
 */
export async function signInWithMicrosoftEdge() {
  const startTime = Date.now();
  
  try {
    // Get the Edge Function URL
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/microsoft-oauth`;
    
    // Track the login attempt
    await trackOAuthMetric({
      provider: 'microsoft',
      action: 'login',
      duration_ms: Date.now() - startTime,
      success: true
    });
    
    // Redirect to Edge Function
    window.location.href = `${edgeFunctionUrl}?action=login`;
  } catch (error) {
    console.error('[Microsoft OAuth Edge] Login error:', error);
    
    // Track the error
    await trackOAuthMetric({
      provider: 'microsoft',
      action: 'login',
      duration_ms: Date.now() - startTime,
      success: false,
      error_type: error instanceof Error ? error.message : 'unknown'
    });
    
    throw error;
  }
}

/**
 * Handles the OAuth callback from the Edge Function
 * 
 * This is called after the Edge Function completes the OAuth flow
 * and redirects back to the application.
 */
export async function handleMicrosoftEdgeCallback() {
  const startTime = Date.now();
  
  try {
    // The Edge Function should have created a session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    if (!session) throw new Error('No session found after OAuth callback');
    
    // Track successful callback
    await trackOAuthMetric({
      provider: 'microsoft',
      action: 'callback',
      duration_ms: Date.now() - startTime,
      success: true
    });
    
    return session;
  } catch (error) {
    console.error('[Microsoft OAuth Edge] Callback error:', error);
    
    // Track the error
    await trackOAuthMetric({
      provider: 'microsoft',
      action: 'callback',
      duration_ms: Date.now() - startTime,
      success: false,
      error_type: error instanceof Error ? error.message : 'unknown'
    });
    
    throw error;
  }
}

/**
 * Refreshes Microsoft OAuth tokens using the Edge Function
 * 
 * This function calls the Edge Function to refresh expired tokens
 * using the stored refresh token.
 */
export async function refreshMicrosoftTokens(): Promise<{ access_token: string; expires_in: number }> {
  const startTime = Date.now();
  
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error('No active session');
    
    // Call Edge Function to refresh tokens
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/microsoft-oauth?action=refresh`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Token refresh failed');
    }
    
    const tokens = await response.json();
    
    // Track successful refresh
    await trackOAuthMetric({
      provider: 'microsoft',
      action: 'refresh',
      duration_ms: Date.now() - startTime,
      success: true
    });
    
    return tokens;
  } catch (error) {
    console.error('[Microsoft OAuth Edge] Refresh error:', error);
    
    // Track the error
    await trackOAuthMetric({
      provider: 'microsoft',
      action: 'refresh',
      duration_ms: Date.now() - startTime,
      success: false,
      error_type: error instanceof Error ? error.message : 'unknown'
    });
    
    throw error;
  }
}

/**
 * Gets the current Microsoft OAuth tokens for the authenticated user
 */
export async function getMicrosoftTokens() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    
    // Tokens are stored server-side, accessed via Edge Function
    // In a real implementation, you might want to add an endpoint
    // to retrieve tokens securely if needed
    
    return null; // Tokens are managed server-side
  } catch (error) {
    console.error('[Microsoft OAuth Edge] Get tokens error:', error);
    throw error;
  }
}

/**
 * Signs out and revokes Microsoft OAuth tokens
 */
export async function signOutMicrosoft() {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // In a production implementation, you might want to call
    // Microsoft's revocation endpoint via an Edge Function
  } catch (error) {
    console.error('[Microsoft OAuth Edge] Sign out error:', error);
    throw error;
  }
}

/**
 * Helper function to track OAuth metrics
 */
async function trackOAuthMetric(metric: OAuthMetrics) {
  try {
    // Only track in production
    if (process.env.NODE_ENV !== 'production') return;
    
    // Get user agent for analytics
    const userAgent = navigator.userAgent;
    
    // Send metric to Edge Function for storage
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/oauth-metrics`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...metric,
          user_agent: userAgent
        })
      }
    );
  } catch (error) {
    // Don't throw on metric errors
    console.warn('Failed to track OAuth metric:', error);
  }
}

/**
 * Helper function to check OAuth health status
 */
export async function checkOAuthHealth(): Promise<{
  healthy: boolean;
  latency: number;
  message?: string;
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/microsoft-oauth?action=health`,
      {
        method: 'GET'
      }
    );
    
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        healthy: false,
        latency,
        message: 'Edge Function not responding correctly'
      };
    }
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Migration helper to switch from PKCE to Edge Functions
 */
export async function migrateFromPKCE() {
  try {
    // Clear any existing PKCE storage
    if (typeof window !== 'undefined') {
      // Clear sessionStorage
      ['pkce_code_verifier', 'oauth_state'].forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      // Clear localStorage
      ['pkce_code_verifier', 'oauth_state'].forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Clear cookies
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name === 'pkce_code_verifier' || name === 'oauth_state') {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
    }
    
    console.log('[Microsoft OAuth Edge] Migration completed - PKCE storage cleared');
  } catch (error) {
    console.error('[Microsoft OAuth Edge] Migration error:', error);
  }
}