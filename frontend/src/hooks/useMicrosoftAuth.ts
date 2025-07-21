// React hook for Microsoft OAuth with automatic token refresh
// Handles 24-hour refresh token expiration per 2025 requirements

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithMicrosoftPKCE } from '@/lib/auth/microsoft-oauth';
import { handleTokenRefresh, tokenNeedsRefresh } from '@/lib/auth/microsoft-token-refresh';

interface MicrosoftAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  userEmail: string | null;
  tokenExpiresAt: Date | null;
  requires24HourReauth: boolean;
}

interface UseMicrosoftAuthReturn extends MicrosoftAuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

export function useMicrosoftAuth(): UseMicrosoftAuthReturn {
  const router = useRouter();
  const [state, setState] = useState<MicrosoftAuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    userEmail: null,
    tokenExpiresAt: null,
    requires24HourReauth: false
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up automatic token refresh
  useEffect(() => {
    if (!state.isAuthenticated || !state.tokenExpiresAt) return;

    // Check every minute if token needs refresh
    const interval = setInterval(() => {
      if (tokenNeedsRefresh(state.tokenExpiresAt!, 10)) {
        refreshToken();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.isAuthenticated, state.tokenExpiresAt, refreshToken]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/microsoft/token');
      const data = await response.json();

      if (response.ok && data.authenticated) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userEmail: data.email,
          tokenExpiresAt: new Date(data.expiresAt),
          isLoading: false
        }));

        // Check if we need to refresh
        if (data.needsRefresh) {
          await refreshToken();
        }
      } else {
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to check authentication status'
      }));
    }
  };

  const signIn = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      await signInWithMicrosoftPKCE();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sign in failed'
      }));
    }
  };

  const signOut = async () => {
    try {
      // Clear tokens from backend
      await fetch('/api/auth/microsoft/logout', { method: 'POST' });
      
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        userEmail: null,
        tokenExpiresAt: null,
        requires24HourReauth: false
      });

      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/microsoft/refresh', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's the 24-hour limit
        if (data.requiresReauth) {
          setState(prev => ({
            ...prev,
            requires24HourReauth: true,
            error: 'Please sign in again to continue (24-hour security requirement)'
          }));
          
          // Auto-redirect to sign in after a short delay
          setTimeout(() => {
            signIn();
          }, 3000);
          
          return;
        }

        throw new Error(data.error || 'Token refresh failed');
      }

      // Update state with new token info
      setState(prev => ({
        ...prev,
        tokenExpiresAt: new Date(data.expiresAt),
        error: null
      }));

    } catch (error) {
      console.error('Token refresh failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to refresh authentication',
        isAuthenticated: false
      }));
    }
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    refreshToken
  };
}

// Hook for handling Microsoft Graph API calls with automatic token refresh
export function useMicrosoftGraphAPI() {
  const { isAuthenticated, refreshToken } = useMicrosoftAuth();

  const callGraphAPI = useCallback(async (
    endpoint: string,
    options?: RequestInit
  ): Promise<Response> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    // First attempt
    let response = await fetch(`/api/microsoft${endpoint}`, {
      ...options,
      headers: {
        ...options?.headers,
        'Content-Type': 'application/json'
      }
    });

    // If unauthorized, try refreshing token
    if (response.status === 401) {
      await refreshToken();
      
      // Retry the request
      response = await fetch(`/api/microsoft${endpoint}`, {
        ...options,
        headers: {
          ...options?.headers,
          'Content-Type': 'application/json'
        }
      });
    }

    return response;
  }, [isAuthenticated, refreshToken]);

  return { callGraphAPI };
}