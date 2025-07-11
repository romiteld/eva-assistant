'use client'

import React from 'react'
import { SystemHealthMonitor } from './SystemHealthMonitor'
import { MetricsVisualization } from './MetricsVisualization'
import { AlertsPanel } from './AlertsPanel'
import { DatabaseQueryMonitor } from './DatabaseQueryMonitor'
import { ErrorMonitoringDashboard } from '@/components/error/ErrorMonitoringDashboard'
import { Activity, BarChart3, Bell, Database, AlertTriangle, RefreshCw } from 'lucide-react'

export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = React.useState('overview')
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [lastRefresh, setLastRefresh] = React.useState(new Date())

  React.useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'errors', label: 'Errors', icon: AlertTriangle }
  ]

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">Monitoring & Observability</h1>
              <p className="text-gray-400 mt-1">Real-time system monitoring and performance metrics</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  autoRefresh 
                    ? 'bg-primary-900/20 border border-primary-700 text-primary-500'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-900 p-1 rounded-lg">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    activeTab === tab.id
                      ? 'bg-gray-800 text-gray-100'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SystemHealthMonitor />
                <AlertsPanel />
              </div>
              <MetricsVisualization />
            </>
          )}

          {activeTab === 'metrics' && (
            <>
              <MetricsVisualization />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DatabaseQueryMonitor />
                <SystemHealthMonitor />
              </div>
            </>
          )}

          {activeTab === 'alerts' && (
            <AlertsPanel />
          )}

          {activeTab === 'database' && (
            <DatabaseQueryMonitor />
          )}

          {activeTab === 'errors' && (
            <ErrorMonitoringDashboard />
          )}
        </div>
      </div>
    </div>
  )
}