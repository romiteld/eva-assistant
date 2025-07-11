'use client'

import React from 'react'
import { Bell, BellOff, CheckCircle, XCircle, AlertTriangle, Info, Clock, Settings } from 'lucide-react'
import { alertManager, Alert, AlertSeverity, AlertCategory } from '@/lib/monitoring/alerts'
import { useMetrics } from '@/hooks/useMetrics'

export function AlertsPanel() {
  const { alerts } = useMetrics()
  const [showResolved, setShowResolved] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState<AlertCategory | null>(null)
  const [showSettings, setShowSettings] = React.useState(false)
  const [rules, setRules] = React.useState(alertManager.getRules())

  const severityConfig = {
    [AlertSeverity.INFO]: { 
      icon: Info, 
      color: 'text-blue-500', 
      bg: 'bg-blue-900/20',
      border: 'border-blue-700',
      animate: false
    },
    [AlertSeverity.WARNING]: { 
      icon: AlertTriangle, 
      color: 'text-yellow-500', 
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-700',
      animate: false
    },
    [AlertSeverity.ERROR]: { 
      icon: XCircle, 
      color: 'text-orange-500', 
      bg: 'bg-orange-900/20',
      border: 'border-orange-700',
      animate: true
    },
    [AlertSeverity.CRITICAL]: { 
      icon: XCircle, 
      color: 'text-red-500', 
      bg: 'bg-red-900/20',
      border: 'border-red-700',
      animate: true
    }
  }

  const categoryColors = {
    [AlertCategory.PERFORMANCE]: 'text-purple-500',
    [AlertCategory.AVAILABILITY]: 'text-blue-500',
    [AlertCategory.ERROR_RATE]: 'text-red-500',
    [AlertCategory.SECURITY]: 'text-yellow-500',
    [AlertCategory.RESOURCE]: 'text-green-500',
    [AlertCategory.CUSTOM]: 'text-gray-500'
  }

  const filteredAlerts = React.useMemo(() => {
    let filtered = showResolved ? alertManager.getAlerts(true) : alerts
    
    if (selectedCategory) {
      filtered = filtered.filter(alert => alert.category === selectedCategory)
    }
    
    return filtered
  }, [alerts, showResolved, selectedCategory])

  const activeAlertCount = alerts.length
  const criticalCount = alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length

  const handleResolve = (alertId: string) => {
    alertManager.resolveAlert(alertId)
  }

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    alertManager.toggleRule(ruleId, enabled)
    setRules(alertManager.getRules())
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-100">Alerts</h3>
          {activeAlertCount > 0 && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              criticalCount > 0 
                ? 'bg-red-900/20 text-red-500 border border-red-700'
                : 'bg-yellow-900/20 text-yellow-500 border border-yellow-700'
            }`}>
              {activeAlertCount} Active
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Alert settings"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
          
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showResolved ? 'Hide' : 'Show'} Resolved
          </button>
        </div>
      </div>

      {/* Alert Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Alert Rules</h4>
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-100">{rule.name}</p>
                  <p className="text-xs text-gray-500">{rule.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-xs border transition-all ${
            !selectedCategory
              ? 'bg-primary-900/20 border-primary-500 text-primary-500'
              : 'border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          All Categories
        </button>
        {Object.entries(AlertCategory).map(([key, value]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(value)}
            className={`px-3 py-1 rounded-full text-xs border transition-all ${
              selectedCategory === value
                ? 'bg-primary-900/20 border-primary-500 text-primary-500'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No alerts to display</p>
            <p className="text-sm text-gray-600 mt-1">
              {selectedCategory ? 'Try selecting a different category' : 'All systems operating normally'}
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const config = severityConfig[alert.severity]
            const Icon = config.icon
            
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border transition-all ${config.bg} ${config.border} ${
                  config.animate && !alert.resolved ? 'animate-pulse' : ''
                } ${alert.resolved ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${config.color} flex-shrink-0`} />
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-gray-100">{alert.title}</h4>
                        <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                      </div>
                      
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          aria-label="Resolve alert"
                        >
                          <CheckCircle className="w-4 h-4 text-gray-400 hover:text-green-500" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`text-xs ${categoryColors[alert.category]}`}>
                        {alert.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(alert.timestamp)}
                      </span>
                      {alert.resolved && alert.resolvedAt && (
                        <span className="text-xs text-green-500">
                          Resolved {formatTimestamp(alert.resolvedAt)}
                        </span>
                      )}
                    </div>
                    
                    {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          Details
                        </summary>
                        <pre className="text-xs text-gray-500 mt-1 overflow-auto bg-gray-800 p-2 rounded">
                          {JSON.stringify(alert.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Actions */}
      {filteredAlerts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={() => alertManager.clearAlerts()}
            className="text-sm text-red-500 hover:text-red-400 transition-colors"
          >
            Clear All Alerts
          </button>
          
          {activeAlertCount > 0 && (
            <span className="text-xs text-gray-500">
              {activeAlertCount} active alert{activeAlertCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}