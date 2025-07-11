import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth, useRequireAuth } from '../useAuth'
import { authHelpers } from '@/lib/supabase/auth'
import { useRouter } from 'next/navigation'
import type { MockRouter, MockUser } from '@/types/jest-helpers'

// Mock the auth helpers
jest.mock('@/lib/supabase/auth', () => ({
  authHelpers: {
    getCurrentUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    sendMagicLink: jest.fn(),
    signOut: jest.fn(),
    updateProfile: jest.fn(),
  },
}))

// Mock the router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('useAuth', () => {
  const mockUser: MockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    profile: {
      full_name: 'Test User',
      avatar_url: null,
    },
  }

  const mockRouter: MockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  it('should initialize with loading state', async () => {
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBe(null)
    expect(result.current.isAuthenticated).toBe(false)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('should load authenticated user on mount', async () => {
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  it('should handle auth errors gracefully', async () => {
    const error = new Error('Auth failed')
    ;(authHelpers.getCurrentUser as jest.Mock).mockRejectedValue(error)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Auth failed')
      expect(result.current.user).toBe(null)
    })
  })

  it('should handle sign in', async () => {
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(authHelpers.sendMagicLink as jest.Mock).mockResolvedValue(undefined)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let signInResult: any
    await act(async () => {
      signInResult = await result.current.signIn('test@example.com')
    })

    expect(authHelpers.sendMagicLink).toHaveBeenCalledWith('test@example.com')
    expect(signInResult).toEqual({ success: true })
  })

  it('should handle sign in errors', async () => {
    const error = new Error('Sign in failed')
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(authHelpers.sendMagicLink as jest.Mock).mockRejectedValue(error)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let signInResult: any
    await act(async () => {
      signInResult = await result.current.signIn('test@example.com')
    })

    expect(signInResult).toEqual({ success: false, error: 'Sign in failed' })
    expect(result.current.error).toBe('Sign in failed')
  })

  it('should handle sign out', async () => {
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    ;(authHelpers.signOut as jest.Mock).mockResolvedValue(undefined)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      await result.current.signOut()
    })

    expect(authHelpers.signOut).toHaveBeenCalled()
    expect(result.current.user).toBe(null)
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('should handle profile updates', async () => {
    const updatedProfile = { ...mockUser.profile, full_name: 'Updated Name' }
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    ;(authHelpers.updateProfile as jest.Mock).mockResolvedValue(updatedProfile)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    let updateResult: any
    await act(async () => {
      updateResult = await result.current.updateProfile({ full_name: 'Updated Name' })
    })

    expect(authHelpers.updateProfile).toHaveBeenCalledWith(mockUser.id, {
      full_name: 'Updated Name',
    })
    expect(updateResult).toEqual({ success: true })
    expect(result.current.user?.profile).toEqual(updatedProfile)
  })

  it('should subscribe to auth state changes', async () => {
    const unsubscribe = jest.fn()
    const authCallback = jest.fn()
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      authCallback.mockImplementation(callback)
      return {
        data: { subscription: { unsubscribe } },
      }
    })

    const { result, unmount } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Simulate auth state change
    act(() => {
      authCallback(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)

    // Cleanup
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('useRequireAuth', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  it('should redirect to login when not authenticated', async () => {
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useRequireAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('should not redirect when authenticated', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      profile: {},
    }

    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useRequireAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(result.current.user).toEqual(mockUser)
  })

  it('should redirect to custom path', async () => {
    ;(authHelpers.getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(authHelpers.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useRequireAuth('/custom-login'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockRouter.push).toHaveBeenCalledWith('/custom-login')
  })
})