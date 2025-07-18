import { metricsCollector } from './metrics'
import { errorService, ErrorCategory, ErrorSeverity } from '@/lib/error-service'

export interface CoreWebVitalsMetrics {
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift
  fcp: number | null // First Contentful Paint
  ttfb: number | null // Time to First Byte
  inp: number | null // Interaction to Next Paint
}

export interface PerformanceThresholds {
  lcp: { good: number; poor: number }
  fid: { good: number; poor: number }
  cls: { good: number; poor: number }
  fcp: { good: number; poor: number }
  ttfb: { good: number; poor: number }
  inp: { good: number; poor: number }
}

// Google's Core Web Vitals thresholds
export const WEB_VITALS_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
  inp: { good: 200, poor: 500 }
}

export class CoreWebVitalsMonitor {
  private metrics: CoreWebVitalsMetrics = {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    inp: null
  }

  private observers: PerformanceObserver[] = []
  private isInitialized = false
  private onMetricUpdate?: (metric: string, value: number) => void

  constructor(onMetricUpdate?: (metric: string, value: number) => void) {
    this.onMetricUpdate = onMetricUpdate
  }

  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return
    
    this.isInitialized = true
    
    try {
      this.observeLCP()
      this.observeFID()
      this.observeCLS()
      this.observeFCP()
      this.observeINP()
      this.measureTTFB()
    } catch (error) {
      errorService.logError(
        error,
        ErrorCategory.UI,
        ErrorSeverity.LOW,
        { context: 'CoreWebVitalsMonitor.init' }
      )
    }
  }

  private observeLCP(): void {
    if (!('PerformanceObserver' in window)) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        const lcp = lastEntry.startTime
        
        this.updateMetric('lcp', lcp)
      })

      observer.observe({ entryTypes: ['largest-contentful-paint'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe LCP:', error)
    }
  }

  private observeFID(): void {
    if (!('PerformanceObserver' in window)) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const fid = (entry as any).processingStart - entry.startTime
          this.updateMetric('fid', fid)
        })
      })

      observer.observe({ entryTypes: ['first-input'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe FID:', error)
    }
  }

  private observeCLS(): void {
    if (!('PerformanceObserver' in window)) return

    try {
      let clsValue = 0
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
            this.updateMetric('cls', clsValue)
          }
        })
      })

      observer.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe CLS:', error)
    }
  }

  private observeFCP(): void {
    if (!('PerformanceObserver' in window)) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
        if (fcpEntry) {
          this.updateMetric('fcp', fcpEntry.startTime)
        }
      })

      observer.observe({ entryTypes: ['paint'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe FCP:', error)
    }
  }

  private observeINP(): void {
    if (!('PerformanceObserver' in window)) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const inp = (entry as any).processingStart - entry.startTime
          this.updateMetric('inp', inp)
        })
      })

      observer.observe({ entryTypes: ['event'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe INP:', error)
    }
  }

  private measureTTFB(): void {
    try {
      const navEntries = performance.getEntriesByType('navigation')
      if (navEntries.length > 0) {
        const navEntry = navEntries[0] as PerformanceNavigationTiming
        const ttfb = navEntry.responseStart - navEntry.requestStart
        this.updateMetric('ttfb', ttfb)
      }
    } catch (error) {
      console.warn('Failed to measure TTFB:', error)
    }
  }

  private updateMetric(metric: string, value: number): void {
    // Update internal state
    this.metrics[metric as keyof CoreWebVitalsMetrics] = value

    // Notify callback
    if (this.onMetricUpdate) {
      this.onMetricUpdate(metric, value)
    }

    // Collect metric
    metricsCollector.collectMetric({
      name: `core_web_vitals_${metric}`,
      value,
      unit: this.getMetricUnit(metric),
      tags: { type: 'core-web-vitals', metric }
    })

    // Check thresholds and alert if needed
    this.checkThreshold(metric, value)
  }

  private getMetricUnit(metric: string): string {
    switch (metric) {
      case 'cls':
        return 'score'
      case 'fid':
      case 'lcp':
      case 'fcp':
      case 'ttfb':
      case 'inp':
        return 'ms'
      default:
        return 'unit'
    }
  }

  private checkThreshold(metric: string, value: number): void {
    const thresholds = WEB_VITALS_THRESHOLDS[metric as keyof PerformanceThresholds]
    if (!thresholds) return

    let severity = ErrorSeverity.LOW
    let message = ''

    if (value > thresholds.poor) {
      severity = ErrorSeverity.HIGH
      message = `Poor ${metric.toUpperCase()} performance: ${value}${this.getMetricUnit(metric)} (threshold: ${thresholds.poor})`
    } else if (value > thresholds.good) {
      severity = ErrorSeverity.MEDIUM
      message = `Needs improvement ${metric.toUpperCase()} performance: ${value}${this.getMetricUnit(metric)} (threshold: ${thresholds.good})`
    }

    if (message) {
      errorService.logError(
        new Error(message),
        ErrorCategory.UI,
        severity,
        {
          metric,
          value,
          thresholds,
          url: window.location.href
        }
      )
    }
  }

  public getMetrics(): CoreWebVitalsMetrics {
    return { ...this.metrics }
  }

  public getPerformanceScore(): number {
    const metrics = this.getMetrics()
    let score = 0
    let count = 0

    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== null) {
        const thresholds = WEB_VITALS_THRESHOLDS[key as keyof PerformanceThresholds]
        if (thresholds) {
          let metricScore = 100
          if (value > thresholds.poor) {
            metricScore = 0
          } else if (value > thresholds.good) {
            metricScore = 50
          }
          score += metricScore
          count++
        }
      }
    })

    return count > 0 ? Math.round(score / count) : 0
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.isInitialized = false
  }
}

// Global instance
export const coreWebVitalsMonitor = new CoreWebVitalsMonitor()

// Hook for React components
export function useCoreWebVitals() {
  const [metrics, setMetrics] = useState<CoreWebVitalsMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    inp: null
  })

  const [performanceScore, setPerformanceScore] = useState<number>(0)

  useEffect(() => {
    const monitor = new CoreWebVitalsMonitor((metric, value) => {
      setMetrics(prev => ({ ...prev, [metric]: value }))
      setPerformanceScore(monitor.getPerformanceScore())
    })

    monitor.init()

    return () => monitor.destroy()
  }, [])

  return {
    metrics,
    performanceScore,
    isGood: performanceScore >= 90,
    needsImprovement: performanceScore >= 50 && performanceScore < 90,
    isPoor: performanceScore < 50
  }
}

// React hook imports
import { useEffect, useState } from 'react'