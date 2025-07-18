import { errorService, ErrorSeverity, ErrorCategory } from '@/lib/error-service'
import { metricsCollector } from './metrics'

export interface AlertRule {
  id: string
  name: string
  type: 'error_threshold' | 'performance_threshold' | 'api_latency' | 'error_rate'
  conditions: {
    threshold: number
    timeWindow: number // in milliseconds
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
    metric?: string
    severity?: ErrorSeverity
    category?: ErrorCategory
  }
  actions: {
    notify: boolean
    email?: string
    webhook?: string
    slack?: string
  }
  isActive: boolean
  createdAt: Date
  lastTriggered?: Date
}

export interface AlertNotification {
  id: string
  ruleId: string
  ruleName: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  data: Record<string, any>
  triggeredAt: Date
  acknowledged: boolean
  acknowledgedAt?: Date
  acknowledgedBy?: string
}

class AlertingService {
  private static instance: AlertingService
  private rules: Map<string, AlertRule> = new Map()
  private notifications: AlertNotification[] = []
  private checkInterval: NodeJS.Timeout | null = null
  private subscribers: ((notification: AlertNotification) => void)[] = []

  private constructor() {
    this.initializeDefaultRules()
  }

  static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService()
    }
    return AlertingService.instance
  }

  private initializeDefaultRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: 'error_rate',
        conditions: {
          threshold: 5, // 5% error rate
          timeWindow: 300000, // 5 minutes
          operator: 'gt'
        },
        actions: {
          notify: true
        },
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'critical-errors',
        name: 'Critical Errors',
        type: 'error_threshold',
        conditions: {
          threshold: 1, // 1 critical error
          timeWindow: 60000, // 1 minute
          operator: 'gte',
          severity: ErrorSeverity.CRITICAL
        },
        actions: {
          notify: true
        },
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'api-latency',
        name: 'High API Latency',
        type: 'api_latency',
        conditions: {
          threshold: 3000, // 3 seconds
          timeWindow: 300000, // 5 minutes
          operator: 'gt'
        },
        actions: {
          notify: true
        },
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'performance-degradation',
        name: 'Performance Degradation',
        type: 'performance_threshold',
        conditions: {
          threshold: 2000, // 2 seconds render time
          timeWindow: 600000, // 10 minutes
          operator: 'gt',
          metric: 'render_time'
        },
        actions: {
          notify: true
        },
        isActive: true,
        createdAt: new Date()
      }
    ]

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule)
    })
  }

  public startMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(() => {
      this.checkAllRules()
    }, 30000) // Check every 30 seconds
  }

  public stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private async checkAllRules() {
    for (const rule of this.rules.values()) {
      if (rule.isActive) {
        await this.checkRule(rule)
      }
    }
  }

  private async checkRule(rule: AlertRule) {
    try {
      const now = Date.now()
      const windowStart = now - rule.conditions.timeWindow

      switch (rule.type) {
        case 'error_threshold':
          await this.checkErrorThreshold(rule, windowStart, now)
          break
        case 'error_rate':
          await this.checkErrorRate(rule, windowStart, now)
          break
        case 'api_latency':
          await this.checkApiLatency(rule, windowStart, now)
          break
        case 'performance_threshold':
          await this.checkPerformanceThreshold(rule, windowStart, now)
          break
      }
    } catch (error) {
      console.error(`Error checking rule ${rule.id}:`, error)
    }
  }

  private async checkErrorThreshold(rule: AlertRule, windowStart: number, now: number) {
    const errors = errorService.getRecentErrors()
    const relevantErrors = errors.filter(error => {
      const errorTime = error.timestamp.getTime()
      if (errorTime < windowStart || errorTime > now) return false
      
      if (rule.conditions.severity && error.severity !== rule.conditions.severity) return false
      if (rule.conditions.category && error.category !== rule.conditions.category) return false
      
      return true
    })

    const count = relevantErrors.length
    const shouldTrigger = this.evaluateCondition(count, rule.conditions.threshold, rule.conditions.operator)

    if (shouldTrigger && this.shouldTriggerAlert(rule, now)) {
      await this.triggerAlert(rule, {
        count,
        threshold: rule.conditions.threshold,
        timeWindow: rule.conditions.timeWindow,
        errors: relevantErrors.slice(0, 5) // Include first 5 errors
      })
    }
  }

  private async checkErrorRate(rule: AlertRule, windowStart: number, now: number) {
    const apiStats = metricsCollector.getAPIStats(rule.conditions.timeWindow)
    const errorRate = apiStats.errorRate

    const shouldTrigger = this.evaluateCondition(errorRate, rule.conditions.threshold, rule.conditions.operator)

    if (shouldTrigger && this.shouldTriggerAlert(rule, now)) {
      await this.triggerAlert(rule, {
        errorRate,
        threshold: rule.conditions.threshold,
        totalRequests: apiStats.totalRequests,
        timeWindow: rule.conditions.timeWindow
      })
    }
  }

  private async checkApiLatency(rule: AlertRule, windowStart: number, now: number) {
    const apiStats = metricsCollector.getAPIStats(rule.conditions.timeWindow)
    const avgLatency = apiStats.avgLatency

    const shouldTrigger = this.evaluateCondition(avgLatency, rule.conditions.threshold, rule.conditions.operator)

    if (shouldTrigger && this.shouldTriggerAlert(rule, now)) {
      await this.triggerAlert(rule, {
        avgLatency,
        p95Latency: apiStats.p95Latency,
        p99Latency: apiStats.p99Latency,
        threshold: rule.conditions.threshold,
        timeWindow: rule.conditions.timeWindow
      })
    }
  }

  private async checkPerformanceThreshold(rule: AlertRule, windowStart: number, now: number) {
    const metrics = metricsCollector.getMetrics(windowStart, now)
    const relevantMetrics = metrics.filter(m => 
      rule.conditions.metric ? m.name.includes(rule.conditions.metric) : true
    )

    if (relevantMetrics.length === 0) return

    const avgValue = relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length
    const shouldTrigger = this.evaluateCondition(avgValue, rule.conditions.threshold, rule.conditions.operator)

    if (shouldTrigger && this.shouldTriggerAlert(rule, now)) {
      await this.triggerAlert(rule, {
        avgValue,
        threshold: rule.conditions.threshold,
        metric: rule.conditions.metric,
        sampleCount: relevantMetrics.length,
        timeWindow: rule.conditions.timeWindow
      })
    }
  }

  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'eq': return value === threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      default: return false
    }
  }

  private shouldTriggerAlert(rule: AlertRule, now: number): boolean {
    // Prevent duplicate alerts within 5 minutes
    const cooldownPeriod = 300000 // 5 minutes
    return !rule.lastTriggered || (now - rule.lastTriggered.getTime()) > cooldownPeriod
  }

  private async triggerAlert(rule: AlertRule, data: Record<string, any>) {
    const notification: AlertNotification = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      message: this.generateAlertMessage(rule, data),
      severity: this.determineSeverity(rule, data),
      data,
      triggeredAt: new Date(),
      acknowledged: false
    }

    this.notifications.unshift(notification)
    
    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100)
    }

    // Update rule last triggered time
    rule.lastTriggered = new Date()

    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('Error notifying alert subscriber:', error)
      }
    })

    // Execute actions
    if (rule.actions.notify) {
      this.sendNotification(notification)
    }

    if (rule.actions.webhook) {
      this.sendWebhookNotification(rule.actions.webhook, notification)
    }

    console.warn(`🚨 ALERT: ${notification.message}`, data)
  }

  private generateAlertMessage(rule: AlertRule, data: Record<string, any>): string {
    switch (rule.type) {
      case 'error_threshold':
        return `${data.count} ${rule.conditions.severity || 'errors'} in ${rule.conditions.timeWindow / 1000}s (threshold: ${rule.conditions.threshold})`
      case 'error_rate':
        return `Error rate ${data.errorRate.toFixed(1)}% exceeds threshold ${rule.conditions.threshold}%`
      case 'api_latency':
        return `API latency ${Math.round(data.avgLatency)}ms exceeds threshold ${rule.conditions.threshold}ms`
      case 'performance_threshold':
        return `Performance metric ${rule.conditions.metric} ${Math.round(data.avgValue)}ms exceeds threshold ${rule.conditions.threshold}ms`
      default:
        return `Alert triggered for rule: ${rule.name}`
    }
  }

  private determineSeverity(rule: AlertRule, data: Record<string, any>): 'low' | 'medium' | 'high' | 'critical' {
    if (rule.conditions.severity === ErrorSeverity.CRITICAL) return 'critical'
    if (rule.conditions.severity === ErrorSeverity.HIGH) return 'high'
    if (rule.type === 'error_rate' && data.errorRate > 10) return 'high'
    if (rule.type === 'api_latency' && data.avgLatency > 5000) return 'high'
    return 'medium'
  }

  private sendNotification(notification: AlertNotification) {
    // In a real app, this would send to notification services
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`EVA Alert: ${notification.ruleName}`, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id
      })
    }
  }

  private async sendWebhookNotification(webhookUrl: string, notification: AlertNotification) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert: notification,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Failed to send webhook notification:', error)
    }
  }

  // Public API methods
  public addRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID()
    const newRule: AlertRule = {
      ...rule,
      id,
      createdAt: new Date()
    }
    this.rules.set(id, newRule)
    return id
  }

  public updateRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false
    
    this.rules.set(id, { ...rule, ...updates })
    return true
  }

  public deleteRule(id: string): boolean {
    return this.rules.delete(id)
  }

  public getRules(): AlertRule[] {
    return Array.from(this.rules.values())
  }

  public getNotifications(): AlertNotification[] {
    return [...this.notifications]
  }

  public acknowledgeAlert(id: string, acknowledgedBy?: string): boolean {
    const notification = this.notifications.find(n => n.id === id)
    if (!notification) return false
    
    notification.acknowledged = true
    notification.acknowledgedAt = new Date()
    notification.acknowledgedBy = acknowledgedBy
    return true
  }

  public subscribe(callback: (notification: AlertNotification) => void): () => void {
    this.subscribers.push(callback)
    return () => {
      const index = this.subscribers.indexOf(callback)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  public requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return Notification.requestPermission()
    }
    return Promise.resolve('denied')
  }
}

