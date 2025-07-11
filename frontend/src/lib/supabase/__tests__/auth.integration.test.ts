import { authHelpers } from '../auth'
import { supabase } from '../browser'

// This is an integration test that tests the auth flow with mocked Supabase responses
describe('Authentication Integration Tests', () => {
  describe('Magic Link Authentication Flow', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('successfully sends magic link and handles response', async () => {
      const testEmail = 'test@example.com'
      
      // Test sending magic link
      await expect(authHelpers.sendMagicLink(testEmail)).resolves.not.toThrow()
      
      // Verify the Supabase method was called correctly
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: testEmail,
        options: {
          emailRedirectTo: expect.stringContaining('/dashboard')
        }
      })
    })

    it('handles magic link errors gracefully', async () => {
      const testEmail = 'invalid@example.com'
      const mockError = new Error('Email not allowed')
      
      // Mock error response
      ;(supabase.auth.signInWithOtp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      // Should throw the error
      await expect(authHelpers.sendMagicLink(testEmail)).rejects.toThrow('Email not allowed')
    })

    it('handles session retrieval after magic link click', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }
      
      // Mock successful session
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null
      })
      
      const session = await authHelpers.getSession()
      
      expect(session).toEqual(mockSession)
    })
  })

  describe('User Authentication State', () => {
    it('retrieves authenticated user details', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' }
      }
      
      ;(supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      })
      
      const user = await authHelpers.getUser()
      
      expect(user).toEqual(mockUser)
    })

    it('handles unauthenticated state correctly', async () => {
      ;(supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null
      })
      
      const user = await authHelpers.getUser()
      
      expect(user).toBeNull()
    })

    it('subscribes to auth state changes', () => {
      const mockCallback = jest.fn()
      const mockUnsubscribe = jest.fn()
      
      ;(supabase.auth.onAuthStateChange as jest.Mock).mockReturnValueOnce({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      })
      
      const { unsubscribe } = authHelpers.onAuthStateChange(mockCallback)
      
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback)
      
      // Test unsubscribe
      unsubscribe()
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('Sign Out Flow', () => {
    it('successfully signs out user', async () => {
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
        error: null
      })
      
      await expect(authHelpers.signOut()).resolves.not.toThrow()
      
      expect(supabase.auth.signOut).toHaveBeenCalled()
    })

    it('handles sign out errors', async () => {
      const mockError = new Error('Network error')
      
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
        error: mockError
      })
      
      await expect(authHelpers.signOut()).rejects.toThrow('Network error')
    })
  })

  describe('Microsoft OAuth Flow', () => {
    it('initiates Microsoft OAuth flow correctly', async () => {
      const mockUrl = 'https://auth.supabase.co/oauth/microsoft'
      
      ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: mockUrl },
        error: null
      })
      
      const result = await authHelpers.signInWithMicrosoft()
      
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'azure',
        options: {
          scopes: expect.stringContaining('User.Read'),
          redirectTo: expect.stringContaining('/dashboard')
        }
      })
      
      expect(result.url).toBe(mockUrl)
    })

    it('handles OAuth initialization errors', async () => {
      const mockError = new Error('OAuth provider not configured')
      
      ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      await expect(authHelpers.signInWithMicrosoft()).rejects.toThrow('OAuth provider not configured')
    })
  })

  describe('Token Refresh Flow', () => {
    it('refreshes session tokens successfully', async () => {
      const mockNewSession = {
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
        user: { id: 'test-user-id' }
      }
      
      ;(supabase.auth.refreshSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockNewSession },
        error: null
      })
      
      const session = await authHelpers.refreshSession()
      
      expect(session).toEqual(mockNewSession)
    })

    it('handles token refresh failures', async () => {
      const mockError = new Error('Invalid refresh token')
      
      ;(supabase.auth.refreshSession as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      await expect(authHelpers.refreshSession()).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('Protected Route Access', () => {
    it('allows access with valid session', async () => {
      const mockSession = {
        access_token: 'valid-token',
        user: { id: 'test-user-id' }
      }
      
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null
      })
      
      const isAuthenticated = await authHelpers.isAuthenticated()
      
      expect(isAuthenticated).toBe(true)
    })

    it('denies access without session', async () => {
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null
      })
      
      const isAuthenticated = await authHelpers.isAuthenticated()
      
      expect(isAuthenticated).toBe(false)
    })
  })

  describe('User Profile Integration', () => {
    it('fetches user profile after authentication', async () => {
      const userId = 'test-user-id'
      const mockProfile = {
        id: userId,
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg'
      }
      
      // Mock the Supabase query chain
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: mockProfile,
          error: null
        })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValueOnce(mockQuery)
      
      const profile = await authHelpers.getUserProfile(userId)
      
      expect(supabase.from).toHaveBeenCalledWith('profiles')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('id', userId)
      expect(profile).toEqual(mockProfile)
    })
  })
})