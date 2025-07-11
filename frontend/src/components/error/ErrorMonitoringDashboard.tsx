'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, XCircle, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { errorService, ErrorSeverity, ErrorCategory, ErrorDetails } from '@/lib/error-service'
// Simple date formatting utility
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
}

interface ErrorStats {
  total: number
  bySeverity: Record<ErrorSeverity, number>
  byCategory: Record<ErrorCategory, number>
  recent: ErrorDetails[]
}

export function ErrorMonitoringDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | null>(null)

  useEffect(() => {
    const updateStats = () => {
      const allErrors = errorService.getRecentErrors()
      
      const stats: ErrorStats = {
        total: allErrors.length,
        bySeverity: {
          [ErrorSeverity.LOW]: 0,
          [ErrorSeverity.MEDIUM]: 0,
          [ErrorSeverity.HIGH]: 0,
          [ErrorSeverity.CRITICAL]: 0
        },
        byCategory: {
          [ErrorCategory.AUTH]: 0,
          [ErrorCategory.API]: 0,
          [ErrorCategory.DATABASE]: 0,
          [ErrorCategory.UI]: 0,
          [ErrorCategory.NETWORK]: 0,
          [ErrorCategory.VALIDATION]: 0,
          [ErrorCategory.UNKNOWN]: 0
        },
        recent: allErrors.slice(0, 10)
      }

      allErrors.forEach(error => {
        stats.bySeverity[error.severity]++
        stats.byCategory[error.category]++
      })

      setStats(stats)
    }

    updateStats()
    const interval = setInterval(updateStats, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const severityConfig = {
    [ErrorSeverity.LOW]: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-900/20' },
    [ErrorSeverity.MEDIUM]: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-900/20' },
    [ErrorSeverity.HIGH]: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-900/20' },
    [ErrorSeverity.CRITICAL]: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-900/20' }
  }

  const categoryColors = {
    [ErrorCategory.AUTH]: 'bg-purple-900/20 border-purple-700',
    [ErrorCategory.API]: 'bg-blue-900/20 border-blue-700',
    [ErrorCategory.DATABASE]: 'bg-green-900/20 border-green-700',
    [ErrorCategory.UI]: 'bg-pink-900/20 border-pink-700',
    [ErrorCategory.NETWORK]: 'bg-yellow-900/20 border-yellow-700',
    [ErrorCategory.VALIDATION]: 'bg-indigo-900/20 border-indigo-700',
    [ErrorCategory.UNKNOWN]: 'bg-gray-900/20 border-gray-700'
  }

  if (!stats) {
    return (
      <div className="animate-pulse bg-gray-900 rounded-lg p-6">
        <div className="h-4 bg-gray-800 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-800 rounded"></div>
          <div className="h-20 bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  const filteredErrors = stats.recent.filter(error => {
    if (selectedCategory && error.category !== selectedCategory) return false
    if (selectedSeverity && error.severity !== selectedSeverity) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Error Monitoring</h3>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(stats.bySeverity).map(([severity, count]) => {
            const config = severityConfig[severity as ErrorSeverity]
            const Icon = config.icon
            return (
              <button
                key={severity}
                onClick={() => setSelectedSeverity(
                  selectedSeverity === severity ? null : severity as ErrorSeverity
                )}
                className={`p-4 rounded-lg border transition-all ${
                  selectedSeverity === severity
                    ? 'border-primary-500 bg-primary-900/20'
                    : 'border-gray-700 hover:border-gray-600'
                } ${config.bg}`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <span className="text-2xl font-bold text-gray-100">{count}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 capitalize">{severity}</p>
              </button>
            )
          })}
        </div>

        {/* Category Breakdown */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">By Category</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).map(([category, count]) => {
              if (count === 0) return null
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(
                    selectedCategory === category ? null : category as ErrorCategory
                  )}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${
                    selectedCategory === category
                      ? 'border-primary-500 bg-primary-900/20'
                      : categoryColors[category as ErrorCategory]
                  }`}
                >
                  {category}: {count}
                </button>
              )
            })}
          </div>
        </div>

        {/* Recent Errors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-300">Recent Errors</h4>
            {(selectedCategory || selectedSeverity) && (
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  setSelectedSeverity(null)
                }}
                className="text-xs text-primary-500 hover:text-primary-400"
              >
                Clear filters
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredErrors.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No errors matching the selected filters
              </p>
            ) : (
              filteredErrors.map((error, index) => {
                const config = severityConfig[error.severity]
                const Icon = config.icon
                
                return (
                  <div
                    key={`${error.timestamp}-${index}`}
                    className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 ${config.color} flex-shrink-0`} />
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-100 truncate">
                          {error.message}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">
                            {error.category}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(new Date(error.timestamp))}
                          </span>
                          {error.userId && (
                            <span className="text-xs text-gray-500">
                              User: {error.userId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {error.context && Object.keys(error.context).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          Context
                        </summary>
                        <pre className="text-xs text-gray-500 mt-1 overflow-auto">
                          {JSON.stringify(error.context, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Clear Errors Button */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={() => {
              errorService.clearErrors()
              setStats({ ...stats, total: 0, recent: [] })
            }}
            className="text-sm text-red-500 hover:text-red-400"
          >
            Clear All Errors
          </button>
        </div>
      </div>
    </div>
  )
}