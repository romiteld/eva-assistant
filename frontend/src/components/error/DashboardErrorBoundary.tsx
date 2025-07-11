'use client'

import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { RefreshCw, AlertTriangle, Home } from 'lucide-react'

interface DashboardErrorBoundaryProps {
  children: React.ReactNode
  section?: string
}

export function DashboardErrorBoundary({ children, section }: DashboardErrorBoundaryProps) {
  const dashboardErrorFallback = (
    <div className="w-full bg-gray-900 rounded-lg shadow-lg p-6 border border-gray-800">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-10 h-10 bg-red-900/20 rounded-full flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-100 mb-1">
            {section ? `${section} Error` : 'Dashboard Error'}
          </h3>
          
          <p className="text-gray-400 text-sm mb-4">
            This section encountered an error and couldn&apos;t load properly.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-100 text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            
            <button
              onClick={() => {
                // Attempt to reload just this component
                const event = new CustomEvent('dashboard-section-reload', { 
                  detail: { section } 
                })
                window.dispatchEvent(event)
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={dashboardErrorFallback}
      onError={(error, errorInfo) => {
        console.error(`Dashboard section error (${section}):`, error)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}