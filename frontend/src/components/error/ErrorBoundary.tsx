'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react'
import { errorService, ErrorCategory, ErrorSeverity, ErrorService } from '@/lib/error-service'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const category = ErrorService.categorizeError(error)
    
    // Log to error service
    errorService.logError(error, category, ErrorSeverity.HIGH, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      errorId: this.state.errorId
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
          <div className="max-w-md w-full bg-gray-900 rounded-lg shadow-xl p-6 border border-gray-800">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-900/20 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            
            <h1 className="text-xl font-semibold text-center text-gray-100 mb-2">
              Something went wrong
            </h1>
            
            <p className="text-gray-400 text-center mb-6">
              We apologize for the inconvenience. The error has been logged and our team will look into it.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6">
                <details className="bg-gray-800 rounded p-3">
                  <summary className="cursor-pointer text-sm text-gray-300 hover:text-gray-100">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-400">
                      <span className="font-semibold">Error ID:</span> {this.state.errorId}
                    </p>
                    <p className="text-xs text-red-400 font-mono">
                      {this.state.error.toString()}
                    </p>
                    {this.state.error.stack && (
                      <pre className="text-xs text-gray-500 overflow-auto max-h-40 mt-2">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-gray-100 rounded-md hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-gray-100 rounded-md hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs text-gray-500 text-center">
                If this problem persists, please{' '}
                <a
                  href="mailto:support@thewellrecruiting.com"
                  className="text-primary-500 hover:text-primary-400 underline"
                >
                  contact support
                </a>
                {' '}with error ID: {this.state.errorId}
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}