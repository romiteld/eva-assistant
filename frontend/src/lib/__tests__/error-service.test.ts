import { errorService, ErrorLevel, ErrorCategory } from '../error-service'
import { createBrowserClient } from '@supabase/ssr'

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
}))

// Mock console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

describe('ErrorService', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
    console.warn = jest.fn()

    mockSupabaseClient = {
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabaseClient)

    // Reset error service state
    errorService.clearErrors()
  })

  afterEach(() => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
  })

  describe('logError', () => {
    it('should log error with default values', async () => {
      const error = new Error('Test error')
      
      await errorService.logError(error)

      expect(console.error).toHaveBeenCalledWith('[ERROR]', error)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('error_logs')
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
        level: ErrorLevel.ERROR,
        category: ErrorCategory.GENERAL,
        message: 'Test error',
        stack: expect.any(String),
        metadata: {},
        user_agent: expect.any(String),
        url: expect.any(String),
        timestamp: expect.any(String),
      })
    })

    it('should log error with custom parameters', async () => {
      const error = new Error('Custom error')
      const metadata = { userId: 'test-user', action: 'test-action' }
      
      await errorService.logError(
        error,
        ErrorLevel.WARNING,
        ErrorCategory.AUTH,
        metadata
      )

      expect(console.warn).toHaveBeenCalledWith('[WARNING]', error)
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          level: ErrorLevel.WARNING,
          category: ErrorCategory.AUTH,
          message: 'Custom error',
          metadata,
        })
      )
    })

    it('should handle non-Error objects', async () => {
      const errorString = 'String error'
      
      await errorService.logError(errorString)

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String error',
          stack: null,
        })
      )
    })

    it('should handle database logging failure gracefully', async () => {
      const dbError = new Error('Database error')
      mockSupabaseClient.from().insert.mockRejectedValue(dbError)
      
      const error = new Error('Test error')
      await errorService.logError(error)

      expect(console.error).toHaveBeenCalledWith('Failed to log error to database:', dbError)
    })

    it('should not log to database in development for info level', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      await errorService.logError('Info message', ErrorLevel.INFO)

      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
      
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('getRecentErrors', () => {
    it('should return recent errors', () => {
      const error1 = new Error('Error 1')
      const error2 = new Error('Error 2')
      
      errorService.logError(error1)
      errorService.logError(error2)
      
      const recentErrors = errorService.getRecentErrors()
      
      expect(recentErrors).toHaveLength(2)
      expect(recentErrors[0].message).toBe('Error 1')
      expect(recentErrors[1].message).toBe('Error 2')
    })

    it('should limit errors to maxErrors', () => {
      // Log more than 100 errors
      for (let i = 0; i < 150; i++) {
        errorService.logError(`Error ${i}`)
      }
      
      const recentErrors = errorService.getRecentErrors()
      
      expect(recentErrors).toHaveLength(100)
      expect(recentErrors[0].message).toBe('Error 50') // Oldest kept error
      expect(recentErrors[99].message).toBe('Error 149') // Newest error
    })

    it('should filter by level', () => {
      errorService.logError('Error 1', ErrorLevel.ERROR)
      errorService.logError('Warning 1', ErrorLevel.WARNING)
      errorService.logError('Info 1', ErrorLevel.INFO)
      
      const errors = errorService.getRecentErrors(10, ErrorLevel.ERROR)
      const warnings = errorService.getRecentErrors(10, ErrorLevel.WARNING)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Error 1')
      
      expect(warnings).toHaveLength(1)
      expect(warnings[0].message).toBe('Warning 1')
    })

    it('should filter by category', () => {
      errorService.logError('Auth error', ErrorLevel.ERROR, ErrorCategory.AUTH)
      errorService.logError('API error', ErrorLevel.ERROR, ErrorCategory.API)
      errorService.logError('General error', ErrorLevel.ERROR, ErrorCategory.GENERAL)
      
      const authErrors = errorService.getRecentErrors(10, undefined, ErrorCategory.AUTH)
      
      expect(authErrors).toHaveLength(1)
      expect(authErrors[0].message).toBe('Auth error')
    })
  })

  describe('clearErrors', () => {
    it('should clear all stored errors', () => {
      errorService.logError('Error 1')
      errorService.logError('Error 2')
      
      expect(errorService.getRecentErrors()).toHaveLength(2)
      
      errorService.clearErrors()
      
      expect(errorService.getRecentErrors()).toHaveLength(0)
    })
  })

  describe('formatError', () => {
    it('should format Error objects correctly', () => {
      const error = new Error('Test error')
      const formatted = errorService.formatError(error)
      
      expect(formatted).toEqual({
        message: 'Test error',
        stack: expect.stringContaining('Error: Test error'),
        type: 'Error',
      })
    })

    it('should format string errors', () => {
      const formatted = errorService.formatError('String error')
      
      expect(formatted).toEqual({
        message: 'String error',
        stack: null,
        type: 'string',
      })
    })

    it('should format object errors', () => {
      const errorObj = { code: 'ERR_001', description: 'Custom error' }
      const formatted = errorService.formatError(errorObj)
      
      expect(formatted).toEqual({
        message: JSON.stringify(errorObj),
        stack: null,
        type: 'object',
      })
    })

    it('should handle null/undefined errors', () => {
      const formattedNull = errorService.formatError(null)
      const formattedUndefined = errorService.formatError(undefined)
      
      expect(formattedNull).toEqual({
        message: 'Unknown error',
        stack: null,
        type: 'unknown',
      })
      
      expect(formattedUndefined).toEqual({
        message: 'Unknown error',
        stack: null,
        type: 'unknown',
      })
    })
  })

  describe('subscribe/unsubscribe', () => {
    it('should notify subscribers of new errors', () => {
      const callback = jest.fn()
      
      errorService.subscribe(callback)
      errorService.logError('Test error')
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          level: ErrorLevel.ERROR,
        })
      )
    })

    it('should support multiple subscribers', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()
      
      errorService.subscribe(callback1)
      errorService.subscribe(callback2)
      
      errorService.logError('Test error')
      
      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })

    it('should unsubscribe correctly', () => {
      const callback = jest.fn()
      
      const unsubscribe = errorService.subscribe(callback)
      errorService.logError('Error 1')
      
      expect(callback).toHaveBeenCalledTimes(1)
      
      unsubscribe()
      errorService.logError('Error 2')
      
      expect(callback).toHaveBeenCalledTimes(1) // Should not be called again
    })
  })

  describe('getErrorStats', () => {
    it('should return error statistics', () => {
      errorService.logError('Error 1', ErrorLevel.ERROR, ErrorCategory.API)
      errorService.logError('Error 2', ErrorLevel.ERROR, ErrorCategory.API)
      errorService.logError('Warning 1', ErrorLevel.WARNING, ErrorCategory.AUTH)
      errorService.logError('Info 1', ErrorLevel.INFO, ErrorCategory.GENERAL)
      
      const stats = errorService.getErrorStats()
      
      expect(stats).toEqual({
        total: 4,
        byLevel: {
          [ErrorLevel.ERROR]: 2,
          [ErrorLevel.WARNING]: 1,
          [ErrorLevel.INFO]: 1,
          [ErrorLevel.DEBUG]: 0,
        },
        byCategory: {
          [ErrorCategory.API]: 2,
          [ErrorCategory.AUTH]: 1,
          [ErrorCategory.GENERAL]: 1,
          [ErrorCategory.DATABASE]: 0,
          [ErrorCategory.VALIDATION]: 0,
          [ErrorCategory.NETWORK]: 0,
        },
      })
    })
  })

  describe('isRateLimited', () => {
    it('should rate limit repeated errors', async () => {
      const error = new Error('Repeated error')
      
      // First error should not be rate limited
      expect(errorService.isRateLimited(error.message)).toBe(false)
      await errorService.logError(error)
      
      // Immediate repeat should be rate limited
      expect(errorService.isRateLimited(error.message)).toBe(true)
      
      // Different error should not be rate limited
      expect(errorService.isRateLimited('Different error')).toBe(false)
    })

    it('should allow error after rate limit window', async () => {
      jest.useFakeTimers()
      
      const error = new Error('Rate limited error')
      
      await errorService.logError(error)
      expect(errorService.isRateLimited(error.message)).toBe(true)
      
      // Advance time past rate limit window (5 minutes)
      jest.advanceTimersByTime(6 * 60 * 1000)
      
      expect(errorService.isRateLimited(error.message)).toBe(false)
      
      jest.useRealTimers()
    })
  })
})