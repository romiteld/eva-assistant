import { Page, BrowserContext } from '@playwright/test'

export interface PerformanceMetrics {
  pageLoad: number
  domContentLoaded: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  totalBlockingTime: number
  cumulativeLayoutShift: number
  firstInputDelay?: number
  timeToInteractive: number
  totalJSHeapSize?: number
  usedJSHeapSize?: number
  apiCalls: APICallMetric[]
  resourceTimings: ResourceTiming[]
}

export interface APICallMetric {
  url: string
  method: string
  duration: number
  status: number
  size: number
}

export interface ResourceTiming {
  name: string
  type: string
  duration: number
  size: number
}

export class PerformanceCollector {
  private apiCalls: APICallMetric[] = []
  
  constructor(private page: Page) {}
  
  async initialize() {
    // Intercept API calls
    await this.page.route('**/api/**', async (route, request) => {
      const startTime = Date.now()
      const response = await route.fetch()
      const endTime = Date.now()
      
      const responseBody = await response.body()
      
      this.apiCalls.push({
        url: request.url(),
        method: request.method(),
        duration: endTime - startTime,
        status: response.status(),
        size: responseBody.length
      })
      
      await route.fulfill({ response })
    })
    
    // Inject performance monitoring
    await this.page.addInitScript(() => {
      (window as any).__performanceMetrics = {
        marks: {},
        measures: {}
      }
      
      // Override performance.mark
      const originalMark = window.performance.mark.bind(window.performance)
      window.performance.mark = function(name) {
        (window as any).__performanceMetrics.marks[name] = performance.now()
        return originalMark(name)
      }
      
      // Override performance.measure  
      const originalMeasure = window.performance.measure.bind(window.performance)
      window.performance.measure = function(name, start, end) {
        const result = originalMeasure(name, start, end)
        (window as any).__performanceMetrics.measures[name] = {
          start: (window as any).__performanceMetrics.marks[start] || 0,
          end: (window as any).__performanceMetrics.marks[end] || performance.now(),
          duration: ((window as any).__performanceMetrics.marks[end] || performance.now()) - 
                   ((window as any).__performanceMetrics.marks[start] || 0)
        }
        return result
      }
    })
  }
  
