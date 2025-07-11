'use client'

import React, { useState } from 'react'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { ErrorCategory, ErrorSeverity } from '@/lib/error-service'
import { DashboardErrorBoundary } from '@/components/error/DashboardErrorBoundary'
import { ChatErrorBoundary } from '@/components/error/ChatErrorBoundary'
import { ErrorNotification } from '@/components/error/ErrorNotification'
import { ErrorRecovery } from '@/components/error/ErrorRecovery'
import { RefreshCw } from 'lucide-react'

// Example component showing various error handling patterns
export function ErrorHandlingExample() {
  const { handleError, handleAsyncError, createErrorHandler } = useErrorHandler()
  const [showNotification, setShowNotification] = useState(false)
  const [lastError, setLastError] = useState<ErrorCategory | null>(null)

  // Example 1: Basic error handling with toast
  const handleBasicError = () => {
    try {
      throw new Error('This is a basic error example')
    } catch (error) {
      handleError(error, {
        showToast: true,
        severity: ErrorSeverity.MEDIUM,
        context: { component: 'ErrorHandlingExample', action: 'basicError' }
      })
    }
  }

  // Example 2: Async error handling
  const handleAsyncOperation = async () => {
    await handleAsyncError(
      async () => {
        // Simulate API call that fails
        const response = await fetch('/api/nonexistent')
        if (!response.ok) {
          throw new Error('API request failed')
        }
        return response.json()
      },
      {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        fallbackMessage: 'Failed to fetch data from the server'
      }
    )
  }

  // Example 3: Custom error handler for a specific feature
  const authErrorHandler = createErrorHandler({
    category: ErrorCategory.AUTH,
    severity: ErrorSeverity.HIGH,
    showToast: true,
    context: { feature: 'authentication' }
  })

  const handleAuthError = () => {
    try {
      throw new Error('Invalid authentication token')
    } catch (error) {
      authErrorHandler(error)
      setLastError(ErrorCategory.AUTH)
      setShowNotification(true)
    }
  }

  // Example 4: Component that throws error (for ErrorBoundary demo)
  const ProblematicComponent = () => {
    const [shouldError, setShouldError] = useState(false)
    
    if (shouldError) {
      throw new Error('Component render error!')
    }

    return (
      <div className="p-4 bg-gray-800 rounded">
        <p className="text-sm text-gray-300 mb-2">This component can throw an error</p>
        <button
          onClick={() => setShouldError(true)}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Trigger Error
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-gray-100 mb-4">Error Handling Examples</h2>
      
      {/* Example 1: Basic Error Handling */}
      <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Basic Error Handling</h3>
        <button
          onClick={handleBasicError}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Trigger Basic Error
        </button>
      </section>

      {/* Example 2: Async Error Handling */}
      <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Async Error Handling</h3>
        <button
          onClick={handleAsyncOperation}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Trigger Async Error
        </button>
      </section>

      {/* Example 3: Auth Error with Notification */}
      <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Auth Error with Custom Notification</h3>
        <button
          onClick={handleAuthError}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Trigger Auth Error
        </button>
        
        {showNotification && (
          <ErrorNotification
            message="Authentication failed. Please log in again."
            severity={ErrorSeverity.HIGH}
            onDismiss={() => setShowNotification(false)}
            onRetry={() => {
              console.log('Retrying authentication...')
              setShowNotification(false)
            }}
            actions={[
              {
                label: 'Go to Login',
                onClick: () => console.log('Navigate to login'),
                variant: 'primary'
              }
            ]}
          />
        )}
      </section>

      {/* Example 4: Error Recovery */}
      {lastError && (
        <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Error Recovery Options</h3>
          <ErrorRecovery
            errorCategory={lastError}
            onRecovered={() => {
              console.log('Error recovered!')
              setLastError(null)
            }}
            customSteps={[
              {
                id: 'custom-step',
                title: 'Custom Recovery Step',
                description: 'This is a custom recovery action',
                action: async () => {
                  console.log('Executing custom recovery...')
                  await new Promise(resolve => setTimeout(resolve, 1000))
                },
                icon: RefreshCw
              }
            ]}
          />
        </section>
      )}

      {/* Example 5: Error Boundary */}
      <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Error Boundary Demo</h3>
        <DashboardErrorBoundary section="Example Component">
          <ProblematicComponent />
        </DashboardErrorBoundary>
      </section>

      {/* Example 6: Chat Error Boundary */}
      <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Chat Error Boundary Demo</h3>
        <div className="h-64 bg-gray-800 rounded">
          <ChatErrorBoundary
            onReset={() => console.log('Chat reset')}
          >
            <div className="p-4">
              <p className="text-gray-300">Chat interface would go here</p>
            </div>
          </ChatErrorBoundary>
        </div>
      </section>
    </div>
  )
}

// Usage in actual components:
/*
// In a dashboard component:
export function DashboardComponent() {
  const { handleError } = useErrorHandler()
  
  const fetchData = async () => {
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('Failed to fetch dashboard data')
      return response.json()
    } catch (error) {
      handleError(error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
        fallbackMessage: 'Unable to load dashboard data'
      })
    }
  }
  
  return (
    <DashboardErrorBoundary section="Main Dashboard">
      {/* Component content *}
    </DashboardErrorBoundary>
  )
}
*/