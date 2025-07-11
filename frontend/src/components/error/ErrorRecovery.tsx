'use client'

import React, { useState } from 'react'
import { RefreshCw, WifiOff, Database, Key, AlertTriangle } from 'lucide-react'
import { ErrorCategory } from '@/lib/error-service'

interface RecoveryStep {
  id: string
  title: string
  description: string
  action: () => Promise<void> | void
  icon: React.ElementType
}

interface ErrorRecoveryProps {
  errorCategory: ErrorCategory
  onRecovered?: () => void
  customSteps?: RecoveryStep[]
}

export function ErrorRecovery({ errorCategory, onRecovered, customSteps = [] }: ErrorRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const defaultRecoverySteps: Record<ErrorCategory, RecoveryStep[]> = {
    [ErrorCategory.NETWORK]: [
      {
        id: 'check-connection',
        title: 'Check Internet Connection',
        description: 'Verify your internet connection is working',
        action: async () => {
          try {
            await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' })
          } catch {
            throw new Error('No internet connection detected')
          }
        },
        icon: WifiOff
      },
      {
        id: 'retry-request',
        title: 'Retry Request',
        description: 'Try the operation again',
        action: () => window.location.reload(),
        icon: RefreshCw
      }
    ],
    [ErrorCategory.AUTH]: [
      {
        id: 'clear-cache',
        title: 'Clear Authentication Cache',
        description: 'Remove stored authentication data',
        action: () => {
          localStorage.removeItem('supabase.auth.token')
          sessionStorage.clear()
        },
        icon: Key
      },
      {
        id: 'relogin',
        title: 'Log In Again',
        description: 'Redirect to login page',
        action: () => {
          window.location.href = '/login'
        },
        icon: Key
      }
    ],
    [ErrorCategory.DATABASE]: [
      {
        id: 'check-status',
        title: 'Check Service Status',
        description: 'Verify database service is operational',
        action: async () => {
          const response = await fetch('/api/health/database')
          if (!response.ok) {
            throw new Error('Database service is unavailable')
          }
        },
        icon: Database
      },
      {
        id: 'retry-later',
        title: 'Retry Operation',
        description: 'Wait a moment and try again',
        action: () => {
          return new Promise(resolve => setTimeout(resolve, 2000))
        },
        icon: RefreshCw
      }
    ],
    [ErrorCategory.API]: [
      {
        id: 'check-api',
        title: 'Check API Status',
        description: 'Verify API service is operational',
        action: async () => {
          const response = await fetch('/api/health')
          if (!response.ok) {
            throw new Error('API service is unavailable')
          }
        },
        icon: AlertTriangle
      }
    ],
    [ErrorCategory.UI]: [
      {
        id: 'clear-storage',
        title: 'Clear Local Storage',
        description: 'Remove potentially corrupted local data',
        action: () => {
          localStorage.clear()
          sessionStorage.clear()
        },
        icon: RefreshCw
      },
      {
        id: 'hard-refresh',
        title: 'Hard Refresh',
        description: 'Force reload all resources',
        action: () => {
          window.location.reload()
        },
        icon: RefreshCw
      }
    ],
    [ErrorCategory.VALIDATION]: [],
    [ErrorCategory.UNKNOWN]: [
      {
        id: 'general-refresh',
        title: 'Refresh Page',
        description: 'Reload the application',
        action: () => window.location.reload(),
        icon: RefreshCw
      }
    ]
  }

  const steps = [...(defaultRecoverySteps[errorCategory] || []), ...customSteps]

  const executeStep = async (step: RecoveryStep) => {
    setIsRecovering(true)
    setCurrentStep(step.id)

    try {
      await step.action()
      setCompletedSteps(prev => new Set([...prev, step.id]))
      
      if (completedSteps.size + 1 === steps.length) {
        onRecovered?.()
      }
    } catch (error) {
      console.error(`Recovery step failed: ${step.title}`, error)
      throw error
    } finally {
      setIsRecovering(false)
      setCurrentStep(null)
    }
  }

  if (steps.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-100 mb-3">Recovery Options</h3>
      
      <div className="space-y-2">
        {steps.map((step: RecoveryStep) => {
          const Icon = step.icon
          const isCompleted = completedSteps.has(step.id)
          const isActive = currentStep === step.id

          return (
            <button
              key={step.id}
              onClick={() => executeStep(step)}
              disabled={isRecovering || isCompleted}
              className={`w-full text-left p-3 rounded-md transition-colors ${
                isCompleted
                  ? 'bg-green-900/20 border border-green-800 cursor-not-allowed'
                  : isActive
                  ? 'bg-primary-900/20 border border-primary-700'
                  : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  isCompleted ? 'text-green-500' : isActive ? 'text-primary-500' : 'text-gray-400'
                }`}>
                  {isActive ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    isCompleted ? 'text-green-400' : 'text-gray-100'
                  }`}>
                    {step.title}
                    {isCompleted && ' ✓'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}