import { NextRequest, NextResponse } from 'next/server'
import { createTrackedHandler } from '@/lib/monitoring/api-tracker'
import { metricsCollector } from '@/lib/monitoring/metrics'
import { alertManager } from '@/lib/monitoring/alerts'

export const GET = createTrackedHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const timeWindow = parseInt(searchParams.get('timeWindow') || '3600000') // Default 1 hour
  const includeRaw = searchParams.get('includeRaw') === 'true'
  
  const now = Date.now()
  const startTime = now - timeWindow
  
  // Get all metrics
  const apiMetrics = metricsCollector.getAPIMetrics(startTime, now)
  const dbMetrics = metricsCollector.getDatabaseMetrics(startTime, now)
  const systemMetrics = metricsCollector.getSystemMetrics(startTime, now)
  const performanceMetrics = metricsCollector.getMetrics(startTime, now)
  
  // Get aggregated stats
  const apiStats = metricsCollector.getAPIStats(timeWindow)
  const dbStats = metricsCollector.getDatabaseStats(timeWindow)
  
  // Get alerts
  const activeAlerts = alertManager.getAlerts(false)
  const allAlerts = alertManager.getAlerts(true)
  
  // Calculate additional insights
  const insights = {
    api: {
      mostFrequentEndpoints: getMostFrequentEndpoints(apiMetrics),
      slowestEndpoints: getSlowestEndpoints(apiMetrics),
      errorProne: getErrorProneEndpoints(apiMetrics)
    },
    database: {
      slowQueries: dbMetrics.filter(m => m.duration > 1000),
      failedQueries: dbMetrics.filter(m => m.error),
      queryTypes: getQueryTypeDistribution(dbMetrics)
    },
    system: {
      avgCpuUsage: systemMetrics.length > 0 
        ? systemMetrics.reduce((sum, m) => sum + m.cpu, 0) / systemMetrics.length 
        : 0,
      avgMemoryUsage: systemMetrics.length > 0 
        ? systemMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / systemMetrics.length 
        : 0,
      memoryTrend: getMemoryTrend(systemMetrics)
    }
  }
  
  const response = {
    summary: {
      api: apiStats,
      database: dbStats,
      alerts: {
        active: activeAlerts.length,
        total: allAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        resolved: allAlerts.filter(a => a.resolved).length
      }
    },
    insights,
    currentAlerts: activeAlerts,
    ...(includeRaw && {
      raw: {
        api: apiMetrics,
        database: dbMetrics,
        system: systemMetrics,
        performance: performanceMetrics
      }
    })
  }
  
  return NextResponse.json(response)
})

function getMostFrequentEndpoints(metrics: ReturnType<typeof metricsCollector.getAPIMetrics>) {
  const counts = new Map<string, number>()
  
  metrics.forEach(m => {
    const key = `${m.method} ${m.endpoint}`
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }))
}

function getSlowestEndpoints(metrics: ReturnType<typeof metricsCollector.getAPIMetrics>) {
  const avgDurations = new Map<string, { total: number, count: number }>()
  
  metrics.forEach(m => {
    const key = `${m.method} ${m.endpoint}`
    const current = avgDurations.get(key) || { total: 0, count: 0 }
    avgDurations.set(key, {
      total: current.total + m.duration,
      count: current.count + 1
    })
  })
  
  return Array.from(avgDurations.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      avgDuration: data.total / data.count
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 5)
}

function getErrorProneEndpoints(metrics: ReturnType<typeof metricsCollector.getAPIMetrics>) {
  const errorCounts = new Map<string, { errors: number, total: number }>()
  
  metrics.forEach(m => {
    const key = `${m.method} ${m.endpoint}`
    const current = errorCounts.get(key) || { errors: 0, total: 0 }
    errorCounts.set(key, {
      errors: current.errors + (m.status >= 400 ? 1 : 0),
      total: current.total + 1
    })
  })
  
  return Array.from(errorCounts.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      errorRate: (data.errors / data.total) * 100,
      errors: data.errors,
      total: data.total
    }))
    .filter(e => e.errors > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5)
}

function getQueryTypeDistribution(metrics: ReturnType<typeof metricsCollector.getDatabaseMetrics>) {
  const types = new Map<string, number>()
  
  metrics.forEach(m => {
    const type = m.query.split(' ')[0].toUpperCase()
    types.set(type, (types.get(type) || 0) + 1)
  })
  
  return Object.fromEntries(types)
}

function getMemoryTrend(metrics: ReturnType<typeof metricsCollector.getSystemMetrics>) {
  if (metrics.length < 2) return 'stable'
  
  const recent = metrics.slice(-5)
  const older = metrics.slice(-10, -5)
  
  if (recent.length === 0 || older.length === 0) return 'stable'
  
  const recentAvg = recent.reduce((sum, m) => sum + m.memory.percentage, 0) / recent.length
  const olderAvg = older.reduce((sum, m) => sum + m.memory.percentage, 0) / older.length
  
  if (recentAvg > olderAvg * 1.1) return 'increasing'
  if (recentAvg < olderAvg * 0.9) return 'decreasing'
  return 'stable'
}