import { createClient } from '@/lib/supabase/browser'
import { metricsCollector } from '@/lib/monitoring/metrics'

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
  id?: string
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

export interface ErrorStats {
  total: number
  bySeverity: Record<ErrorSeverity, number>
  byCategory: Record<ErrorCategory, number>
  recent: ErrorDetails[]
  trends: {
    hourly: number[]
    daily: number[]
  }
}

interface ErrorLogRow {
  id: string
  message: string
  category: string
  severity: string
  context?: Record<string, any>
  stack?: string
  created_at: string
  user_id?: string
  session_id?: string
  user_agent?: string
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
      id: crypto.randomUUID(),
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

    // Persist to database (all errors, not just critical)
    if (this.supabase) {
      await this.persistError(errorDetails)
    }

    // Collect metrics for performance tracking
    metricsCollector.collectMetric({
      name: 'error_count',
      value: 1,
      unit: 'count',
      tags: {
        category: errorDetails.category,
        severity: errorDetails.severity,
        userId: errorDetails.userId || 'anonymous'
      }
    })

    // Trigger alerts for high severity errors
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      await this.triggerAlert(errorDetails)
    }

    return errorDetails.id
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
      const { error } = await this.supabase
        .from('error_logs')
        .insert({
          id: errorDetails.id,
          message: errorDetails.message,
          category: errorDetails.category,
          severity: errorDetails.severity,
          context: errorDetails.context,
          stack: errorDetails.stack,
          user_id: errorDetails.userId,
          session_id: errorDetails.sessionId,
          user_agent: errorDetails.userAgent,
          url: errorDetails.url,
          created_at: errorDetails.timestamp.toISOString()
        })
      
      if (error) {
        console.error('Supabase error when persisting error:', error)
      }
    } catch (err) {
      console.error('Failed to persist error:', err)
    }
  }

  private async triggerAlert(errorDetails: ErrorDetails) {
    try {
      // Check if we should trigger an alert based on error frequency
      const recentErrors = this.errors.filter(e => 
        e.category === errorDetails.category &&
        e.severity === errorDetails.severity &&
        Date.now() - e.timestamp.getTime() < 300000 // Last 5 minutes
      )

      if (recentErrors.length >= 3) {
        // Send alert notification
        await this.sendAlert(errorDetails, recentErrors.length)
      }
    } catch (err) {
      console.error('Failed to trigger alert:', err)
    }
  }

  private async sendAlert(errorDetails: ErrorDetails, errorCount: number) {
    try {
      // In production, this would integrate with notification services
      // For now, we'll just log the alert
      console.warn(`🚨 ALERT: ${errorCount} ${errorDetails.severity} ${errorDetails.category} errors in the last 5 minutes`)
      
      // Store alert in database
      await this.supabase
        .from('alert_history')
        .insert({
          alert_data: {
            error_category: errorDetails.category,
            error_severity: errorDetails.severity,
            error_count: errorCount,
            error_message: errorDetails.message,
            user_id: errorDetails.userId,
            session_id: errorDetails.sessionId
          },
          triggered_at: new Date().toISOString(),
          notification_sent: true
        })
    } catch (err) {
      console.error('Failed to send alert:', err)
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

  async getErrorStats(timeWindow: number = 3600000): Promise<ErrorStats> {
    const now = Date.now()
    const recentErrors = this.errors.filter(e => 
      now - e.timestamp.getTime() < timeWindow
    )

    const stats: ErrorStats = {
      total: recentErrors.length,
      bySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      byCategory: {
        [ErrorCategory.AUTH]: 0,
        [ErrorCategory.API]: 0,
        [ErrorCategory.DATABASE]: 0,
        [ErrorCategory.UI]: 0,
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.VALIDATION]: 0,
        [ErrorCategory.UNKNOWN]: 0
      },
      recent: recentErrors.slice(0, 20),
      trends: {
        hourly: [],
        daily: []
      }
    }

    // Count by severity and category
    recentErrors.forEach(error => {
      stats.bySeverity[error.severity]++
      stats.byCategory[error.category]++
    })

    // Generate hourly trends (last 24 hours)
    for (let i = 0; i < 24; i++) {
      const hourStart = now - (i * 3600000)
      const hourEnd = hourStart + 3600000
      const hourErrors = this.errors.filter(e => 
        e.timestamp.getTime() >= hourStart && e.timestamp.getTime() < hourEnd
      )
      stats.trends.hourly.unshift(hourErrors.length)
    }

    // Generate daily trends (last 7 days)
    for (let i = 0; i < 7; i++) {
      const dayStart = now - (i * 86400000)
      const dayEnd = dayStart + 86400000
      const dayErrors = this.errors.filter(e => 
        e.timestamp.getTime() >= dayStart && e.timestamp.getTime() < dayEnd
      )
      stats.trends.daily.unshift(dayErrors.length)
    }

    return stats
  }

  async getErrorsFromDatabase(
    limit: number = 100,
    category?: ErrorCategory,
    severity?: ErrorSeverity
  ): Promise<ErrorDetails[]> {
    try {
      let query = this.supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (category) {
        query = query.eq('category', category)
      }

      if (severity) {
        query = query.eq('severity', severity)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching from database:', error)
        return []
      }

      return data?.map((row: ErrorLogRow) => ({
        id: row.id,
        message: row.message,
        category: row.category as ErrorCategory,
        severity: row.severity as ErrorSeverity,
        context: row.context,
        stack: row.stack,
        timestamp: new Date(row.created_at),
        userId: row.user_id,
        sessionId: row.session_id,
        userAgent: row.user_agent,
        url: row.url
      })) || []
    } catch (err) {
      console.error('Failed to fetch errors from database:', err)
      return []
    }
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