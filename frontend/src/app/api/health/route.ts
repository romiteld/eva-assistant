import { NextRequest, NextResponse } from 'next/server'
import { createTrackedHandler } from '@/lib/monitoring/api-tracker'
import { metricsCollector } from '@/lib/monitoring/metrics'

export const GET = createTrackedHandler<any>(async (req: NextRequest) => {
  try {
    // Collect system metrics
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    metricsCollector.collectSystemMetric({
      cpu: Math.random() * 100, // In a real app, calculate actual CPU usage
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      }
    })
    
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'eva-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
      }
    }

    return NextResponse.json(health, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
})