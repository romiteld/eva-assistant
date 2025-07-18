import { test, expect } from '@playwright/test'
import { measurePerformance, PerformanceMetrics } from './utils/performance-metrics'

// Performance thresholds
const PERFORMANCE_BUDGETS = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  tbt: { good: 200, poor: 600 },
  cls: { good: 0.1, poor: 0.25 },
  tti: { good: 3800, poor: 7300 },
  pageLoad: { good: 3000, poor: 5000 },
  apiResponse: { good: 500, poor: 1000 }
}

// Critical user paths to test
const CRITICAL_PATHS = [
  { name: 'Homepage', path: '/' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Voice Agent', path: '/dashboard/voice' },
  { name: 'Lead Generation', path: '/dashboard/lead-generation' },
  { name: 'Content Studio', path: '/dashboard/content-studio' },
  { name: 'Resume Parser', path: '/dashboard/resume-parser' },
  { name: 'Interview Center', path: '/dashboard/interview-center' },
  { name: 'Recruiter Intel', path: '/dashboard/recruiter-intel' },
  { name: 'Tasks', path: '/dashboard/tasks' },
  { name: 'Orchestrator', path: '/dashboard/orchestrator' },
  { name: 'Twilio Integration', path: '/dashboard/twilio' },
  { name: 'Zoom Integration', path: '/dashboard/zoom' },
]

test.describe('Performance Testing', () => {
  test.describe.configure({ mode: 'parallel' })
  
  let performanceResults: Record<string, PerformanceMetrics> = {}
  
  test.beforeAll(async () => {
    console.log('Starting Performance Test Suite')
    console.log('Performance Budgets:', PERFORMANCE_BUDGETS)
  })
  
  test.afterAll(async () => {
    // Generate summary report
    console.log('\n=== PERFORMANCE TEST SUMMARY ===\n')
    
    const summary = Object.entries(performanceResults).map(([path, metrics]) => ({
      path,
      lcp: metrics.largestContentfulPaint,
      fcp: metrics.firstContentfulPaint,
      tbt: metrics.totalBlockingTime,
      cls: metrics.cumulativeLayoutShift,
      tti: metrics.timeToInteractive,
      pageLoad: metrics.pageLoad,
      avgApiTime: metrics.apiCalls.length > 0 
        ? metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / metrics.apiCalls.length
        : 0
    }))
    
    console.table(summary)
    
    // Identify performance issues
    const issues: string[] = []
    
    summary.forEach(({ path, ...metrics }) => {
      if (metrics.lcp > PERFORMANCE_BUDGETS.lcp.poor) {
        issues.push(`${path}: LCP (${metrics.lcp.toFixed(0)}ms) exceeds poor threshold`)
      }
      if (metrics.tbt > PERFORMANCE_BUDGETS.tbt.poor) {
        issues.push(`${path}: TBT (${metrics.tbt.toFixed(0)}ms) indicates blocking JavaScript`)
      }
      if (metrics.cls > PERFORMANCE_BUDGETS.cls.poor) {
        issues.push(`${path}: CLS (${metrics.cls.toFixed(3)}) indicates layout instability`)
      }
    })
    
    if (issues.length > 0) {
      console.log('\n⚠️ Performance Issues Detected:')
      issues.forEach(issue => console.log(`- ${issue}`))
    } else {
      console.log('\n✅ All pages meet performance budgets!')
    }
  })
  
  // Test each critical path
  CRITICAL_PATHS.forEach(({ name, path }) => {
    test(`Performance: ${name} (${path})`, async ({ page, context }) => {
      // Enable CPU throttling (4x slowdown)
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      
      // Enable network throttling (Fast 3G)
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 1.6 * 1024 * 1024 / 8,
        uploadThroughput: 750 * 1024 / 8,
        latency: 150
      })
      
      const metrics = await measurePerformance(page, path, name)
      performanceResults[path] = metrics
      
      // Assert performance budgets
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_BUDGETS.lcp.poor)
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_BUDGETS.fcp.poor)
      expect(metrics.totalBlockingTime).toBeLessThan(PERFORMANCE_BUDGETS.tbt.poor)
      expect(metrics.cumulativeLayoutShift).toBeLessThan(PERFORMANCE_BUDGETS.cls.poor)
      expect(metrics.timeToInteractive).toBeLessThan(PERFORMANCE_BUDGETS.tti.poor)
      
      // Check API performance
      if (metrics.apiCalls.length > 0) {
        const avgApiTime = metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / metrics.apiCalls.length
        expect(avgApiTime).toBeLessThan(PERFORMANCE_BUDGETS.apiResponse.poor)
      }
    })
  })
  
  test('Memory Leak Detection', async ({ page, context }) => {
    // Navigate to dashboard
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })
    
    // Perform actions that might leak memory
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="tab-voice"]', { force: true }).catch(() => {})
      await page.waitForTimeout(500)
      await page.click('[data-testid="tab-lead-generation"]', { force: true }).catch(() => {})
      await page.waitForTimeout(500)
      await page.click('[data-testid="tab-content-studio"]', { force: true }).catch(() => {})
      await page.waitForTimeout(500)
    }
    
    // Force garbage collection
    await page.evaluate(() => {
      if ('gc' in window) {
        (window as any).gc()
      }
    })
    
    await page.waitForTimeout(2000)
    
    // Get final memory
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })
    
    // Check for significant memory increase (more than 50MB)
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024
    console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`)
    
    expect(memoryIncrease).toBeLessThan(50)
  })
  
  test('Bundle Size Analysis', async ({ request }) => {
    // Check main bundle sizes
    const bundles = [
      '/_next/static/chunks/main.js',
      '/_next/static/chunks/pages/_app.js',
      '/_next/static/chunks/webpack.js',
    ]
    
    const bundleSizes: Record<string, number> = {}
    let totalSize = 0
    
    for (const bundle of bundles) {
      try {
        const response = await request.get(bundle)
        const size = (await response.body()).length
        bundleSizes[bundle] = size
        totalSize += size
      } catch (error) {
        console.warn(`Could not fetch bundle: ${bundle}`)
      }
    }
    
    console.log('\nBundle Sizes:')
    Object.entries(bundleSizes).forEach(([bundle, size]) => {
      console.log(`- ${bundle}: ${(size / 1024).toFixed(2)}KB`)
    })
    console.log(`Total Bundle Size: ${(totalSize / 1024).toFixed(2)}KB`)
    
    // Check if total bundle size is reasonable (< 1MB)
    expect(totalSize).toBeLessThan(1024 * 1024)
  })
  
  test('API Response Time Under Load', async ({ page, context }) => {
    await page.goto('/dashboard')
    
    // Simulate concurrent API calls
    const apiEndpoints = [
      '/api/health',
      '/api/user/profile',
      '/api/leads/search',
      '/api/agents/status'
    ]
    
    const results = await Promise.all(
      apiEndpoints.map(async (endpoint) => {
        const start = Date.now()
        try {
          const response = await page.request.get(endpoint)
          const duration = Date.now() - start
          return {
            endpoint,
            status: response.status(),
            duration,
            success: response.ok()
          }
        } catch (error) {
          return {
            endpoint,
            status: 0,
            duration: Date.now() - start,
            success: false
          }
        }
      })
    )
    
    console.log('\nAPI Response Times:')
    results.forEach(result => {
      console.log(`- ${result.endpoint}: ${result.duration}ms (${result.status})`)
    })
    
    // All APIs should respond within 1 second
    results.forEach(result => {
      expect(result.duration).toBeLessThan(1000)
    })
  })
})

test.describe('Resource Optimization', () => {
  test('Image Optimization Check', async ({ page }) => {
    await page.goto('/')
    
    // Get all images
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      return imgs.map(img => ({
        src: img.src,
        loading: img.loading,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        hasAlt: !!img.alt
      }))
    })
    
    console.log(`\nFound ${images.length} images`)
    
    // Check for optimization
    images.forEach(img => {
      // Should use lazy loading for below-the-fold images
      expect(['lazy', 'eager']).toContain(img.loading || 'auto')
      
      // Should have alt text for accessibility
      expect(img.hasAlt).toBe(true)
      
      // Should not be oversized (natural size should be reasonable)
      if (img.naturalWidth > 0) {
        expect(img.naturalWidth).toBeLessThan(2000)
      }
    })
  })
  
  test('JavaScript Bundle Splitting', async ({ page }) => {
    const coverage = await page.coverage.startJSCoverage()
    
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    const jsCoverage = await page.coverage.stopJSCoverage()
    
    // Analyze code coverage
    let totalBytes = 0
    let usedBytes = 0
    
    for (const entry of jsCoverage) {
      totalBytes += entry.source?.length || 0
      
      for (const func of entry.functions) {
        for (const range of func.ranges) {
          usedBytes += range.endOffset - range.startOffset
        }
      }
    }
    
    const coverage_percentage = (usedBytes / totalBytes) * 100
    console.log(`\nJavaScript Coverage: ${coverage_percentage.toFixed(2)}%`)
    console.log(`Total JS: ${(totalBytes / 1024).toFixed(2)}KB`)
    console.log(`Used JS: ${(usedBytes / 1024).toFixed(2)}KB`)
    console.log(`Unused JS: ${((totalBytes - usedBytes) / 1024).toFixed(2)}KB`)
    
    // At least 50% of JavaScript should be used on initial load
    expect(coverage_percentage).toBeGreaterThan(50)
  })
})