import { Database } from '@/types/supabase';
import { supabase } from '@/lib/supabase/browser';

// Use Web Crypto API for browser compatibility
const crypto = typeof window !== 'undefined' ? window.crypto : require('crypto');

interface OAuthToken {
  id: string;
  userId: string;
  provider: 'microsoft' | 'google' | 'linkedin' | 'zoom' | 'salesforce' | 'zoho';
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
  metadata?: Record<string, any>;
  lastRefreshed?: Date;
  refreshCount: number;
}

interface TokenRefreshConfig {
  microsoft: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
  };
  google: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
  };
  linkedin: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
  };
  zoom: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    accountId: string;
  };
  salesforce: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
  };
  zoho: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
  };
}

export class TokenManager {
  private supabase = supabase;
  private encryptionKey: string;
  private refreshConfigs: TokenRefreshConfig;
  private refreshPromises: Map<string, Promise<OAuthToken>>;
  private tokenCache: Map<string, { token: OAuthToken; timestamp: number }>;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  constructor(
    encryptionKey: string,
    refreshConfigs: TokenRefreshConfig
  ) {
    this.encryptionKey = encryptionKey;
    this.refreshConfigs = refreshConfigs;
    this.refreshPromises = new Map();
    this.tokenCache = new Map();
    
    // Start background token refresh check
    this.startBackgroundRefresh();
  }

  // Encrypt sensitive token data
  private async encrypt(text: string): Promise<string> {
    if (typeof window !== 'undefined') {
      // Browser environment - use Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      // Derive key from encryption key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      // Convert to hex string
      const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
      const encryptedHex = Array.from(new Uint8Array(encryptedData))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      return `${ivHex}:${encryptedHex}`;
    } else {
      // Node.js environment
      const nodeCrypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const key = nodeCrypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = nodeCrypto.randomBytes(16);
      const cipher = nodeCrypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
  }

  // Decrypt sensitive token data
  private async decrypt(encryptedData: string): Promise<string> {
    if (typeof window !== 'undefined') {
      // Browser environment - use Web Crypto API
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const parts = encryptedData.split(':');
      
      // Derive key from encryption key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Convert hex strings back to arrays
      const iv = new Uint8Array(parts[0].match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      const encrypted = new Uint8Array(parts[1].match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      return decoder.decode(decryptedData);
    } else {
      // Node.js environment
      const nodeCrypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const key = nodeCrypto.scryptSync(this.encryptionKey, 'salt', 32);
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = nodeCrypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
  }

  // Get a valid token, refreshing if necessary
  async getValidToken(userId: string, provider: OAuthToken['provider']): Promise<OAuthToken | null> {
    try {
      // Check cache first
      const cacheKey = `${userId}-${provider}`;
      const cached = this.tokenCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        const token = cached.token;
        if (new Date(token.expiresAt) > new Date(Date.now() + 5 * 60 * 1000)) {
          return token;
        }
      }

      // Check if already refreshing
      const refreshKey = `${userId}-${provider}`;
      if (this.refreshPromises.has(refreshKey)) {
        return await this.refreshPromises.get(refreshKey)!;
      }

      // Fetch from database
      const { data: credential, error } = await this.supabase
        .from('oauth_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error || !credential) {
        console.error('Error fetching credential:', error);
        return null;
      }

      // Decrypt tokens
      const token: OAuthToken = {
        id: credential.id,
        userId: credential.user_id,
        provider: credential.provider as OAuthToken['provider'],
        accessToken: this.decrypt(credential.access_token),
        refreshToken: credential.refresh_token ? this.decrypt(credential.refresh_token) : undefined,
        expiresAt: new Date(credential.expires_at),
        scopes: credential.scopes || [],
        metadata: credential.metadata,
        lastRefreshed: credential.last_refreshed ? new Date(credential.last_refreshed) : undefined,
        refreshCount: credential.refresh_count || 0
      };

      // Check if token needs refresh (5 minutes buffer)
      const now = new Date();
      const expiryBuffer = new Date(token.expiresAt.getTime() - 5 * 60 * 1000);
      
      if (now >= expiryBuffer && token.refreshToken) {
        // Refresh the token
        const refreshPromise = this.refreshToken(token);
        this.refreshPromises.set(refreshKey, refreshPromise);
        
        try {
          const refreshedToken = await refreshPromise;
          this.tokenCache.set(cacheKey, { token: refreshedToken, timestamp: Date.now() });
          return refreshedToken;
        } finally {
          this.refreshPromises.delete(refreshKey);
        }
      }

      // Token is still valid
      this.tokenCache.set(cacheKey, { token, timestamp: Date.now() });
      return token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  // Refresh an expired token
  private async refreshToken(token: OAuthToken): Promise<OAuthToken> {
    const config = this.refreshConfigs[token.provider];
    if (!config || !token.refreshToken) {
      throw new Error(`No refresh configuration for provider: ${token.provider}`);
    }

    try {
      let response: Response;
      let body: URLSearchParams | string;

      // Check if using server-side refresh endpoint (secure mode)
      if (config.tokenUrl === '/api/oauth/refresh') {
        // Use secure server-side refresh endpoint
        const { data: session } = await this.supabase.auth.getSession();
        
        response = await fetch('/api/oauth/refresh', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(session?.session ? {
              'Authorization': `Bearer ${session.session.access_token}`
            } : {})
          },
          body: JSON.stringify({
            provider: token.provider,
            refreshToken: token.refreshToken
          })
        });
      } else {
        // Legacy direct refresh (should only be used server-side)
        // WARNING: This path uses client secrets and should NEVER be used in client-side code
        if (typeof window !== 'undefined') {
          console.error(`SECURITY WARNING: Direct OAuth refresh for ${token.provider} detected in client-side code!`);
          throw new Error('Direct OAuth refresh not allowed in client-side code. Use server-side refresh endpoint.');
        }
        
        switch (token.provider) {
          case 'microsoft':
            body = new URLSearchParams({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              refresh_token: token.refreshToken,
              grant_type: 'refresh_token',
              scope: token.scopes.join(' ')
            });
            
            response = await fetch(
              `https://login.microsoftonline.com/${(config as any).tenantId}/oauth2/v2.0/token`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
              }
            );
            break;

        case 'google':
          body = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token'
          });
          
          response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          });
          break;

        case 'linkedin':
          body = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token'
          });
          