export const alertingService = AlertingService.getInstance()

// React hook for alerts
export function useAlerts() {
  const [notifications, setNotifications] = useState<AlertNotification[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])

  useEffect(() => {
    // Initialize
    setNotifications(alertingService.getNotifications())
    setRules(alertingService.getRules())

    // Subscribe to new alerts
    const unsubscribe = alertingService.subscribe((notification) => {
      setNotifications(prev => [notification, ...prev])
    })

    // Start monitoring
    alertingService.startMonitoring()

    return () => {
      unsubscribe()
      alertingService.stopMonitoring()
    }
  }, [])

  const acknowledgeAlert = (id: string) => {
    alertingService.acknowledgeAlert(id)
    setNotifications(prev => 
      prev.map(n => 
        n.id === id 
          ? { ...n, acknowledged: true, acknowledgedAt: new Date() }
          : n
      )
    )
  }

  const addRule = (rule: Omit<AlertRule, 'id' | 'createdAt'>) => {
    const id = alertingService.addRule(rule)
    setRules(alertingService.getRules())
    return id
  }

  const updateRule = (id: string, updates: Partial<AlertRule>) => {
    const success = alertingService.updateRule(id, updates)
    if (success) {
      setRules(alertingService.getRules())
    }
    return success
  }

  const deleteRule = (id: string) => {
    const success = alertingService.deleteRule(id)
    if (success) {
      setRules(alertingService.getRules())
    }
    return success
  }

  return {
    notifications,
    rules,
    acknowledgeAlert,
    addRule,
    updateRule,
    deleteRule
  }
}

// React hook imports
import { useEffect, useState } from 'react'