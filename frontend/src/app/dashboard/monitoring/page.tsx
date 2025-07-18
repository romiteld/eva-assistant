'use client'

import { useState } from 'react'
import { ErrorMonitoringDashboard } from '@/components/error/ErrorMonitoringDashboard'
import { ErrorNotificationSystem } from '@/components/error/ErrorNotificationSystem'
import { useAlerts } from '@/lib/monitoring/alerting'
import { AlertTriangle, Bell, BellOff, Settings, TrendingUp } from 'lucide-react'

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'settings'>('overview')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const { notifications, rules, acknowledgeAlert } = useAlerts()

  const unacknowledgedAlerts = notifications.filter(n => !n.acknowledged)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">System Monitoring</h1>
            <p className="text-gray-400 mt-2">
              Monitor errors, performance, and system health in real-time
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {unacknowledgedAlerts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-700 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-300">
                  {unacknowledgedAlerts.length} unacknowledged alerts
                </span>
              </div>
            )}
            
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                notificationsEnabled 
                  ? 'bg-green-900/20 border border-green-700 text-green-300' 
                  : 'bg-gray-800 border border-gray-700 text-gray-400'
              }`}
            >
              {notificationsEnabled ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
              Notifications
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'alerts' && unacknowledgedAlerts.length > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                    {unacknowledgedAlerts.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div>
              <ErrorMonitoringDashboard />
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Recent Alerts</h3>
                
                {notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No alerts yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Alerts will appear here when thresholds are exceeded
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          notification.acknowledged
                            ? 'bg-gray-800 border-gray-700'
                            : notification.severity === 'critical'
                            ? 'bg-red-900/20 border-red-700'
                            : notification.severity === 'high'
                            ? 'bg-orange-900/20 border-orange-700'
                            : 'bg-yellow-900/20 border-yellow-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-gray-100">
                                {notification.ruleName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                notification.severity === 'critical' ? 'bg-red-600 text-white' :
                                notification.severity === 'high' ? 'bg-orange-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {notification.severity}
                              </span>
                              {notification.acknowledged && (
                                <span className="px-2 py-0.5 bg-gray-600 text-gray-300 rounded-full text-xs">
                                  Acknowledged
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-300 mb-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500">
                              {notification.triggeredAt.toLocaleString()}
                            </p>
                          </div>
                          
                          {!notification.acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(notification.id)}
                              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Alert Rules</h3>
                
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-100">
                              {rule.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              rule.isActive 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-gray-300'
                            }`}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mb-1">
                            Type: {rule.type.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-400">
                            Threshold: {rule.conditions.threshold} 
                            {rule.conditions.operator} in {rule.conditions.timeWindow / 1000}s
                          </p>
                          {rule.lastTriggered && (
                            <p className="text-xs text-gray-500 mt-1">
                              Last triggered: {rule.lastTriggered.toLocaleString()}
                            </p>
                          )}
                        </div>
                        
                        <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm">
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Notification System */}
      {notificationsEnabled && <ErrorNotificationSystem />}
    </div>
  )
}