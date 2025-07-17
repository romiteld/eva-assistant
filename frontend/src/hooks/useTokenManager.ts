import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useAuth } from '@/hooks/useAuth';
import { getTokenManager } from '@/lib/auth/token-manager';
import { useToast } from '@/hooks/use-toast';

interface TokenStatus {
  hasToken: boolean;
  isValid: boolean;
  expiresAt?: Date;
  scopes?: string[];
  lastRefreshed?: Date;
  refreshCount?: number;
}

export function useTokenManager() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tokenStatuses, setTokenStatuses] = useState<Record<string, TokenStatus>>({});
  const [loading, setLoading] = useState(false);

  // Initialize token manager
  const tokenManager = getTokenManager(
    process.env.ENCRYPTION_KEY || 'default-encryption-key',
    {
      microsoft: {
        tokenUrl: 'https://login.microsoftonline.com',
        clientId: process.env.ENTRA_CLIENT_ID!,
        clientSecret: process.env.ENTRA_CLIENT_SECRET!,
        tenantId: process.env.ENTRA_TENANT_ID!
      },
      google: {
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
      },
      linkedin: {
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        clientId: process.env.LINKEDIN_CLIENT_ID!,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
      },
      zoom: {
        tokenUrl: 'https://zoom.us/oauth/token',
        clientId: process.env.ZOOM_CLIENT_ID!,
        clientSecret: process.env.ZOOM_CLIENT_SECRET!,
        accountId: process.env.ZOOM_ACCOUNT_ID!
      },
      salesforce: {
        tokenUrl: process.env.SALESFORCE_INSTANCE_URL || '',
        clientId: process.env.SALESFORCE_CLIENT_ID || '',
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
      },
      zoho: {
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        clientId: process.env.ZOHO_CLIENT_ID!,
        clientSecret: process.env.ZOHO_CLIENT_SECRET!
      }
    }
  );

  // Fetch all token statuses
  const fetchTokenStatuses = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const statuses = await tokenManager.getAllTokenStatuses(user.id);
      setTokenStatuses(statuses);
    } catch (error) {
      console.error('Error fetching token statuses:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Get a valid token for a provider
  const getToken = useCallback(async (provider: string) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'Please sign in to access tokens',
        variant: 'destructive'
      });
      return null;
    }

    try {
      const token = await tokenManager.getValidToken(user.id, provider as any);
      
      if (!token) {
        toast({
          title: 'Token not found',
          description: `Please connect your ${provider} account first`,
          variant: 'destructive'
        });
        return null;
      }

      // Update status after getting token
      const status = await tokenManager.getTokenStatus(user.id, provider as any);
      setTokenStatuses(prev => ({ ...prev, [provider]: status }));

      return token;
    } catch (error) {
      console.error(`Error getting ${provider} token:`, error);
      toast({
        title: 'Token error',
        description: `Failed to get ${provider} token`,
        variant: 'destructive'
      });
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, toast]);

  // Store new tokens
  const storeTokens = useCallback(async (
    provider: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      scope?: string;
    }
  ) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'Please sign in to store tokens',
        variant: 'destructive'
      });
      return;
    }

    try {
      await tokenManager.storeTokens(user.id, provider as any, tokens);
      
      toast({
        title: 'Success',
        description: `${provider} account connected successfully`
      });

      // Refresh statuses
      await fetchTokenStatuses();
    } catch (error) {
      console.error(`Error storing ${provider} tokens:`, error);
      toast({
        title: 'Error',
        description: `Failed to store ${provider} tokens`,
        variant: 'destructive'
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, toast, fetchTokenStatuses]);

  // Revoke tokens
  const revokeTokens = useCallback(async (provider: string) => {
    if (!user?.id) return;

    try {
      await tokenManager.revokeTokens(user.id, provider as any);
      
      toast({
        title: 'Success',
        description: `${provider} account disconnected`
      });

      // Update status
      setTokenStatuses(prev => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
    } catch (error) {
      console.error(`Error revoking ${provider} tokens:`, error);
      toast({
        title: 'Error',
        description: `Failed to disconnect ${provider}`,
        variant: 'destructive'
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, toast]);

  // Initialize OAuth flow
  const initializeOAuth = useCallback((provider: string) => {
    const authUrls: Record<string, string> = {
      microsoft: `/api/auth/microsoft`,
      google: `/api/auth/google`,
      linkedin: `/api/auth/linkedin`,
      zoom: `/api/auth/zoom`,
      salesforce: `/api/auth/salesforce`,
      zoho: `/api/auth/zoho`
    };

    const authUrl = authUrls[provider];
    if (!authUrl) {
      toast({
        title: 'Error',
        description: `OAuth not configured for ${provider}`,
        variant: 'destructive'
      });
      return;
    }

    // Open OAuth window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      authUrl,
      `${provider}-oauth`,
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth completion
    const checkInterval = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkInterval);
        // Refresh token statuses after OAuth flow
        setTimeout(() => fetchTokenStatuses(), 1000);
      }
    }, 1000);
  }, [toast, fetchTokenStatuses]);

  // Check if token is expiring soon
  const isTokenExpiringSoon = useCallback((provider: string): boolean => {
    const status = tokenStatuses[provider];
    if (!status?.isValid || !status.expiresAt) return false;

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(status.expiresAt) < fiveMinutesFromNow;
  }, [tokenStatuses]);

  // Auto-refresh statuses periodically
  useEffect(() => {
    if (!user?.id) return;

    fetchTokenStatuses();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchTokenStatuses, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.id, fetchTokenStatuses]);

  return {
    tokenStatuses,
    loading,
    getToken,
    storeTokens,
    revokeTokens,
    initializeOAuth,
    isTokenExpiringSoon,
    refreshStatuses: fetchTokenStatuses
  };
}

// Provider-specific hooks
export function useMicrosoftToken() {
  const { getToken, tokenStatuses, initializeOAuth } = useTokenManager();
  
  return {
    getToken: () => getToken('microsoft'),
    status: tokenStatuses.microsoft,
    connect: () => initializeOAuth('microsoft')
  };
}

export function useLinkedInToken() {
  const { getToken, tokenStatuses, initializeOAuth } = useTokenManager();
  
  return {
    getToken: () => getToken('linkedin'),
    status: tokenStatuses.linkedin,
    connect: () => initializeOAuth('linkedin')
  };
}

export function useZoomToken() {
  const { getToken, tokenStatuses, initializeOAuth } = useTokenManager();
  
  return {
    getToken: () => getToken('zoom'),
    status: tokenStatuses.zoom,
    connect: () => initializeOAuth('zoom')
  };
}

export function useZohoToken() {
  const { getToken, tokenStatuses, initializeOAuth } = useTokenManager();
  
  return {
    getToken: () => getToken('zoho'),
    status: tokenStatuses.zoho,
    connect: () => initializeOAuth('zoho')
  };
}