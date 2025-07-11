// Alert system for monitoring critical issues
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum AlertCategory {
  PERFORMANCE = 'performance',
  AVAILABILITY = 'availability',
  ERROR_RATE = 'error_rate',
  SECURITY = 'security',
  RESOURCE = 'resource',
  CUSTOM = 'custom'
}

export interface Alert {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  category: AlertCategory
  timestamp: number
  metadata?: Record<string, any>
  resolved: boolean
  resolvedAt?: number
}

export interface AlertRule {
  id: string
  name: string
  description: string
  category: AlertCategory
  enabled: boolean
  condition: (value: number) => boolean
  threshold: number
  severity: AlertSeverity
  cooldown: number // Time in ms before the same alert can be triggered again
  lastTriggered?: number
}

class AlertManager {
  private alerts: Alert[] = []
  private rules: Map<string, AlertRule> = new Map()
  private alertHandlers: ((alert: Alert) => void)[] = []
  private maxAlerts = 100

  constructor() {
    this.initializeDefaultRules()
  }

  private initializeDefaultRules() {
    // High API error rate
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'API error rate exceeds 10%',
      category: AlertCategory.ERROR_RATE,
      enabled: true,
      condition: (value) => value > 10,
      threshold: 10,
      severity: AlertSeverity.ERROR,
      cooldown: 300000 // 5 minutes
    })

    // Critical error rate
    this.addRule({
      id: 'critical-error-rate',
      name: 'Critical Error Rate',
      description: 'API error rate exceeds 50%',
      category: AlertCategory.ERROR_RATE,
      enabled: true,
      condition: (value) => value > 50,
      threshold: 50,
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000
    })

    // High API latency
    this.addRule({
      id: 'high-latency',
      name: 'High API Latency',
      description: 'Average API latency exceeds 2 seconds',
      category: AlertCategory.PERFORMANCE,
      enabled: true,
      condition: (value) => value > 2000,
      threshold: 2000,
      severity: AlertSeverity.WARNING,
      cooldown: 300000
    })

    // Critical API latency
    this.addRule({
      id: 'critical-latency',
      name: 'Critical API Latency',
      description: 'Average API latency exceeds 5 seconds',
      category: AlertCategory.PERFORMANCE,
      enabled: true,
      condition: (value) => value > 5000,
      threshold: 5000,
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000
    })

    // Database slow queries
    this.addRule({
      id: 'db-slow-queries',
      name: 'Database Slow Queries',
      description: 'More than 5 slow queries in the last hour',
      category: AlertCategory.PERFORMANCE,
      enabled: true,
      condition: (value) => value > 5,
      threshold: 5,
      severity: AlertSeverity.WARNING,
      cooldown: 600000 // 10 minutes
    })

    // High memory usage
    this.addRule({
      id: 'high-memory',
      name: 'High Memory Usage',
      description: 'Memory usage exceeds 85%',
      category: AlertCategory.RESOURCE,
      enabled: true,
      condition: (value) => value > 85,
      threshold: 85,
      severity: AlertSeverity.WARNING,
      cooldown: 300000
    })

    // Critical memory usage
    this.addRule({
      id: 'critical-memory',
      name: 'Critical Memory Usage',
      description: 'Memory usage exceeds 95%',
      category: AlertCategory.RESOURCE,
      enabled: true,
      condition: (value) => value > 95,
      threshold: 95,
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000
    })
  }

  // Add a custom rule
  addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule)
  }

  // Remove a rule
  removeRule(ruleId: string) {
    this.rules.delete(ruleId)
  }

  // Enable/disable a rule
  toggleRule(ruleId: string, enabled: boolean) {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = enabled
    }
  }

  // Check a value against a specific rule
  checkRule(ruleId: string, value: number, metadata?: Record<string, any>) {
    const rule = this.rules.get(ruleId)
    if (!rule || !rule.enabled) return

    // Check cooldown
    if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldown) {
      return
    }

    // Check condition
    if (rule.condition(value)) {
      const alert: Alert = {
        id: crypto.randomUUID(),
        title: rule.name,
        message: `${rule.description}. Current value: ${value}`,
        severity: rule.severity,
        category: rule.category,
        timestamp: Date.now(),
        metadata: { ...metadata, value, threshold: rule.threshold },
        resolved: false
      }

      this.createAlert(alert)
      rule.lastTriggered = Date.now()
    }
  }

  // Create a custom alert
  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>) {
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      resolved: false
    }

    this.alerts.unshift(newAlert)
    this.trimAlerts()
    
    // Notify all handlers
    this.alertHandlers.forEach(handler => handler(newAlert))
    
    return newAlert
  }

  // Resolve an alert
  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = Date.now()
    }
  }

  // Get all alerts
  getAlerts(includeResolved = false): Alert[] {
    if (includeResolved) {
      return [...this.alerts]
    }
    return this.alerts.filter(a => !a.resolved)
  }

  // Get alerts by severity
  getAlertsBySeverity(severity: AlertSeverity, includeResolved = false): Alert[] {
    return this.getAlerts(includeResolved).filter(a => a.severity === severity)
  }

  // Get alerts by category
  getAlertsByCategory(category: AlertCategory, includeResolved = false): Alert[] {
    return this.getAlerts(includeResolved).filter(a => a.category === category)
  }

  // Subscribe to alerts
  subscribe(handler: (alert: Alert) => void) {
    this.alertHandlers.push(handler)
    
    // Return unsubscribe function
    return () => {
      const index = this.alertHandlers.indexOf(handler)
      if (index > -1) {
        this.alertHandlers.splice(index, 1)
      }
    }
  }

  // Clear all alerts
  clearAlerts() {
    this.alerts = []
  }

  // Get all rules
  getRules(): AlertRule[] {
    return Array.from(this.rules.values())
  }

  private trimAlerts() {
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts)
    }
  }
}

// Singleton instance
export const alertManager = new AlertManager()

// Helper function to check common metrics
export function checkMetrics(metrics: {
  errorRate?: number
  avgLatency?: number
  slowQueries?: number
  memoryUsage?: number
}) {
  if (metrics.errorRate !== undefined) {
    alertManager.checkRule('high-error-rate', metrics.errorRate)
    alertManager.checkRule('critical-error-rate', metrics.errorRate)
  }
  
  if (metrics.avgLatency !== undefined) {
    alertManager.checkRule('high-latency', metrics.avgLatency)
    alertManager.checkRule('critical-latency', metrics.avgLatency)
  }
  
  if (metrics.slowQueries !== undefined) {
    alertManager.checkRule('db-slow-queries', metrics.slowQueries)
  }
  
  if (metrics.memoryUsage !== undefined) {
    alertManager.checkRule('high-memory', metrics.memoryUsage)
    alertManager.checkRule('critical-memory', metrics.memoryUsage)
  }
}