  async collectMetrics(): Promise<PerformanceMetrics> {
    // Get navigation timing
    const navigationTiming = await this.page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        pageLoad: timing.loadEventEnd - timing.fetchStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.fetchStart,
        responseTime: timing.responseEnd - timing.requestStart
      }
    })
    
    // Get paint timing
    const paintTiming = await this.page.evaluate(() => {
      const paints = performance.getEntriesByType('paint')
      const fcp = paints.find(p => p.name === 'first-contentful-paint')
      return {
        firstContentfulPaint: fcp ? fcp.startTime : 0
      }
    })
    
    // Get Largest Contentful Paint
    const lcp = await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          lcpValue = lastEntry.startTime
        })
        observer.observe({ entryTypes: ['largest-contentful-paint'] })
        
        // Wait for page to stabilize
        setTimeout(() => {
          observer.disconnect()
          resolve(lcpValue)
        }, 2000)
      })
    })
    
    // Get Cumulative Layout Shift
    const cls = await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        })
        observer.observe({ entryTypes: ['layout-shift'] })
        
        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 2000)
      })
    })
    
    // Get Total Blocking Time
    const tbt = await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let totalBlockingTime = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              totalBlockingTime += entry.duration - 50
            }
          }
        })
        observer.observe({ entryTypes: ['longtask'] })
        
        setTimeout(() => {
          observer.disconnect()
          resolve(totalBlockingTime)
        }, 2000)
      })
    })
    
    // Get Time to Interactive
    const tti = await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        if ('PerformanceObserver' in window) {
          let tti = 0
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'TimeToInteractive') {
                tti = entry.startTime
              }
            }
          })
          try {
            observer.observe({ entryTypes: ['measure'] })
          } catch (e) {
            // Fallback: estimate TTI as DOM ready + 500ms
            tti = performance.timing.domInteractive - performance.timing.navigationStart + 500
          }
          
          setTimeout(() => {
            if (tti === 0) {
              tti = performance.timing.domInteractive - performance.timing.navigationStart + 500
            }
            observer.disconnect()
            resolve(tti)
          }, 2000)
        } else {
          resolve(performance.timing.domInteractive - performance.timing.navigationStart + 500)
        }
      })
    })
    
    // Get memory usage (Chrome only)
    const memoryUsage = await this.page.evaluate(() => {
      if ('memory' in performance) {
        return {
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize
        }
      }
      return {}
    })
    
    // Get resource timings
    const resourceTimings = await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      return resources.map(r => ({
        name: r.name,
        type: r.initiatorType,
        duration: r.duration,
        size: r.transferSize || 0
      })).filter(r => r.duration > 0)
    })
    
    return {
      pageLoad: navigationTiming.pageLoad,
      domContentLoaded: navigationTiming.domContentLoaded,
      firstContentfulPaint: paintTiming.firstContentfulPaint,
      largestContentfulPaint: lcp,
      totalBlockingTime: tbt,
      cumulativeLayoutShift: cls,
      timeToInteractive: tti,
      totalJSHeapSize: memoryUsage.totalJSHeapSize,
      usedJSHeapSize: memoryUsage.usedJSHeapSize,
      apiCalls: this.apiCalls,
      resourceTimings
    }
  }
  
  generateReport(metrics: PerformanceMetrics): string {
    const report = [`
Performance Test Report
======================

Core Web Vitals:
- Largest Contentful Paint (LCP): ${metrics.largestContentfulPaint.toFixed(2)}ms ${this.getStatus(metrics.largestContentfulPaint, 2500, 4000)}
- First Contentful Paint (FCP): ${metrics.firstContentfulPaint.toFixed(2)}ms ${this.getStatus(metrics.firstContentfulPaint, 1800, 3000)}
- Total Blocking Time (TBT): ${metrics.totalBlockingTime.toFixed(2)}ms ${this.getStatus(metrics.totalBlockingTime, 200, 600)}
- Cumulative Layout Shift (CLS): ${metrics.cumulativeLayoutShift.toFixed(3)} ${this.getStatus(metrics.cumulativeLayoutShift, 0.1, 0.25)}
- Time to Interactive (TTI): ${metrics.timeToInteractive.toFixed(2)}ms ${this.getStatus(metrics.timeToInteractive, 3800, 7300)}

Page Load Metrics:
- Page Load Time: ${metrics.pageLoad.toFixed(2)}ms
- DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms
`]
    
    if (metrics.totalJSHeapSize) {
      report.push(`
Memory Usage:
- Total JS Heap Size: ${(metrics.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB
- Used JS Heap Size: ${(metrics.usedJSHeapSize! / 1024 / 1024).toFixed(2)}MB
- Memory Usage: ${((metrics.usedJSHeapSize! / metrics.totalJSHeapSize) * 100).toFixed(1)}%
`)
    }
    
    if (metrics.apiCalls.length > 0) {
      report.push(`
API Call Performance:
${metrics.apiCalls.map(call => 
  `- ${call.method} ${call.url}: ${call.duration}ms (${call.status}) - ${(call.size / 1024).toFixed(1)}KB`
).join('\n')}

Average API Response Time: ${(metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / metrics.apiCalls.length).toFixed(2)}ms
`)
    }
    
    // Resource analysis
    const resourcesByType = metrics.resourceTimings.reduce((acc, r) => {
      if (!acc[r.type]) acc[r.type] = { count: 0, totalSize: 0, totalDuration: 0 }
      acc[r.type].count++
      acc[r.type].totalSize += r.size
      acc[r.type].totalDuration += r.duration
      return acc
    }, {} as Record<string, { count: number; totalSize: number; totalDuration: number }>)
    
    report.push(`
Resource Loading:
${Object.entries(resourcesByType).map(([type, data]) => 
  `- ${type}: ${data.count} files, ${(data.totalSize / 1024).toFixed(1)}KB, avg ${(data.totalDuration / data.count).toFixed(2)}ms`
).join('\n')}

Total Resources: ${metrics.resourceTimings.length}
Total Size: ${(metrics.resourceTimings.reduce((sum, r) => sum + r.size, 0) / 1024).toFixed(1)}KB
`)
    
    return report.join('\n')
  }
  
  private getStatus(value: number, good: number, poor: number): string {
    if (value <= good) return '✅ Good'
    if (value <= poor) return '⚠️ Needs Improvement'
    return '❌ Poor'
  }
}

export async function measurePerformance(
  page: Page,
  url: string,
  name: string
): Promise<PerformanceMetrics> {
  const collector = new PerformanceCollector(page)
  await collector.initialize()
  
  // Navigate and wait for network idle
  await page.goto(url, { waitUntil: 'networkidle' })
  
  // Wait a bit more for any async operations
  await page.waitForTimeout(2000)
  
  const metrics = await collector.collectMetrics()
  
  console.log(`\n${name} Performance Metrics:`)
  console.log(collector.generateReport(metrics))
  
  return metrics
}