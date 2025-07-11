import { createClient } from '@/lib/supabase/browser'

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Alias for backwards compatibility
export const ErrorLevel = ErrorSeverity

export enum ErrorCategory {
  AUTH = 'auth',
  API = 'api',
  DATABASE = 'database',
  UI = 'ui',
  NETWORK = 'network',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

export interface ErrorDetails {
  message: string
  category: ErrorCategory
  severity: ErrorSeverity
  context?: Record<string, any>
  stack?: string
  timestamp: Date
  userId?: string
  sessionId?: string
  userAgent?: string
  url?: string
}

class ErrorService {
  private static instance: ErrorService
  private errors: ErrorDetails[] = []
  private maxErrorsInMemory = 100
  private supabase: any

  private constructor() {
    // Initialize Supabase client for error persistence
    this.supabase = createClient()
  }

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService()
    }
    return ErrorService.instance
  }

  async logError(error: Error | unknown, category: ErrorCategory = ErrorCategory.UNKNOWN, severity: ErrorSeverity = ErrorSeverity.MEDIUM, context?: Record<string, any>) {
    const errorDetails: ErrorDetails = {
      message: error instanceof Error ? error.message : String(error),
      category,
      severity,
      context,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date(),
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    }

    // Store in memory
    this.errors.unshift(errorDetails)
    if (this.errors.length > this.maxErrorsInMemory) {
      this.errors = this.errors.slice(0, this.maxErrorsInMemory)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorService]', errorDetails)
    }

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      await this.sendToMonitoring(errorDetails)
    }

    // Persist critical errors to database
    if (severity === ErrorSeverity.CRITICAL && this.supabase) {
      await this.persistError(errorDetails)
    }
  }

  private async sendToMonitoring(errorDetails: ErrorDetails) {
    // This would integrate with services like Sentry, LogRocket, etc.
    try {
      // Example: Send to monitoring endpoint
      if (process.env.NEXT_PUBLIC_ERROR_MONITORING_ENDPOINT) {
        await fetch(process.env.NEXT_PUBLIC_ERROR_MONITORING_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorDetails)
        })
      }
    } catch (err) {
      console.error('Failed to send error to monitoring:', err)
    }
  }

  private async persistError(errorDetails: ErrorDetails) {
    try {
      await this.supabase
        .from('error_logs')
        .insert({
          message: errorDetails.message,
          category: errorDetails.category,
          severity: errorDetails.severity,
          context: errorDetails.context,
          stack: errorDetails.stack,
          user_id: errorDetails.userId,
          session_id: errorDetails.sessionId,
          user_agent: errorDetails.userAgent,
          url: errorDetails.url,
          created_at: errorDetails.timestamp
        })
    } catch (err) {
      console.error('Failed to persist error:', err)
    }
  }

  private getCurrentUserId(): string | undefined {
    // Get from auth context or localStorage
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('supabase.auth.token')
      if (session) {
        try {
          const parsed = JSON.parse(session)
          return parsed?.currentSession?.user?.id
        } catch {}
      }
    }
    return undefined
  }

  private getSessionId(): string {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('eva_session_id')
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('eva_session_id', sessionId)
      }
      return sessionId
    }
    return 'server_session'
  }

  getRecentErrors(category?: ErrorCategory): ErrorDetails[] {
    if (category) {
      return this.errors.filter(e => e.category === category)
    }
    return this.errors
  }

  clearErrors() {
    this.errors = []
  }

  // Helper method to determine error category from error
  static categorizeError(error: Error | unknown): ErrorCategory {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorCategory.AUTH
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ErrorCategory.NETWORK
    }
    if (message.includes('database') || message.includes('supabase') || message.includes('sql')) {
      return ErrorCategory.DATABASE
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION
    }
    if (message.includes('api') || message.includes('endpoint')) {
      return ErrorCategory.API
    }
    
    return ErrorCategory.UNKNOWN
  }

  // Helper to create user-friendly error messages
  static getUserFriendlyMessage(error: Error | unknown, category: ErrorCategory): string {
    const defaultMessages: Record<ErrorCategory, string> = {
      [ErrorCategory.AUTH]: 'Authentication error. Please try logging in again.',
      [ErrorCategory.API]: 'Unable to connect to the server. Please try again later.',
      [ErrorCategory.DATABASE]: 'Database error. Our team has been notified.',
      [ErrorCategory.UI]: 'Something went wrong with the display. Please refresh the page.',
      [ErrorCategory.NETWORK]: 'Network connection error. Please check your internet connection.',
      [ErrorCategory.VALIDATION]: 'Please check your input and try again.',
      [ErrorCategory.UNKNOWN]: 'An unexpected error occurred. Please try again.'
    }

    // Check for specific error messages
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return 'Too many requests. Please wait a moment and try again.'
      }
      if (error.message.includes('not found')) {
        return 'The requested resource was not found.'
      }
      if (error.message.includes('expired')) {
        return 'Your session has expired. Please log in again.'
      }
    }

    return defaultMessages[category]
  }
}

export const errorService = ErrorService.getInstance()
export { ErrorService }