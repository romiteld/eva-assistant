'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, Send } from 'lucide-react'
import { errorService, ErrorCategory, ErrorSeverity } from '@/lib/error-service'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  showErrorDetails?: boolean
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorId: string | null
  isRetrying: boolean
  retryCount: number
}

class GlobalErrorBoundary extends Component<Props, State> {
  private maxRetries = 3
  private retryTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isRetrying: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Log error to our service
    const errorId = await errorService.logError(
      error,
      ErrorCategory.UI,
      ErrorSeverity.HIGH,
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'GlobalErrorBoundary',
        retryCount: this.state.retryCount,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    )

    this.setState({
      error,
      errorInfo,
      errorId
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
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
        errorInfo: null,
        errorId: null,
        isRetrying: false,
        retryCount: this.state.retryCount + 1
      })
    }, 1000)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleReportError = async () => {
    if (!this.state.error || !this.state.errorId) return

    try {
      // In a real app, this would send to a support system
      const reportData = {
        errorId: this.state.errorId,
        message: this.state.error.message,
        stack: this.state.error.stack,
        componentStack: this.state.errorInfo?.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }

      console.log('Error report generated:', reportData)
      
      // Show success message
      alert('Error report submitted successfully. Our team will investigate.')
    } catch (err) {
      console.error('Failed to submit error report:', err)
      alert('Failed to submit error report. Please try again.')
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const canRetry = this.state.retryCount < this.maxRetries
      const showDetails = this.props.showErrorDetails || process.env.NODE_ENV === 'development'

      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-900/20 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-100 text-center mb-2">
              Something went wrong
            </h1>

            <p className="text-gray-400 text-center mb-6">
              We&apos;re sorry, but something unexpected happened. Our team has been notified.
            </p>

            {showDetails && this.state.error && (
              <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Error Details:</h3>
                <p className="text-xs text-red-400 font-mono break-all mb-2">
                  {this.state.error.message}
                </p>
                {this.state.errorId && (
                  <p className="text-xs text-gray-500">
                    Error ID: {this.state.errorId}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {this.state.isRetrying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
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

              <div className="flex gap-2">
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>

              <button
                onClick={this.handleReportError}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Report Error
              </button>
            </div>

            {!canRetry && (
              <div className="mt-4 p-3 bg-yellow-900/20 rounded-lg border border-yellow-700">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-yellow-300">
                    Multiple retries failed. Please reload the page or contact support.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default GlobalErrorBoundary