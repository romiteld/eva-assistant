import { NextRequest } from 'next/server'
import { POST as authHandler } from '../auth/route'
import { POST as microsoftHandler } from '../microsoft/route'
import { supabase } from '@/lib/supabase/browser'

// Mock environment
process.env.MICROSOFT_CLIENT_ID = 'test-client-id'
process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret'
process.env.MICROSOFT_TENANT_ID = 'test-tenant-id'

describe('Auth API Route Integration Tests', () => {
  describe('POST /api/auth - Magic Link', () => {
    it('should send magic link for valid email', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'signIn',
          email: 'test@example.com',
        }),
      })

      const response = await authHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Magic link sent')
    })

    it('should validate email format', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'signIn',
          email: 'invalid-email',
        }),
      })

      const response = await authHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid email')
    })

    it('should handle missing email', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'signIn',
        }),
      })

      const response = await authHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email is required')
    })

    it('should handle sign out action', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
        body: JSON.stringify({
          action: 'signOut',
        }),
      })

      const response = await authHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Signed out successfully')
    })

    it('should handle invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invalidAction',
        }),
      })

      const response = await authHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid action')
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await authHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('POST /api/microsoft - OAuth Integration', () => {
    beforeEach(() => {
      // Mock fetch for Microsoft OAuth endpoints
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should exchange code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        id_token: 'mock-id-token',
        expires_in: 3600,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })

      const request = new NextRequest('http://localhost:3000/api/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'exchangeCode',
          code: 'test-auth-code',
          codeVerifier: 'test-verifier',
        }),
      })

      const response = await microsoftHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.access_token).toBe('mock-access-token')
      expect(data.refresh_token).toBe('mock-refresh-token')
    })

    it('should refresh tokens', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse,
      })

      const request = new NextRequest('http://localhost:3000/api/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refreshToken',
          refreshToken: 'old-refresh-token',
        }),
      })

      const response = await microsoftHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.access_token).toBe('new-access-token')
      expect(data.refresh_token).toBe('new-refresh-token')
    })

    it('should get user profile', async () => {
      const mockUserProfile = {
        id: 'user-123',
        displayName: 'Test User',
        mail: 'test@example.com',
        userPrincipalName: 'test@example.com',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserProfile,
      })

      const request = new NextRequest('http://localhost:3000/api/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getUserProfile',
          accessToken: 'valid-access-token',
        }),
      })

      const response = await microsoftHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('user-123')
      expect(data.displayName).toBe('Test User')
      expect(data.mail).toBe('test@example.com')
    })

    it('should handle OAuth errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The provided authorization code is invalid',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'exchangeCode',
          code: 'invalid-code',
          codeVerifier: 'test-verifier',
        }),
      })

      const response = await microsoftHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('invalid_grant')
    })

    it('should handle missing required parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'exchangeCode',
          // Missing code and codeVerifier
        }),
      })

      const response = await microsoftHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required parameters')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      const request = new NextRequest('http://localhost:3000/api/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getUserProfile',
          accessToken: 'valid-token',
        }),
      })

      const response = await microsoftHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Network error')
    })
  })

  describe('Authentication Flow Integration', () => {
    it('should complete full authentication flow', async () => {
      // Step 1: Send magic link
      const signInRequest = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'signIn',
          email: 'test@example.com',
        }),
      })

      const signInResponse = await authHandler(signInRequest)
      expect(signInResponse.status).toBe(200)

      // Step 2: Mock user clicking magic link (handled by Supabase)
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'session-token',
            user: { id: 'user-id', email: 'test@example.com' },
          },
        },
        error: null,
      })

      // Step 3: Verify session
      const verifyRequest = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({
          action: 'getSession',
        }),
      })

      const verifyResponse = await authHandler(verifyRequest)
      const sessionData = await verifyResponse.json()

      expect(verifyResponse.status).toBe(200)
      expect(sessionData.user.email).toBe('test@example.com')
    })
  })
})