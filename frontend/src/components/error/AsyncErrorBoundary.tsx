'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { errorService, ErrorCategory, ErrorSeverity } from '@/lib/error-service'

interface Props {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error) => void
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
}

interface State {
  hasError: boolean
  error: Error | null
  isRetrying: boolean
  retryCount: number
  errorId: string | null
}

class AsyncErrorBoundary extends Component<Props, State> {
  private maxRetries = 2
  private retryTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      isRetrying: false,
      retryCount: 0,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AsyncErrorBoundary caught error:', error, errorInfo)
    
    // Determine error category based on error type
    let category = ErrorCategory.UI
    if (error.message.includes('fetch') || error.message.includes('network')) {
      category = ErrorCategory.NETWORK
    } else if (error.message.includes('async') || error.message.includes('promise')) {
      category = ErrorCategory.API
    }

    // Log error to our service
    const errorId = await errorService.logError(
      error,
      category,
      ErrorSeverity.MEDIUM,
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'AsyncErrorBoundary',
        retryCount: this.state.retryCount,
        asyncOperation: true,
        timestamp: new Date().toISOString()
      }
    )

    this.setState({ errorId })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props
    
    if (resetOnPropsChange && this.state.hasError) {
      // Reset error state when props change
      this.setState({
        hasError: false,
        error: null,
        isRetrying: false,
        retryCount: 0,
        errorId: null
      })
    }

    if (resetKeys && this.state.hasError) {
      // Reset error state when reset keys change
      const prevResetKeys = prevProps.resetKeys || []
      const hasResetKeyChanged = resetKeys.some((key, index) => 
        key !== prevResetKeys[index]
      )

      if (hasResetKeyChanged) {
        this.setState({
          hasError: false,
          error: null,
          isRetrying: false,
          retryCount: 0,
          errorId: null
        })
      }
    }
  }

  handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      return
    }

    this.setState({ isRetrying: true })
    
    // Clear the timeout if it exists
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }

    this.retryTimeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        isRetrying: false,
        retryCount: this.state.retryCount + 1,
        errorId: null
      })
    }, 1500)
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry)
      }

      const canRetry = this.state.retryCount < this.maxRetries

      return (
        <div className="flex items-center justify-center min-h-[200px] p-4">
          <div className="max-w-sm w-full bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 text-center">
            <div className="flex items-center justify-center w-10 h-10 mx-auto bg-orange-900/20 rounded-full mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-100 mb-2">
              Operation Failed
            </h3>
            
            <p className="text-sm text-gray-400 mb-4">
              {this.state.error.message || 'An unexpected error occurred during an async operation.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.errorId && (
              <p className="text-xs text-gray-500 mb-4">
                Error ID: {this.state.errorId}
              </p>
            )}

            {canRetry && (
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {this.state.isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Try Again ({this.maxRetries - this.state.retryCount} left)
                  </>
                )}
              </button>
            )}

            {!canRetry && (
              <div className="text-sm text-gray-500">
                Multiple attempts failed. Please check your connection and refresh the page.
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AsyncErrorBoundary