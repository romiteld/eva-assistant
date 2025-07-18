'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  copied: boolean;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorCount: (prevState?.errorCount || 0) + 1
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Update state with error details
    this.setState({
      errorInfo
    });

    // Log to error reporting service
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // TODO: Send to error tracking service like Sentry
      console.error('Production error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  copyErrorDetails = () => {
    const { error, errorInfo } = this.state;
    
    const details = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
    `.trim();
    
    navigator.clipboard.writeText(details);
    this.setState({ copied: true });
    
    setTimeout(() => {
      this.setState({ copied: false });
    }, 2000);
  };

  render() {
    const { hasError, error, errorInfo, errorCount, copied } = this.state;
    const { children, fallback, showDetails = true, className } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';
      const isNetworkError = error.message.toLowerCase().includes('network') || 
                           error.message.toLowerCase().includes('fetch');
      const isChunkError = error.message.toLowerCase().includes('chunk') ||
                          error.message.toLowerCase().includes('module');

      return (
        <div className={cn(
          'min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900',
          className
        )}>
          <Card className="max-w-2xl w-full shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Oops! Something went wrong
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isNetworkError ? (
                  "We're having trouble connecting to our servers. Please check your internet connection and try again."
                ) : isChunkError ? (
                  "The application needs to be refreshed to load the latest version."
                ) : (
                  "An unexpected error occurred. Our team has been notified and is working on a fix."
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error summary */}
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                <Bug className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Error: </span>
                  {error.message}
                </AlertDescription>
              </Alert>

              {/* Error details (dev mode or if enabled) */}
              {(isDevelopment || showDetails) && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                    Show technical details
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-auto max-h-64">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                    {errorInfo?.componentStack && (
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-auto max-h-64">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Component Stack:
                        </p>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Error frequency warning */}
              {errorCount > 2 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This error has occurred {errorCount} times. If the problem persists, 
                    please contact support.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleReset}
                className="w-full sm:w-auto"
                variant="default"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              
              <Button
                onClick={this.handleReload}
                className="w-full sm:w-auto"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              
              <Button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto"
                variant="outline"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
              
              {(isDevelopment || showDetails) && (
                <Button
                  onClick={this.copyErrorDetails}
                  className="w-full sm:w-auto"
                  variant="ghost"
                  size="sm"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Details
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// HOC for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}