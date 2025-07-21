'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { measurePerformance, detectMemoryLeaks, PERFORMANCE_BENCHMARKS } from '@/utils/bundle-analyzer'

interface PerformanceData {
  coreWebVitals: {
    LCP: number
    FID: number
    CLS: number
    FCP: number
    TTFB: number
  }
  bundleMetrics: {
    jsSize: number
    cssSize: number
    imageSize: number
    fontSize: number
    totalSize: number
  }
  renderingMetrics: {
    renderTime: number
    componentsCount: number
    rerendersCount: number
    memoryUsage: number
  }
  networkMetrics: {
    connectionType: string
    downlink: number
    effectiveType: string
    rtt: number
  }
  userMetrics: {
    deviceType: 'desktop' | 'mobile' | 'lowEnd'
    isSlowConnection: boolean
    prefersReducedMotion: boolean
  }
}

interface PerformanceAlert {
  type: 'warning' | 'error'
  metric: string
  current: number
  threshold: number
  message: string
  timestamp: number
}

export function useAnimationPerformance(componentName: string) {
  const [animationMetrics, setAnimationMetrics] = useState({
    duration: 0,
    fps: 0,
    droppedFrames: 0,
  })

  const measureAnimation = useCallback((animationFn: () => void) => {
    const startTime = performance.now()
    let frameCount = 0
    let lastFrame = startTime

    const frame = () => {
      const currentTime = performance.now()
      frameCount++
      
      if (currentTime - lastFrame >= 16) { // 60fps threshold
        const fps = 1000 / (currentTime - lastFrame)
        lastFrame = currentTime
        
        setAnimationMetrics(prev => ({
          ...prev,
          fps: Math.round(fps),
          duration: currentTime - startTime
        }))
      }
      
      if (currentTime - startTime < 1000) { // Measure for 1 second
        requestAnimationFrame(frame)
      }
    }

    animationFn()
    requestAnimationFrame(frame)
  }, [])

  return { animationMetrics, measureAnimation }
}

