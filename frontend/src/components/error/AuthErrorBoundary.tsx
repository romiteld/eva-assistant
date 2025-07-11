'use client'

import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { LogIn, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AuthErrorBoundaryProps {
  children: React.ReactNode
}

export function AuthErrorBoundary({ children }: AuthErrorBoundaryProps) {
  const router = useRouter()

  const authErrorFallback = (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-lg shadow-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-900/20 rounded-full mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-500" />
        </div>
        
        <h1 className="text-xl font-semibold text-center text-gray-100 mb-2">
          Authentication Error
        </h1>
        
        <p className="text-gray-400 text-center mb-6">
          There was a problem with your authentication. Please try logging in again.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              // Clear auth data
              localStorage.removeItem('supabase.auth.token')
              sessionStorage.clear()
              router.push('/login')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Go to Login
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-gray-100 rounded-md hover:bg-gray-700 transition-colors"
          >
            Try Again
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            If you continue to experience issues,{' '}
            <a
              href="mailto:support@thewellrecruiting.com"
              className="text-primary-500 hover:text-primary-400 underline"
            >
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={authErrorFallback}
      onError={(error) => {
        // Clear potentially corrupted auth state
        try {
          localStorage.removeItem('supabase.auth.token')
          sessionStorage.removeItem('eva_session_id')
        } catch (e) {
          console.error('Failed to clear auth state:', e)
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}