'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, Activity, Clock, AlertTriangle } from 'lucide-react'
import { useMetrics } from '@/hooks/useMetrics'

export function MetricsVisualization() {
  const { apiStats, dbStats, systemMetrics } = useMetrics()
  
  // Calculate trends (mock implementation - in real app, compare with previous period)
  const getTrend = (current: number, previous: number) => {
    if (current > previous * 1.1) return 'up'
    if (current < previous * 0.9) return 'down'
    return 'stable'
  }

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`

  const metrics = [
    {
      label: 'API Requests',
      value: apiStats.totalRequests.toLocaleString(),
      subValue: 'Last hour',
      trend: 'stable' as const,
      icon: Activity,
      color: 'blue'
    },
    {
      label: 'Avg Latency',
      value: formatLatency(apiStats.avgLatency),
      subValue: `P95: ${formatLatency(apiStats.p95Latency)}`,
      trend: (apiStats.avgLatency > 1000 ? 'up' : 'stable') as 'up' | 'down' | 'stable',
      icon: Clock,
      color: 'purple'
    },
    {
      label: 'Error Rate',
      value: formatPercentage(apiStats.errorRate),
      subValue: `${(apiStats.totalRequests * apiStats.errorRate / 100).toFixed(0)} errors`,
      trend: (apiStats.errorRate > 5 ? 'up' : 'stable') as 'up' | 'down' | 'stable',
      icon: AlertTriangle,
      color: 'red',
      alert: apiStats.errorRate > 10
    },
    {
      label: 'Success Rate',
      value: formatPercentage(apiStats.successRate),
      subValue: 'API calls',
      trend: (apiStats.successRate < 95 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
      icon: TrendingUp,
      color: 'green'
    }
  ]

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />
      case 'down':
        return <TrendingDown className="w-4 h-4" />
      case 'stable':
        return <Minus className="w-4 h-4" />
    }
  }

  const getColorClasses = (color: string, alert?: boolean) => {
    if (alert) {
      return {
        bg: 'bg-red-900/20',
        border: 'border-red-700',
        text: 'text-red-500',
        icon: 'text-red-500'
      }
    }

    const colors = {
      blue: {
        bg: 'bg-blue-900/20',
        border: 'border-blue-700',
        text: 'text-blue-500',
        icon: 'text-blue-500'
      },
      purple: {
        bg: 'bg-purple-900/20',
        border: 'border-purple-700',
        text: 'text-purple-500',
        icon: 'text-purple-500'
      },
      red: {
        bg: 'bg-red-900/20',
        border: 'border-red-700',
        text: 'text-red-500',
        icon: 'text-red-500'
      },
      green: {
        bg: 'bg-green-900/20',
        border: 'border-green-700',
        text: 'text-green-500',
        icon: 'text-green-500'
      }
    }

    return colors[color as keyof typeof colors] || colors.blue
  }

  return (
    <div className="space-y-6">
      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const colors = getColorClasses(metric.color, metric.alert)
          const Icon = metric.icon
          
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border transition-all ${colors.bg} ${colors.border} ${
                metric.alert ? 'animate-pulse' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className={`w-5 h-5 ${colors.icon}`} />
                <div className={`flex items-center gap-1 ${colors.text}`}>
                  {getTrendIcon(metric.trend)}
                </div>
              </div>
              
              <div>
                <p className="text-2xl font-bold text-gray-100">{metric.value}</p>
                <p className="text-sm text-gray-400 mt-1">{metric.label}</p>
                <p className="text-xs text-gray-500 mt-1">{metric.subValue}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Database Metrics */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Database Performance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Total Queries</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{dbStats.totalQueries.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Last hour</p>
          </div>
          
          <div className="p-4 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Avg Query Time</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{formatLatency(dbStats.avgDuration)}</p>
            <p className="text-xs text-gray-500 mt-1">Per query</p>
          </div>
          
          <div className={`p-4 rounded-lg ${
            dbStats.slowQueries > 5 ? 'bg-yellow-900/20 border border-yellow-700' : 'bg-gray-800'
          }`}>
            <p className="text-sm text-gray-400">Slow Queries</p>
            <p className={`text-2xl font-bold mt-1 ${
              dbStats.slowQueries > 5 ? 'text-yellow-500' : 'text-gray-100'
            }`}>
              {dbStats.slowQueries}
            </p>
            <p className="text-xs text-gray-500 mt-1">&gt; 1 second</p>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      {systemMetrics.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">System Resources</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Memory Usage</span>
                <span className="text-sm text-gray-100">
                  {formatPercentage(systemMetrics[0].memory.percentage)}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    systemMetrics[0].memory.percentage > 90
                      ? 'bg-red-500'
                      : systemMetrics[0].memory.percentage > 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${systemMetrics[0].memory.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {(systemMetrics[0].memory.used / 1024 / 1024 / 1024).toFixed(2)} GB / 
                {(systemMetrics[0].memory.total / 1024 / 1024 / 1024).toFixed(2)} GB
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">CPU Usage</span>
                <span className="text-sm text-gray-100">
                  {formatPercentage(systemMetrics[0].cpu)}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    systemMetrics[0].cpu > 90
                      ? 'bg-red-500'
                      : systemMetrics[0].cpu > 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${systemMetrics[0].cpu}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}