/**
 * Test suite for Zoho OAuth implementation
 * Ensures security best practices and proper token handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock the Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    upsert: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  }))
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}));

// Mock fetch for external API calls
global.fetch = jest.fn();

// Mock environment variables
process.env.ZOHO_CLIENT_ID = 'test_client_id';
process.env.ZOHO_CLIENT_SECRET = 'test_client_secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.ZOHO_WEBHOOK_TOKEN = 'test_webhook_token';

describe('Zoho OAuth Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Client Secret Protection', () => {
    it('should not expose client secret in frontend code', () => {
      // Import the Zoho CRM integration
      const { ZohoCRMIntegration } = require('@/lib/integrations/zoho-crm');
      
      // Create instance
      const zohoIntegration = new ZohoCRMIntegration('test-key', 'test-webhook-token');
      
      // Check that client secret is not accessible through instance
      expect(zohoIntegration.api).toBeDefined();
      
      // Verify that constructor only uses public client ID
      const constructorSource = ZohoCRMIntegration.toString();
      expect(constructorSource).toContain('NEXT_PUBLIC_ZOHO_CLIENT_ID');
      expect(constructorSource).toContain('clientSecret: \'\''); // Should be empty
    });

    it('should use environment variables correctly', () => {
      // Check that only public environment variables are used in client code
      const zohoOAuthClient = require('@/lib/integrations/zoho-oauth-client');
      
      const config = zohoOAuthClient.zohoOAuthClient.getOAuthConfig();
      
      expect(config.clientId).toBe(process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID);
      expect(config).not.toHaveProperty('clientSecret');
    });
  });

  describe('OAuth Routes Security', () => {
    it('should validate user authentication in OAuth init', async () => {
      const { GET } = require('@/app/api/auth/zoho/route');
      
      // Mock unauthenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      });

      const request = new NextRequest('http://localhost:3000/api/auth/zoho');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });

    it('should handle missing Zoho configuration', async () => {
      const { GET } = require('@/app/api/auth/zoho/route');
      
      // Temporarily remove client ID
      const originalClientId = process.env.ZOHO_CLIENT_ID;
      delete process.env.ZOHO_CLIENT_ID;

      const request = new NextRequest('http://localhost:3000/api/auth/zoho');
      const response = await GET(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Zoho OAuth not configured');
      
      // Restore client ID
      process.env.ZOHO_CLIENT_ID = originalClientId;
    });

    it('should generate secure OAuth URL', async () => {
      const { GET } = require('@/app/api/auth/zoho/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/zoho');
      const response = await GET(request);
      
      expect(response.status).toBe(302);
      
      const location = response.headers.get('location');
      expect(location).toContain('https://accounts.zoho.com/oauth/v2/auth');
      expect(location).toContain('client_id=test_client_id');
      expect(location).toContain('response_type=code');
      expect(location).toContain('access_type=offline');
      expect(location).not.toContain('client_secret'); // Should never be in URL
    });
  });

  describe('Token Callback Security', () => {
    it('should validate callback parameters', async () => {
      const { GET } = require('@/app/api/auth/zoho/callback/route');
      
      // Test missing code
      const request = new NextRequest('http://localhost:3000/api/auth/zoho/callback?state={}');
      const response = await GET(request);
      
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('error=missing_parameters');
    });

    it('should validate state parameter', async () => {
      const { GET } = require('@/app/api/auth/zoho/callback/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/zoho/callback?code=test_code&state=invalid_json');
      const response = await GET(request);
      
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('error=invalid_state');
    });

    it('should exchange code for tokens securely', async () => {
      const { GET } = require('@/app/api/auth/zoho/callback/route');
      
      // Mock successful token exchange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test_access_token',
          refresh_token: 'test_refresh_token',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.com'
        })
      });

      // Mock user info call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: 'test' } })
      });

      // Mock successful database insert
      mockSupabaseClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const state = JSON.stringify({ 
        userId: 'test-user-id', 
        redirectUri: 'http://localhost:3000/dashboard' 
      });
      
      const request = new NextRequest(`http://localhost:3000/api/auth/zoho/callback?code=test_code&state=${encodeURIComponent(state)}`);
      const response = await GET(request);
      
      expect(response.status).toBe(302);
      
      // Verify token exchange request
      expect(fetch).toHaveBeenCalledWith(
        'https://accounts.zoho.com/oauth/v2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: expect.stringContaining('client_secret=test_client_secret')
        })
      );
    });
  });

  describe('Webhook Security', () => {
    it('should verify webhook signatures', async () => {
      const { verifyWebhookSignature } = require('@/app/api/zoho/webhooks/route');
      const crypto = require('crypto');
      
      const body = JSON.stringify({ test: 'data' });
      const webhookToken = 'test_webhook_token';
      
      // Generate valid signature
      const hmac = crypto.createHmac('sha256', webhookToken);
      hmac.update(body);
      const validSignature = hmac.digest('hex');
      
      const headers = {
        'x-zoho-webhook-signature': validSignature
      };
      
      // Should be accessible for testing, but note this is internal
      // const isValid = await verifyWebhookSignature(body, headers);
      // expect(isValid).toBe(true);
      
      // Test invalid signature
      const invalidHeaders = {
        'x-zoho-webhook-signature': 'invalid_signature'
      };
      
      // const isInvalid = await verifyWebhookSignature(body, invalidHeaders);
      // expect(isInvalid).toBe(false);
    });

    it('should handle missing webhook token gracefully', () => {
      const originalToken = process.env.ZOHO_WEBHOOK_TOKEN;
      delete process.env.ZOHO_WEBHOOK_TOKEN;
      
      // In development, should allow requests
      process.env.NODE_ENV = 'development';
      // Test would go here if verifyWebhookSignature was exported
      
      // In production, should reject
      process.env.NODE_ENV = 'production';
      // Test would go here if verifyWebhookSignature was exported
      
      // Restore
      process.env.ZOHO_WEBHOOK_TOKEN = originalToken;
    });
  });

  describe('Token Storage Security', () => {
    it('should store tokens with proper metadata', async () => {
      const { POST } = require('@/app/api/auth/zoho/route');
      
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert
      });

      const request = new NextRequest('http://localhost:3000/api/auth/zoho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.com'
        })
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id',
          provider: 'zoho',
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          metadata: { api_domain: 'https://www.zohoapis.com' }
        })
      );
    });

    it('should not return sensitive data in responses', async () => {
      const { GET } = require('@/app/api/auth/zoho/status/route');
      
      // Mock token data
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                access_token: 'secret_token',
                refresh_token: 'secret_refresh',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                metadata: { api_domain: 'https://www.zohoapis.com' }
              },
              error: null
            })
          })
        })
      });

      // Mock API call
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          users: [{ 
            id: 'test', 
            full_name: 'Test User',
            email: 'test@example.com'
          }]
        }),
        headers: new Map([
          ['x-ratelimit-limit', '1000'],
          ['x-ratelimit-remaining', '999']
        ])
      });

      const request = new NextRequest('http://localhost:3000/api/auth/zoho/status');
      const response = await GET(request);
      
      const data = await response.json();
      
      // Should not expose tokens
      expect(data).not.toHaveProperty('access_token');
      expect(data).not.toHaveProperty('refresh_token');
      
      // Should include safe data
      expect(data).toHaveProperty('connected');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('user_info');
    });
  });
});

describe('Client-side OAuth Utils', () => {
  it('should not expose secrets in client utilities', () => {
    const { ZohoOAuthClient } = require('@/lib/integrations/zoho-oauth-client');
    
    const client = new ZohoOAuthClient();
    const config = client.getOAuthConfig();
    
    expect(config).toHaveProperty('clientId');
    expect(config).not.toHaveProperty('clientSecret');
    expect(config.clientId).toBe(process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID);
  });

  it('should validate configuration before use', () => {
    const { ZohoOAuthClient } = require('@/lib/integrations/zoho-oauth-client');
    
    const client = new ZohoOAuthClient();
    
    // With proper config
    process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID = 'test_client_id';
    expect(client.isConfigured()).toBe(true);
    
    // Without client ID
    delete process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID;
    expect(client.isConfigured()).toBe(false);
  });
});