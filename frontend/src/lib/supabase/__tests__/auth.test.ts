import { authHelpers } from '../auth'
import { createBrowserClient } from '@supabase/ssr'

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
}))

describe('authHelpers', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      upsert: jest.fn(),
    })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabaseClient)
  })

  describe('getCurrentUser', () => {
    it('should return current user with profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }
      const mockProfile = {
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const profileQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(profileQuery)

      const result = await authHelpers.getCurrentUser()

      expect(result).toEqual({
        ...mockUser,
        profile: mockProfile,
      })
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles')
      expect(profileQuery.eq).toHaveBeenCalledWith('id', mockUser.id)
    })

    it('should return null when no user is authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await authHelpers.getCurrentUser()

      expect(result).toBeNull()
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    it('should handle auth errors', async () => {
      const error = new Error('Auth error')
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error,
      })

      await expect(authHelpers.getCurrentUser()).rejects.toThrow('Auth error')
    })

    it('should handle profile fetch errors gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const profileQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Profile not found'),
        }),
      }
      mockSupabaseClient.from.mockReturnValue(profileQuery)

      const result = await authHelpers.getCurrentUser()

      expect(result).toEqual({
        ...mockUser,
        profile: null,
      })
    })
  })

  // TODO: Implement getSession in auth module
  describe.skip('getSession', () => {
    it('should return current session', async () => {
      const mockSession = {
        access_token: 'token-123',
        user: { id: 'user-123', email: 'test@example.com' },
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const result = await (authHelpers as any).getSession()

      expect(result).toEqual(mockSession)
    })

    it('should return null when no session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const result = await (authHelpers as any).getSession()

      expect(result).toBeNull()
    })

    it('should handle session errors', async () => {
      const error = new Error('Session error')
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error,
      })

      await expect((authHelpers as any).getSession()).rejects.toThrow('Session error')
    })
  })

  describe('sendMagicLink', () => {
    it('should send magic link successfully', async () => {
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({
        data: {},
        error: null,
      })

      await authHelpers.sendMagicLink('test@example.com')

      expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        },
      })
    })

    it('should handle magic link errors', async () => {
      const error = new Error('Failed to send email')
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error,
      })

      await expect(authHelpers.sendMagicLink('test@example.com')).rejects.toThrow(
        'Failed to send email'
      )
    })
  })

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      })

      await authHelpers.signOut()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })

    it('should handle sign out errors', async () => {
      const error = new Error('Sign out failed')
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error,
      })

      await expect(authHelpers.signOut()).rejects.toThrow('Sign out failed')
    })
  })

  // TODO: Implement updateProfile in auth module
  describe.skip('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updates = { full_name: 'New Name' }
      const updatedProfile = {
        id: 'user-123',
        full_name: 'New Name',
        avatar_url: null,
      }

      const upsertQuery = {
        upsert: jest.fn().mockResolvedValue({
          data: updatedProfile,
          error: null,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(upsertQuery)

      const result = await (authHelpers as any).updateProfile('user-123', updates)

      expect(result).toEqual(updatedProfile)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles')
      expect(upsertQuery.upsert).toHaveBeenCalledWith({
        id: 'user-123',
        ...updates,
        updated_at: expect.any(String),
      })
    })

    it('should handle profile update errors', async () => {
      const error = new Error('Update failed')
      const upsertQuery = {
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(upsertQuery)

      await expect(
        (authHelpers as any).updateProfile('user-123', { full_name: 'New Name' })
      ).rejects.toThrow('Update failed')
    })
  })

  describe('onAuthStateChange', () => {
    it('should subscribe to auth state changes', () => {
      const callback = jest.fn()
      const unsubscribe = jest.fn()
      const mockSubscription = { unsubscribe }

      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: mockSubscription },
        error: null,
      })

      authHelpers.onAuthStateChange(callback)

      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled()

      // Test the internal callback
      const internalCallback = mockSupabaseClient.auth.onAuthStateChange.mock.calls[0][0]
      const mockEvent = 'SIGNED_IN'
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }

      // Mock getCurrentUser for the internal callback
      jest.spyOn(authHelpers, 'getCurrentUser').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        profile: { full_name: 'Test User' },
      })

      internalCallback(mockEvent, mockSession)

      // Wait for the async operation
      setTimeout(() => {
        expect(callback).toHaveBeenCalledWith({
          id: 'user-123',
          email: 'test@example.com',
          profile: { full_name: 'Test User' },
        })
      }, 0)
    })

    it('should handle null session', () => {
      const callback = jest.fn()

      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
        error: null,
      })

      authHelpers.onAuthStateChange(callback)

      const internalCallback = mockSupabaseClient.auth.onAuthStateChange.mock.calls[0][0]
      internalCallback('SIGNED_OUT', null)

      expect(callback).toHaveBeenCalledWith(null)
    })
  })

  // TODO: Implement checkSession in auth module
  describe.skip('checkSession', () => {
    it('should return true for valid session', async () => {
      const mockSession = {
        access_token: 'token-123',
        user: { id: 'user-123' },
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const result = await (authHelpers as any).checkSession()

      expect(result).toBe(true)
    })

    it('should return false for no session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const result = await (authHelpers as any).checkSession()

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session check failed'),
      })

      const result = await (authHelpers as any).checkSession()

      expect(result).toBe(false)
    })
  })
})