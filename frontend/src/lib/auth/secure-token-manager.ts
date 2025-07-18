import { TokenManager } from './token-manager';

/**
 * Creates a secure TokenManager instance that uses server-side endpoints
 * for token refresh, preventing client secret exposure
 */
export function createSecureTokenManager(encryptionKey: string): TokenManager {
  // Create TokenManager with server-side refresh endpoints
  // Client secrets are NEVER exposed here
  const secureConfig = {
    microsoft: {
      tokenUrl: '/api/oauth/refresh',
      clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
      clientSecret: '', // Empty - handled server-side
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common'
    },
    google: {
      tokenUrl: '/api/oauth/refresh',
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      clientSecret: '' // Empty - handled server-side
    },
    linkedin: {
      tokenUrl: '/api/oauth/refresh',
      clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || '',
      clientSecret: '' // Empty - handled server-side
    },
    zoom: {
      tokenUrl: '/api/oauth/refresh',
      clientId: process.env.ZOOM_CLIENT_ID || '',
      clientSecret: '', // Empty - handled server-side
      accountId: process.env.ZOOM_ACCOUNT_ID || ''
    },
    salesforce: {
      tokenUrl: '/api/oauth/refresh',
      clientId: process.env.SALESFORCE_CLIENT_ID || '',
      clientSecret: '' // Empty - handled server-side
    },
    zoho: {
      tokenUrl: '/api/oauth/refresh',
      clientId: process.env.ZOHO_CLIENT_ID || '',
      clientSecret: '' // Empty - handled server-side
    }
  };

  return new TokenManager(encryptionKey, secureConfig);
}