import { supabase } from './browser'
import { metricsCollector } from '@/lib/monitoring/metrics'

// Create a tracked version of Supabase client
export function createTrackedClient() {
  // Create a proxy to intercept database operations
  return new Proxy(supabase, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const query = target.from(table)
          
          // Wrap common query methods
          return new Proxy(query, {
            get(queryTarget, queryProp) {
              const originalMethod = queryTarget[queryProp as keyof typeof queryTarget]
              
              if (typeof originalMethod === 'function') {
                return (...args: any[]) => {
                  const start = performance.now()
                  const result = (originalMethod as any).apply(queryTarget, args)
                  
                  // Track async operations
                  if (result && typeof result.then === 'function') {
                    return result.then(
                      (response: any) => {
                        const duration = performance.now() - start
                        const operation = queryProp.toString().toUpperCase()
                        
                        metricsCollector.collectDatabaseMetric({
                          query: `${operation} ${table}`,
                          duration,
                          rowCount: response?.data?.length || (response?.data ? 1 : 0),
                          error: response?.error?.message
                        })
                        
                        return response
                      },
                      (error: any) => {
                        const duration = performance.now() - start
                        const operation = queryProp.toString().toUpperCase()
                        
                        metricsCollector.collectDatabaseMetric({
                          query: `${operation} ${table}`,
                          duration,
                          rowCount: 0,
                          error: error?.message || 'Query failed'
                        })
                        
                        throw error
                      }
                    )
                  }
                  
                  return result
                }
              }
              
              return originalMethod
            }
          })
        }
      }
      
      // Return other properties as is
      return target[prop as keyof typeof target]
    }
  })
}

// Export tracked client instance
export const trackedSupabase = createTrackedClient()