export function usePerformanceMonitor() {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const memoryLeakDetector = useRef<any>(null)
  const performanceObserver = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize performance monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return

    memoryLeakDetector.current = detectMemoryLeaks()
    startMonitoring()

    return () => {
      stopMonitoring()
    }
    // startMonitoring and stopMonitoring are defined below and only need to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return
    
    setIsMonitoring(true)
    
    // Initial measurement
    measureAndUpdate()
    
    // Set up periodic measurements
    intervalRef.current = setInterval(measureAndUpdate, 5000) // Every 5 seconds
    
    // Set up performance observers
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // Observe Core Web Vitals
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              updateWebVital('LCP', entry.startTime)
            } else if (entry.entryType === 'first-input') {
              const fidEntry = entry as PerformanceEventTiming
              updateWebVital('FID', fidEntry.processingStart - fidEntry.startTime)
            } else if (entry.entryType === 'layout-shift') {
              const clsEntry = entry as any // Layout shift entries don't have a standard type
              updateWebVital('CLS', clsEntry.value)
            }
          }
        })
        
        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
        performanceObserver.current = observer
      } catch (error) {
        console.warn('Performance Observer not supported:', error)
      }
    }
  }, [isMonitoring])

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false)
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    if (performanceObserver.current) {
      performanceObserver.current.disconnect()
      performanceObserver.current = null
    }
  }, [])

  const checkPerformanceThresholds = useCallback((data: PerformanceData) => {
    const benchmark = PERFORMANCE_BENCHMARKS[data.userMetrics.deviceType]
    const newAlerts: PerformanceAlert[] = []
    
    // Check render time
    if (data.renderingMetrics.renderTime > benchmark.maxRenderTime) {
      newAlerts.push({
        type: 'warning',
        metric: 'Render Time',
        current: data.renderingMetrics.renderTime,
        threshold: benchmark.maxRenderTime,
        message: `Render time exceeds ${benchmark.maxRenderTime}ms threshold`,
        timestamp: Date.now()
      })
    }
    
    // Check memory usage
    if (data.renderingMetrics.memoryUsage > benchmark.maxMemoryUsage) {
      newAlerts.push({
        type: 'error',
        metric: 'Memory Usage',
        current: data.renderingMetrics.memoryUsage,
        threshold: benchmark.maxMemoryUsage,
        message: `Memory usage exceeds ${(benchmark.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB threshold`,
        timestamp: Date.now()
      })
    }
    
    // Check LCP
    if (data.coreWebVitals.LCP > 2500) {
      newAlerts.push({
        type: 'warning',
        metric: 'LCP',
        current: data.coreWebVitals.LCP,
        threshold: 2500,
        message: 'Largest Contentful Paint is slower than 2.5s',
        timestamp: Date.now()
      })
    }
    
    // Check FID
    if (data.coreWebVitals.FID > 100) {
      newAlerts.push({
        type: 'warning',
        metric: 'FID',
        current: data.coreWebVitals.FID,
        threshold: 100,
        message: 'First Input Delay exceeds 100ms',
        timestamp: Date.now()
      })
    }
    
    // Check CLS
    if (data.coreWebVitals.CLS > 0.1) {
      newAlerts.push({
        type: 'warning',
        metric: 'CLS',
        current: data.coreWebVitals.CLS,
        threshold: 0.1,
        message: 'Cumulative Layout Shift exceeds 0.1',
        timestamp: Date.now()
      })
    }
    
    // Update alerts (keep only recent ones)
    setAlerts(prev => [
      ...newAlerts,
      ...prev.filter(alert => Date.now() - alert.timestamp < 60000) // Keep alerts for 1 minute
    ])
  }, [])

  const measureAndUpdate = useCallback(() => {
    try {
      const baseMetrics = measurePerformance()
      
      // Get network information
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      const networkMetrics = {
        connectionType: connection?.type || 'unknown',
        downlink: connection?.downlink || 0,
        effectiveType: connection?.effectiveType || 'unknown',
        rtt: connection?.rtt || 0
      }
      
      // Determine device type based on performance characteristics
      const deviceType = getDeviceType(baseMetrics, networkMetrics)
      
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      
      const newPerformanceData: PerformanceData = {
        ...baseMetrics,
        networkMetrics,
        userMetrics: {
          deviceType,
          isSlowConnection: networkMetrics.effectiveType === 'slow-2g' || networkMetrics.effectiveType === '2g',
          prefersReducedMotion
        }
      }
      
      setPerformanceData(newPerformanceData)
      
      // Check for performance issues
      checkPerformanceThresholds(newPerformanceData)
      
      // Check for memory leaks
      if (memoryLeakDetector.current) {
        memoryLeakDetector.current.checkMemoryUsage()
      }
      
    } catch (error) {
      console.error('Performance measurement failed:', error)
    }
  }, [checkPerformanceThresholds])

  const updateWebVital = useCallback((metric: string, value: number) => {
    setPerformanceData(prev => {
      if (!prev) return null
      
      return {
        ...prev,
        coreWebVitals: {
          ...prev.coreWebVitals,
          [metric]: value
        }
      }
    })
  }, [])

  const getDeviceType = (metrics: any, network: any): 'desktop' | 'mobile' | 'lowEnd' => {
    const memoryGB = (metrics.renderingMetrics.memoryUsage / 1024 / 1024 / 1024)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isSlowConnection = network.effectiveType === 'slow-2g' || network.effectiveType === '2g'
    
    if (isSlowConnection || memoryGB < 0.5 || (isMobile && network.downlink < 1.5)) {
      return 'lowEnd'
    } else if (isMobile) {
      return 'mobile'
    } else {
      return 'desktop'
    }
  }

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const getOptimizationSuggestions = useCallback(() => {
    if (!performanceData) return []
    
    const suggestions = []
    const { userMetrics, coreWebVitals, bundleMetrics } = performanceData
    
    // Device-specific suggestions
    if (userMetrics.deviceType === 'lowEnd') {
      suggestions.push('Consider reducing animations and visual effects for low-end devices')
      suggestions.push('Enable reduced motion mode automatically')
      suggestions.push('Implement progressive loading for heavy components')
    }
    
    if (userMetrics.isSlowConnection) {
      suggestions.push('Optimize images and use WebP format')
      suggestions.push('Implement lazy loading for non-critical resources')
      suggestions.push('Use compression for text-based assets')
    }
    
    // Core Web Vitals suggestions
    if (coreWebVitals.LCP > 2500) {
      suggestions.push('Optimize largest contentful paint by preloading critical resources')
      suggestions.push('Consider server-side rendering for above-the-fold content')
    }
    
    if (coreWebVitals.FID > 100) {
      suggestions.push('Reduce JavaScript execution time during page load')
      suggestions.push('Use web workers for heavy computations')
    }
    
    if (coreWebVitals.CLS > 0.1) {
      suggestions.push('Set explicit dimensions for images and videos')
      suggestions.push('Avoid inserting content above existing content')
    }
    
    // Bundle size suggestions
    if (bundleMetrics.jsSize > 500 * 1024) { // 500KB
      suggestions.push('Consider code splitting to reduce JavaScript bundle size')
      suggestions.push('Implement tree shaking to remove unused code')
    }
    
    return suggestions
  }, [performanceData])

  return {
    performanceData,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    getOptimizationSuggestions
  }
}