import { NextRequest, NextResponse } from 'next/server'
import { metricsCollector } from './metrics'

// Middleware to track API metrics
export async function withMetrics<T>(
  request: NextRequest,
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  const start = performance.now()
  const endpoint = request.nextUrl.pathname
  const method = request.method
  
  try {
    const response = await handler()
    const duration = performance.now() - start
    
    // Track the metric
    metricsCollector.collectAPIMetric({
      endpoint,
      method,
      status: response.status,
      duration
    })
    
    // Add timing header
    response.headers.set('X-Response-Time', `${Math.round(duration)}ms`)
    
    return response
  } catch (error) {
    const duration = performance.now() - start
    
    // Track the error metric
    metricsCollector.collectAPIMetric({
      endpoint,
      method,
      status: 500,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    throw error
  }
}

// Database query tracker
export async function trackDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  
  try {
    const result = await queryFn()
    const duration = performance.now() - start
    
    // Estimate row count (would need actual count from query result)
    const rowCount = Array.isArray(result) ? result.length : 1
    
    metricsCollector.collectDatabaseMetric({
      query: queryName,
      duration,
      rowCount
    })
    
    return result
  } catch (error) {
    const duration = performance.now() - start
    
    metricsCollector.collectDatabaseMetric({
      query: queryName,
      duration,
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Query failed'
    })
    
    throw error
  }
}

// Helper to create tracked API route handlers
export function createTrackedHandler<T>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    return withMetrics(req, () => handler(req))
  }
}