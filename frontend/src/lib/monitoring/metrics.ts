// Performance metrics collection and storage
export interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
}

export interface APIMetric {
  endpoint: string
  method: string
  status: number
  duration: number
  timestamp: number
  error?: string
}

export interface DatabaseMetric {
  query: string
  duration: number
  rowCount: number
  timestamp: number
  error?: string
}

export interface SystemMetric {
  cpu: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  timestamp: number
}

class MetricsCollector {
  private metrics: PerformanceMetric[] = []
  private apiMetrics: APIMetric[] = []
  private dbMetrics: DatabaseMetric[] = []
  private systemMetrics: SystemMetric[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics of each type

  // Collect generic performance metric
  collectMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) {
    const newMetric: PerformanceMetric = {
      ...metric,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    }
    
    this.metrics.push(newMetric)
    this.trimMetrics()
  }

  // Collect API metric
  collectAPIMetric(metric: Omit<APIMetric, 'timestamp'>) {
    const newMetric: APIMetric = {
      ...metric,
      timestamp: Date.now()
    }
    
    this.apiMetrics.push(newMetric)
    this.trimMetrics()
  }

  // Collect database metric
  collectDatabaseMetric(metric: Omit<DatabaseMetric, 'timestamp'>) {
    const newMetric: DatabaseMetric = {
      ...metric,
      timestamp: Date.now()
    }
    
    this.dbMetrics.push(newMetric)
    this.trimMetrics()
  }

  // Collect system metric
  collectSystemMetric(metric: Omit<SystemMetric, 'timestamp'>) {
    const newMetric: SystemMetric = {
      ...metric,
      timestamp: Date.now()
    }
    
    this.systemMetrics.push(newMetric)
    this.trimMetrics()
  }

  // Get metrics for a time range
  getMetrics(startTime?: number, endTime?: number): PerformanceMetric[] {
    return this.filterByTime(this.metrics, startTime, endTime)
  }

  getAPIMetrics(startTime?: number, endTime?: number): APIMetric[] {
    return this.filterByTime(this.apiMetrics, startTime, endTime)
  }

  getDatabaseMetrics(startTime?: number, endTime?: number): DatabaseMetric[] {
    return this.filterByTime(this.dbMetrics, startTime, endTime)
  }

  getSystemMetrics(startTime?: number, endTime?: number): SystemMetric[] {
    return this.filterByTime(this.systemMetrics, startTime, endTime)
  }

  // Calculate API statistics
  getAPIStats(timeWindow: number = 3600000) { // Default 1 hour
    const now = Date.now()
    const metrics = this.getAPIMetrics(now - timeWindow, now)
    
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        avgLatency: 0,
        errorRate: 0,
        successRate: 0,
        p95Latency: 0,
        p99Latency: 0
      }
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
    const errors = metrics.filter(m => m.status >= 400).length
    
    return {
      totalRequests: metrics.length,
      avgLatency: durations.reduce((a, b) => a + b, 0) / durations.length,
      errorRate: (errors / metrics.length) * 100,
      successRate: ((metrics.length - errors) / metrics.length) * 100,
      p95Latency: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Latency: durations[Math.floor(durations.length * 0.99)] || 0
    }
  }

  // Calculate database statistics
  getDatabaseStats(timeWindow: number = 3600000) {
    const now = Date.now()
    const metrics = this.getDatabaseMetrics(now - timeWindow, now)
    
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        avgDuration: 0,
        slowQueries: 0,
        errorRate: 0
      }
    }

    const durations = metrics.map(m => m.duration)
    const errors = metrics.filter(m => m.error).length
    const slowQueries = metrics.filter(m => m.duration > 1000).length // > 1 second
    
    return {
      totalQueries: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      slowQueries,
      errorRate: (errors / metrics.length) * 100
    }
  }

  // Clear all metrics
  clearMetrics() {
    this.metrics = []
    this.apiMetrics = []
    this.dbMetrics = []
    this.systemMetrics = []
  }

  private filterByTime<T extends { timestamp: number }>(
    metrics: T[],
    startTime?: number,
    endTime?: number
  ): T[] {
    if (!startTime && !endTime) return metrics
    
    return metrics.filter(m => {
      if (startTime && m.timestamp < startTime) return false
      if (endTime && m.timestamp > endTime) return false
      return true
    })
  }

  private trimMetrics() {
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics)
    }
    if (this.dbMetrics.length > this.maxMetrics) {
      this.dbMetrics = this.dbMetrics.slice(-this.maxMetrics)
    }
    if (this.systemMetrics.length > this.maxMetrics) {
      this.systemMetrics = this.systemMetrics.slice(-this.maxMetrics)
    }
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector()

// Helper function to measure async operation duration
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = performance.now()
  
  try {
    const result = await operation()
    const duration = performance.now() - start
    
    metricsCollector.collectMetric({
      name,
      value: duration,
      unit: 'ms',
      tags: { ...tags, status: 'success' }
    })
    
    return result
  } catch (error) {
    const duration = performance.now() - start
    
    metricsCollector.collectMetric({
      name,
      value: duration,
      unit: 'ms',
      tags: { ...tags, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
    })
    
    throw error
  }
}