'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, AlertTriangle, AlertCircle, Info, CheckCircle, ExternalLink } from 'lucide-react'
import { errorService, ErrorSeverity, ErrorCategory, ErrorDetails } from '@/lib/error-service'

interface ErrorNotification {
  id: string
  error: ErrorDetails
  isVisible: boolean
  autoCloseTimeout?: NodeJS.Timeout
}

interface ErrorNotificationSystemProps {
  maxNotifications?: number
  autoCloseDelay?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  enableSound?: boolean
}

export function ErrorNotificationSystem({
  maxNotifications = 5,
  autoCloseDelay = 5000,
  position = 'top-right',
  enableSound = false
}: ErrorNotificationSystemProps) {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([])
  const [isEnabled, setIsEnabled] = useState(true)

  const closeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, isVisible: false }
          : n
      )
    )
    
    // Remove from DOM after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    }, 300)
  }, [])

  const showNotification = useCallback((error: ErrorDetails) => {
    const notificationId = error.id || crypto.randomUUID()
    
    // Play sound if enabled
    if (enableSound && 'Audio' in window) {
      try {
        const audio = new Audio('/sounds/error-notification.wav')
        audio.volume = 0.3
        audio.play().catch(() => {
          // Ignore audio play errors
        })
      } catch (err) {
        console.warn('Could not play notification sound:', err)
      }
    }

    const notification: ErrorNotification = {
      id: notificationId,
      error,
      isVisible: true
    }

    // Auto-close for non-critical errors
    if (error.severity !== ErrorSeverity.CRITICAL && autoCloseDelay > 0) {
      notification.autoCloseTimeout = setTimeout(() => {
        closeNotification(notificationId)
      }, autoCloseDelay)
    }

    setNotifications(prev => {
      const newNotifications = [notification, ...prev]
      
      // Limit number of notifications
      if (newNotifications.length > maxNotifications) {
        const removed = newNotifications.slice(maxNotifications)
        removed.forEach(n => {
          if (n.autoCloseTimeout) {
            clearTimeout(n.autoCloseTimeout)
          }
        })
        return newNotifications.slice(0, maxNotifications)
      }
      
      return newNotifications
    })
  }, [enableSound, autoCloseDelay, closeNotification, maxNotifications])

  useEffect(() => {
    // Listen for new errors
    const originalLogError = errorService.logError.bind(errorService)
    
    errorService.logError = async (error, category, severity, context) => {
      const errorId = await originalLogError(error, category, severity, context)
      
      if (isEnabled && (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL)) {
        const errorDetails: ErrorDetails = {
          id: errorId,
          message: error instanceof Error ? error.message : String(error),
          category: category || ErrorCategory.UNKNOWN,
          severity: severity || ErrorSeverity.MEDIUM,
          context,
          timestamp: new Date(),
          userId: undefined,
          sessionId: undefined
        }
        
        showNotification(errorDetails)
      }
      
      return errorId
    }

    // Cleanup function that only clears timeouts for current notifications
    return () => {
      // Clear timeouts for notifications that exist at cleanup time
      setNotifications(prev => {
        prev.forEach(notification => {
          if (notification.autoCloseTimeout) {
            clearTimeout(notification.autoCloseTimeout)
          }
        })
        return prev
      })
    }
  }, [isEnabled, showNotification]) // Removed 'notifications' dependency to prevent infinite loop

  const getSeverityConfig = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return {
          icon: Info,
          bgColor: 'bg-blue-900/90',
          borderColor: 'border-blue-500',
          textColor: 'text-blue-100'
        }
      case ErrorSeverity.MEDIUM:
        return {
          icon: AlertCircle,
          bgColor: 'bg-yellow-900/90',
          borderColor: 'border-yellow-500',
          textColor: 'text-yellow-100'
        }
      case ErrorSeverity.HIGH:
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-900/90',
          borderColor: 'border-orange-500',
          textColor: 'text-orange-100'
        }
      case ErrorSeverity.CRITICAL:
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-900/90',
          borderColor: 'border-red-500',
          textColor: 'text-red-100'
        }
      default:
        return {
          icon: Info,
          bgColor: 'bg-gray-900/90',
          borderColor: 'border-gray-500',
          textColor: 'text-gray-100'
        }
    }
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
        return 'bottom-4 right-4'
      default:
        return 'top-4 right-4'
    }
  }

  const viewErrorDetails = (error: ErrorDetails) => {
    console.group(`Error Details - ${error.id}`)
    console.error('Message:', error.message)
    console.error('Category:', error.category)
    console.error('Severity:', error.severity)
    console.error('Context:', error.context)
    console.error('Stack:', error.stack)
    console.error('Timestamp:', error.timestamp)
    console.groupEnd()
  }

  if (notifications.length === 0) {
    return null
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsEnabled(!isEnabled)}
        className={`fixed bottom-4 left-4 z-50 p-2 rounded-full transition-colors ${
          isEnabled 
            ? 'bg-green-600 hover:bg-green-700 text-white' 
            : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
        }`}
        title={isEnabled ? 'Disable error notifications' : 'Enable error notifications'}
      >
        {isEnabled ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
      </button>

      {/* Notifications container */}
      <div className={`fixed ${getPositionClasses()} z-50 space-y-3 max-w-sm w-full`}>
        {notifications.map(notification => {
          const { error, isVisible } = notification
          const config = getSeverityConfig(error.severity)
          const Icon = config.icon

          return (
            <div
              key={notification.id}
              className={`transform transition-all duration-300 ${
                isVisible 
                  ? 'translate-x-0 opacity-100 scale-100' 
                  : 'translate-x-full opacity-0 scale-95'
              }`}
            >
              <div className={`
                ${config.bgColor} ${config.borderColor} ${config.textColor}
                border-l-4 rounded-lg shadow-lg backdrop-blur-sm p-4
                flex items-start gap-3 max-w-sm
              `}>
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm capitalize">
                      {error.severity} {error.category} Error
                    </h4>
                    <button
                      onClick={() => closeNotification(notification.id)}
                      className="text-gray-300 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <p className="text-sm opacity-90 break-words">
                    {error.message}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => viewErrorDetails(error)}
                      className="text-xs opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Details
                    </button>
                    
                    <span className="text-xs opacity-50">
                      {error.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default ErrorNotificationSystem