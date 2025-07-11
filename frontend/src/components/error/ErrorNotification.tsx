'use client'

import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, Info, AlertCircle, XCircle, RefreshCw } from 'lucide-react'
import { ErrorSeverity } from '@/lib/error-service'

interface ErrorNotificationProps {
  message: string
  severity?: ErrorSeverity
  onDismiss?: () => void
  onRetry?: () => void
  autoHide?: boolean
  autoHideDelay?: number
  actions?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }[]
}

export function ErrorNotification({
  message,
  severity = ErrorSeverity.MEDIUM,
  onDismiss,
  onRetry,
  autoHide = false,
  autoHideDelay = 5000,
  actions = []
}: ErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHide && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, autoHideDelay)
      return () => clearTimeout(timer)
    }
  }, [autoHide, autoHideDelay, onDismiss])

  if (!isVisible) return null

  const severityConfig = {
    [ErrorSeverity.LOW]: {
      icon: Info,
      bgColor: 'bg-blue-900/20',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-800'
    },
    [ErrorSeverity.MEDIUM]: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-900/20',
      iconColor: 'text-yellow-500',
      borderColor: 'border-yellow-800'
    },
    [ErrorSeverity.HIGH]: {
      icon: AlertTriangle,
      bgColor: 'bg-orange-900/20',
      iconColor: 'text-orange-500',
      borderColor: 'border-orange-800'
    },
    [ErrorSeverity.CRITICAL]: {
      icon: XCircle,
      bgColor: 'bg-red-900/20',
      iconColor: 'text-red-500',
      borderColor: 'border-red-800'
    }
  }

  const config = severityConfig[severity]
  const Icon = config.icon

  return (
    <div
      className={`fixed top-4 right-4 max-w-md w-full ${config.bgColor} backdrop-blur-sm rounded-lg shadow-xl border ${config.borderColor} p-4 z-50 animate-slide-in-right`}
      role="alert"
    >
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="ml-3 flex-1">
          <p className="text-sm text-gray-100">{message}</p>
          
          {(onRetry || actions.length > 0) && (
            <div className="mt-3 flex gap-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-800 text-gray-100 rounded hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
              
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-800 text-gray-100 hover:bg-gray-700'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false)
              onDismiss()
            }}
            className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// CSS for slide-in animation (add to globals.css)
const animationStyles = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
`