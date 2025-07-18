'use client'

import React, { useState, useEffect } from 'react'
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Activity,
  Zap,
  Shield,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { errorService, ErrorSeverity, ErrorCategory, ErrorDetails, ErrorStats } from '@/lib/error-service'
import { metricsCollector } from '@/lib/monitoring/metrics'
import { useCoreWebVitals } from '@/lib/monitoring/core-web-vitals'

// Simple date formatting utility
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export function ErrorMonitoringDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [apiMetrics, setApiMetrics] = useState<any>(null)
  const [dbMetrics, setDbMetrics] = useState<any>(null)
  
  const { metrics: webVitals, performanceScore, isGood, needsImprovement, isPoor } = useCoreWebVitals()

  useEffect(() => {
    const updateStats = async () => {
      try {
        setIsLoading(true)
        
        // Get error statistics
        const errorStats = await errorService.getErrorStats()
        setStats(errorStats)
        
        // Get API metrics
        const apiStats = metricsCollector.getAPIStats()
        setApiMetrics(apiStats)
        
        // Get database metrics
        const dbStats = metricsCollector.getDatabaseStats()
        setDbMetrics(dbStats)
        
        setLastRefresh(new Date())
      } catch (error) {
        console.error('Failed to update monitoring stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    updateStats()
    const interval = setInterval(updateStats, 10000) // Update every 10 seconds

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

  if (isLoading && !stats) {
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

  const filteredErrors = stats?.recent.filter(error => {
    if (selectedCategory && error.category !== selectedCategory) return false
    if (selectedSeverity && error.severity !== selectedSeverity) return false
    return true
  }) || []

  const refreshData = async () => {
    try {
      setIsLoading(true)
      const errorStats = await errorService.getErrorStats()
      setStats(errorStats)
      
      const apiStats = metricsCollector.getAPIStats()
      setApiMetrics(apiStats)
      
      const dbStats = metricsCollector.getDatabaseStats()
      setDbMetrics(dbStats)
      
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to refresh data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">System Monitoring</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            Last updated: {formatTime(lastRefresh)}
          </span>
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Performance Score</p>
              <p className="text-2xl font-bold text-gray-100">{performanceScore}</p>
            </div>
            <div className={`p-2 rounded-full ${
              isGood ? 'bg-green-900/20' : 
              needsImprovement ? 'bg-yellow-900/20' : 
              'bg-red-900/20'
            }`}>
              <Activity className={`w-5 h-5 ${
                isGood ? 'text-green-500' : 
                needsImprovement ? 'text-yellow-500' : 
                'text-red-500'
              }`} />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">API Latency</p>
              <p className="text-2xl font-bold text-gray-100">
                {apiMetrics ? `${Math.round(apiMetrics.avgLatency)}ms` : '--'}
              </p>
            </div>
            <div className="p-2 rounded-full bg-blue-900/20">
              <Zap className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Error Rate</p>
              <p className="text-2xl font-bold text-gray-100">
                {apiMetrics ? `${apiMetrics.errorRate.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="p-2 rounded-full bg-red-900/20">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Errors</p>
              <p className="text-2xl font-bold text-gray-100">{stats?.total || 0}</p>
            </div>
            <div className="p-2 rounded-full bg-orange-900/20">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Core Web Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(webVitals).map(([key, value]) => (
            <div key={key} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400 uppercase">{key}</span>
                <BarChart3 className="w-4 h-4 text-gray-500" />
              </div>
              <div className="text-lg font-semibold text-gray-100">
                {value !== null ? formatDuration(value) : '--'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Details */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Error Monitoring</h3>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {stats && Object.entries(stats.bySeverity).map(([severity, count]) => {
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
            {stats && Object.entries(stats.byCategory).map(([category, count]) => {
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
              if (stats) {
                setStats({ ...stats, total: 0, recent: [] })
              }
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