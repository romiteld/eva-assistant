import { useCallback } from 'react'
import { useToast } from './use-toast'
import { errorService, ErrorCategory, ErrorSeverity, ErrorService } from '@/lib/error-service'

interface ErrorOptions {
  showToast?: boolean
  severity?: ErrorSeverity
  category?: ErrorCategory
  context?: Record<string, any>
  fallbackMessage?: string
}

export function useErrorHandler() {
  const { toast } = useToast()
  
  const handleError = useCallback((
    error: Error | unknown,
    options: ErrorOptions = {}
  ) => {
    const {
      showToast = true,
      severity = ErrorSeverity.MEDIUM,
      category = ErrorService.categorizeError(error),
      context,
      fallbackMessage
    } = options

    // Log to error service
    errorService.logError(error, category, severity, context)

    // Show user-friendly message
    if (showToast) {
      const message = fallbackMessage || ErrorService.getUserFriendlyMessage(error, category)
      
      switch (severity) {
        case ErrorSeverity.CRITICAL:
        case ErrorSeverity.HIGH:
          toast({
            title: message,
            variant: 'destructive',
            duration: 6000
          })
          break
        case ErrorSeverity.MEDIUM:
          toast({
            title: message,
            variant: 'destructive',
            duration: 4000
          })
          break
        case ErrorSeverity.LOW:
          toast({
            title: message,
            duration: 3000
          })
          break
      }
    }

    // Return the error for further handling if needed
    return error
  }, [toast])

  const handleAsyncError = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    options: ErrorOptions = {}
  ): Promise<T | undefined> => {
    try {
      return await asyncFn()
    } catch (error) {
      handleError(error, options)
      return undefined
    }
  }, [handleError])

  const createErrorHandler = useCallback((
    defaultOptions: ErrorOptions = {}
  ) => {
    return (error: Error | unknown, overrideOptions?: ErrorOptions) => {
      handleError(error, { ...defaultOptions, ...overrideOptions })
    }
  }, [handleError])

  return {
    handleError,
    handleAsyncError,
    createErrorHandler
  }
}