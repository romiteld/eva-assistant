import { useEffect, useState, useCallback } from 'react'
import { metricsCollector } from '@/lib/monitoring/metrics'
import { alertManager, checkMetrics } from '@/lib/monitoring/alerts'

interface MetricsData {
  apiStats: ReturnType<typeof metricsCollector.getAPIStats>
  dbStats: ReturnType<typeof metricsCollector.getDatabaseStats>
  systemMetrics: ReturnType<typeof metricsCollector.getSystemMetrics>
  alerts: ReturnType<typeof alertManager.getAlerts>
}

export function useMetrics(refreshInterval = 5000) {
  const [metrics, setMetrics] = useState<MetricsData>({
    apiStats: metricsCollector.getAPIStats(),
    dbStats: metricsCollector.getDatabaseStats(),
    systemMetrics: metricsCollector.getSystemMetrics(),
    alerts: alertManager.getAlerts()
  })

  const updateMetrics = useCallback(() => {
    const apiStats = metricsCollector.getAPIStats()
    const dbStats = metricsCollector.getDatabaseStats()
    const systemMetrics = metricsCollector.getSystemMetrics()
    const alerts = alertManager.getAlerts()

    // Check metrics against alert rules
    checkMetrics({
      errorRate: apiStats.errorRate,
      avgLatency: apiStats.avgLatency,
      slowQueries: dbStats.slowQueries,
      memoryUsage: systemMetrics[0]?.memory.percentage
    })

    setMetrics({
      apiStats,
      dbStats,
      systemMetrics,
      alerts
    })
  }, [])

  useEffect(() => {
    updateMetrics()
    const interval = setInterval(updateMetrics, refreshInterval)
    
    // Subscribe to alerts
    const unsubscribe = alertManager.subscribe(() => {
      updateMetrics()
    })

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [refreshInterval, updateMetrics])

  return metrics
}

// Hook to track API calls
export function useAPITracking() {
  const trackAPICall = useCallback((
    endpoint: string,
    method: string,
    status: number,
    duration: number,
    error?: string
  ) => {
    metricsCollector.collectAPIMetric({
      endpoint,
      method,
      status,
      duration,
      error
    })
  }, [])

  return { trackAPICall }
}

// Hook to track database queries
export function useDatabaseTracking() {
  const trackQuery = useCallback((
    query: string,
    duration: number,
    rowCount: number,
    error?: string
  ) => {
    metricsCollector.collectDatabaseMetric({
      query,
      duration,
      rowCount,
      error
    })
  }, [])

  return { trackQuery }
}