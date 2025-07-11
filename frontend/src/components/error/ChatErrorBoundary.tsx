'use client'

import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { MessageSquareOff, RefreshCw } from 'lucide-react'

interface ChatErrorBoundaryProps {
  children: React.ReactNode
  onReset?: () => void
}

export function ChatErrorBoundary({ children, onReset }: ChatErrorBoundaryProps) {
  const chatErrorFallback = (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6">
      <div className="flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mb-4">
        <MessageSquareOff className="w-8 h-8 text-red-500" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-100 mb-2">
        Chat Unavailable
      </h3>
      
      <p className="text-gray-400 text-center max-w-sm mb-6">
        The chat service is temporarily unavailable. Please try again in a moment.
      </p>

      <button
        onClick={() => {
          if (onReset) {
            onReset()
          } else {
            window.location.reload()
          }
        }}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Restart Chat
      </button>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={chatErrorFallback}
      onError={(error) => {
        console.error('Chat error:', error)
        // Could emit an event to notify parent components
        window.dispatchEvent(new CustomEvent('chat-error', { detail: error }))
      }}
    >
      {children}
    </ErrorBoundary>
  )
}