          response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          });
          break;

        case 'zoom':
          const authHeader = Buffer.from(
            `${config.clientId}:${config.clientSecret}`
          ).toString('base64');
          
          body = new URLSearchParams({
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token'
          });
          
          response = await fetch('https://zoom.us/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${authHeader}`
            },
            body
          });
          break;

        case 'salesforce':
          body = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token'
          });
          
          response = await fetch(`${config.tokenUrl}/services/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          });
          break;

        case 'zoho':
          body = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token'
          });
          
          response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          });
          break;

        default:
          throw new Error(`Unsupported provider: ${token.provider}`);
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      // Calculate new expiry time
      const expiresIn = data.expires_in || 3600; // Default to 1 hour
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Update token in database
      const { error: updateError } = await this.supabase
        .from('oauth_credentials')
        .update({
          access_token: this.encrypt(data.access_token),
          refresh_token: data.refresh_token ? this.encrypt(data.refresh_token) : undefined,
          expires_at: expiresAt.toISOString(),
          last_refreshed: new Date().toISOString(),
          refresh_count: token.refreshCount + 1,
          metadata: {
            ...token.metadata,
            last_refresh_response: {
              token_type: data.token_type,
              scope: data.scope,
              ext_expires_in: data.ext_expires_in
            }
          }
        })
        .eq('id', token.id);

      if (updateError) {
        throw new Error(`Failed to update token: ${updateError.message}`);
      }

      // Log refresh event
      await this.logTokenEvent(token.userId, token.provider, 'refresh', {
        success: true,
        refreshCount: token.refreshCount + 1
      });

      // Return updated token
      return {
        ...token,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || token.refreshToken,
        expiresAt,
        lastRefreshed: new Date(),
        refreshCount: token.refreshCount + 1
      };
    } catch (error) {
      console.error(`Token refresh failed for ${token.provider}:`, error);
      
      // Log failed refresh
      await this.logTokenEvent(token.userId, token.provider, 'refresh_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        refreshCount: token.refreshCount
      });
      
      throw error;
    }
  }

  // Store initial OAuth tokens
  async storeTokens(
    userId: string,
    provider: OAuthToken['provider'],
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      scope?: string;
    }
  ): Promise<void> {
    try {
      const expiresAt = new Date(
        Date.now() + (tokens.expiresIn || 3600) * 1000
      );

      const encryptedAccessToken = this.encrypt(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken
        ? this.encrypt(tokens.refreshToken)
        : null;

      await this.supabase
        .from('oauth_credentials')
        .upsert({
          user_id: userId,
          provider,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: expiresAt.toISOString(),
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
          metadata: {
            stored_at: new Date().toISOString()
          },
          refresh_count: 0
        });

      // Clear cache
      this.tokenCache.delete(`${userId}-${provider}`);
      
      await this.logTokenEvent(userId, provider, 'stored', {
        hasRefreshToken: !!tokens.refreshToken,
        scopes: tokens.scope
      });
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  }

  // Revoke tokens
  async revokeTokens(userId: string, provider: OAuthToken['provider']): Promise<void> {
    try {
      const token = await this.getValidToken(userId, provider);
      if (!token) return;

      // Provider-specific revocation
      await this.revokeProviderToken(token);

      // Delete from database
      await this.supabase
        .from('oauth_credentials')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

      // Clear cache
      this.tokenCache.delete(`${userId}-${provider}`);
      
      await this.logTokenEvent(userId, provider, 'revoked', {});
    } catch (error) {
      console.error('Error revoking tokens:', error);
      throw error;
    }
  }

  // Provider-specific token revocation
  private async revokeProviderToken(token: OAuthToken): Promise<void> {
    try {
      switch (token.provider) {
        case 'microsoft':
          // Microsoft doesn't have a revocation endpoint, tokens expire naturally
          break;
          
        case 'google':
          await fetch(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, {
            method: 'POST'
          });
          break;
          
        case 'linkedin':
          // LinkedIn token revocation
          await fetch('https://www.linkedin.com/oauth/v2/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: this.refreshConfigs.linkedin.clientId,
              client_secret: this.refreshConfigs.linkedin.clientSecret,
              token: token.accessToken
            })
          });
          break;
          
        // Add other providers as needed
      }
    } catch (error) {
      console.error(`Error revoking ${token.provider} token:`, error);
    }
  }

  // Log token events for audit
  private async logTokenEvent(
    userId: string,
    provider: string,
    action: string,
    metadata: any
  ): Promise<void> {
    try {
      await this.supabase
        .from('api_usage')
        .insert({
          user_id: userId,
          endpoint: `oauth/${provider}/${action}`,
          method: 'SYSTEM',
          status_code: 200,
          response_time_ms: 0,
          tokens_used: 0,
          cost: 0,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging token event:', error);
    }
  }

  // Background token refresh check
  private startBackgroundRefresh(): void {
    setInterval(async () => {
      try {
        // Get all tokens expiring in the next 10 minutes
        const { data: expiringTokens } = await this.supabase
          .from('oauth_credentials')
          .select('*')
          .lt('expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
          .gt('expires_at', new Date().toISOString());

        if (!expiringTokens) return;

        for (const credential of expiringTokens) {
          if (credential.refresh_token) {
            try {
              await this.getValidToken(
                credential.user_id,
                credential.provider as OAuthToken['provider']
              );
            } catch (error) {
              console.error(`Background refresh failed for ${credential.provider}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Background refresh check failed:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  // Get token status
  async getTokenStatus(userId: string, provider: OAuthToken['provider']): Promise<{
    hasToken: boolean;
    isValid: boolean;
    expiresAt?: Date;
    scopes?: string[];
    lastRefreshed?: Date;
    refreshCount?: number;
  }> {
    try {
      const { data: credential } = await this.supabase
        .from('oauth_credentials')
        .select('expires_at, scopes, last_refreshed, refresh_count')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (!credential) {
        return { hasToken: false, isValid: false };
      }

      const isValid = new Date(credential.expires_at) > new Date();
      
      return {
        hasToken: true,
        isValid,
        expiresAt: new Date(credential.expires_at),
        scopes: credential.scopes,
        lastRefreshed: credential.last_refreshed ? new Date(credential.last_refreshed) : undefined,
        refreshCount: credential.refresh_count
      };
    } catch (error) {
      console.error('Error getting token status:', error);
      return { hasToken: false, isValid: false };
    }
  }

  // Batch token status check
  async getAllTokenStatuses(userId: string): Promise<Record<string, any>> {
    try {
      const { data: credentials } = await this.supabase
        .from('oauth_credentials')
        .select('provider, expires_at, scopes, last_refreshed')
        .eq('user_id', userId);

      if (!credentials) return {};

      const statuses: Record<string, any> = {};
      
      for (const credential of credentials) {
        const isValid = new Date(credential.expires_at) > new Date();
        statuses[credential.provider] = {
          hasToken: true,
          isValid,
          expiresAt: new Date(credential.expires_at),
          scopes: credential.scopes,
          lastRefreshed: credential.last_refreshed ? new Date(credential.last_refreshed) : undefined
        };
      }

      return statuses;
    } catch (error) {
      console.error('Error getting all token statuses:', error);
      return {};
    }
  }
}

// Singleton instance factory
let tokenManagerInstance: TokenManager | null = null;

export function getTokenManager(
  encryptionKey: string,
  refreshConfigs: TokenRefreshConfig
): TokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new TokenManager(
      encryptionKey,
      refreshConfigs
    );
  }
  return tokenManagerInstance;
}