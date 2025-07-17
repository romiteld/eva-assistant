import { test, expect } from '@playwright/test'

// Simulate multiple concurrent users
const CONCURRENT_USERS = 10
const TEST_DURATION = 60000 // 1 minute
const ACTIONS_PER_USER = 20

interface LoadTestMetrics {
  responseTime: number
  successRate: number
  throughput: number
  errors: string[]
  peakLoad: number
}

test.describe('Load Testing', () => {
  test('Concurrent user simulation', async ({ browser }) => {
    const startTime = Date.now()
    const metrics: LoadTestMetrics = {
      responseTime: 0,
      successRate: 0,
      throughput: 0,
      errors: [],
      peakLoad: 0
    }
    
    const userActions = async (userId: number) => {
      const context = await browser.newContext()
      const page = await context.newPage()
      const results = {
        actions: 0,
        errors: 0,
        totalTime: 0
      }
      
      try {
        // Login
        const loginStart = Date.now()
        await page.goto('/auth/login')
        await page.fill('[data-testid="email-input"]', `user${userId}@example.com`)
        await page.click('[data-testid="magic-link-button"]')
        results.totalTime += Date.now() - loginStart
        results.actions++
        
        // Navigate to dashboard
        const dashboardStart = Date.now()
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')
        results.totalTime += Date.now() - dashboardStart
        results.actions++
        
        // Perform random actions
        for (let i = 0; i < ACTIONS_PER_USER; i++) {
          const actionStart = Date.now()
          
          try {
            const action = Math.floor(Math.random() * 5)
            switch (action) {
              case 0: // Navigate to lead generation
                await page.goto('/dashboard/lead-generation')
                await page.waitForLoadState('networkidle')
                break
                
              case 1: // Search for leads
                if (page.url().includes('lead-generation')) {
                  await page.fill('[data-testid="search-input"]', `search term ${i}`)
                  await page.click('[data-testid="search-button"]')
                  await page.waitForTimeout(2000)
                }
                break
                
              case 2: // Navigate to content studio
                await page.goto('/dashboard/content-studio')
                await page.waitForLoadState('networkidle')
                break
                
              case 3: // Create a task
                await page.goto('/dashboard/tasks')
                await page.fill('[data-testid="new-task-title"]', `Task ${userId}-${i}`)
                await page.click('[data-testid="create-task"]')
                await page.waitForTimeout(1000)
                break
                
              case 4: // View orchestrator
                await page.goto('/dashboard/orchestrator')
                await page.waitForLoadState('networkidle')
                break
            }
            
            results.totalTime += Date.now() - actionStart
            results.actions++
          } catch (error) {
            results.errors++
            metrics.errors.push(`User ${userId}: ${error}`)
          }
          
          // Random think time between actions
          await page.waitForTimeout(Math.random() * 2000 + 1000)
        }
      } catch (error) {
        metrics.errors.push(`User ${userId} failed: ${error}`)
      } finally {
        await context.close()
      }
      
      return results
    }
    
    // Launch concurrent users
    console.log(`Starting load test with ${CONCURRENT_USERS} concurrent users`)
    const userPromises = []
    
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      userPromises.push(userActions(i))
      // Stagger user starts
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Wait for all users to complete
    const results = await Promise.all(userPromises)
    
    // Calculate metrics
    const totalActions = results.reduce((sum, r) => sum + r.actions, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
    const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0)
    const testDuration = Date.now() - startTime
    
    metrics.responseTime = totalTime / totalActions
    metrics.successRate = ((totalActions - totalErrors) / totalActions) * 100
    metrics.throughput = totalActions / (testDuration / 1000) // actions per second
    metrics.peakLoad = CONCURRENT_USERS
    
    // Log results
    console.log('\n=== LOAD TEST RESULTS ===')
    console.log(`Duration: ${(testDuration / 1000).toFixed(2)}s`)
    console.log(`Total Actions: ${totalActions}`)
    console.log(`Average Response Time: ${metrics.responseTime.toFixed(2)}ms`)
    console.log(`Success Rate: ${metrics.successRate.toFixed(2)}%`)
    console.log(`Throughput: ${metrics.throughput.toFixed(2)} actions/sec`)
    console.log(`Errors: ${metrics.errors.length}`)
    
    // Assert performance under load
    expect(metrics.successRate).toBeGreaterThan(95)
    expect(metrics.responseTime).toBeLessThan(3000)
    expect(metrics.throughput).toBeGreaterThan(1)
  })
  
  test('Database connection pool stress test', async ({ page }) => {
    const queries = []
    const startTime = Date.now()
    
    // Simulate 50 concurrent database queries
    for (let i = 0; i < 50; i++) {
      queries.push(
        page.request.get('/api/health').catch(e => ({ error: e }))
      )
    }
    
    const results = await Promise.all(queries)
    const duration = Date.now() - startTime
    
    const successful = results.filter(r => !('error' in r)).length
    const failed = results.length - successful
    
    console.log(`\nDatabase Pool Test:`)
    console.log(`- Total Queries: ${results.length}`)
    console.log(`- Successful: ${successful}`)
    console.log(`- Failed: ${failed}`)
    console.log(`- Duration: ${duration}ms`)
    console.log(`- Avg Response: ${(duration / results.length).toFixed(2)}ms`)
    
    expect(failed).toBe(0)
    expect(duration).toBeLessThan(10000)
  })
  
  test('WebSocket connection limits', async ({ browser }) => {
    const connections = []
    const maxConnections = 20
    let successfulConnections = 0
    
    // Try to create multiple WebSocket connections
    for (let i = 0; i < maxConnections; i++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      
      await page.goto('/dashboard')
      
      const connected = await page.evaluate(() => {
        return new Promise(resolve => {
          try {
            const ws = new WebSocket('ws://localhost:3001')
            ws.onopen = () => resolve(true)
            ws.onerror = () => resolve(false)
            setTimeout(() => resolve(false), 5000)
          } catch {
            resolve(false)
          }
        })
      })
      
      if (connected) successfulConnections++
      connections.push({ context, page })
    }
    
    console.log(`\nWebSocket Connection Test:`)
    console.log(`- Attempted: ${maxConnections}`)
    console.log(`- Successful: ${successfulConnections}`)
    
    // Cleanup
    for (const { context } of connections) {
      await context.close()
    }
    
    expect(successfulConnections).toBeGreaterThan(10)
  })
  
  test('Rate limiting verification', async ({ page }) => {
    await page.goto('/dashboard')
    
    const endpoint = '/api/leads/search'
    const requests = []
    const rateLimit = 100 // Expected rate limit
    
    // Send burst of requests
    for (let i = 0; i < rateLimit + 10; i++) {
      requests.push(
        page.request.post(endpoint, {
          data: { query: 'test' }
        }).then(response => ({
          status: response.status(),
          headers: response.headers()
        })).catch(error => ({
          status: 0,
          error
        }))
      )
    }
    
    const results = await Promise.all(requests)
    
    const rateLimited = results.filter(r => r.status === 429).length
    const successful = results.filter(r => r.status === 200).length
    
    console.log(`\nRate Limiting Test:`)
    console.log(`- Total Requests: ${results.length}`)
    console.log(`- Successful: ${successful}`)
    console.log(`- Rate Limited (429): ${rateLimited}`)
    
    // Should have some rate limited requests
    expect(rateLimited).toBeGreaterThan(0)
    expect(successful).toBeGreaterThan(0)
  })
  
  test('Cache performance under load', async ({ page }) => {
    const urls = [
      '/api/user/profile',
      '/api/agents/status',
      '/api/health'
    ]
    
    // First round - populate cache
    console.log('\nCache Performance Test:')
    console.log('Round 1 - Cold cache:')
    
    const coldTimes = []
    for (const url of urls) {
      const start = Date.now()
      await page.request.get(url)
      const duration = Date.now() - start
      coldTimes.push(duration)
      console.log(`- ${url}: ${duration}ms`)
    }
    
    // Second round - should hit cache
    console.log('\nRound 2 - Warm cache:')
    
    const warmTimes = []
    for (const url of urls) {
      const start = Date.now()
      await page.request.get(url)
      const duration = Date.now() - start
      warmTimes.push(duration)
      console.log(`- ${url}: ${duration}ms`)
    }
    
    // Cache should improve performance
    const avgCold = coldTimes.reduce((a, b) => a + b) / coldTimes.length
    const avgWarm = warmTimes.reduce((a, b) => a + b) / warmTimes.length
    const improvement = ((avgCold - avgWarm) / avgCold) * 100
    
    console.log(`\nCache improvement: ${improvement.toFixed(2)}%`)
    expect(avgWarm).toBeLessThan(avgCold)
  })
  
  test('Memory usage under sustained load', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    await page.goto('/dashboard')
    
    const memorySnapshots = []
    const duration = 30000 // 30 seconds
    const interval = 5000 // 5 seconds
    
    // Take initial memory snapshot
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })
    
    memorySnapshots.push({ time: 0, memory: initialMemory })
    
    // Simulate sustained activity
    const startTime = Date.now()
    
    while (Date.now() - startTime < duration) {
      // Perform actions
      await page.click('[data-testid="tab-voice"]').catch(() => {})
      await page.waitForTimeout(500)
      await page.click('[data-testid="tab-tasks"]').catch(() => {})
      await page.waitForTimeout(500)
      
      // Take memory snapshot
      if ((Date.now() - startTime) % interval < 1000) {
        const currentMemory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize
          }
          return 0
        })
        
        memorySnapshots.push({
          time: Date.now() - startTime,
          memory: currentMemory
        })
      }
    }
    
    // Analyze memory growth
    console.log('\nMemory Usage Over Time:')
    memorySnapshots.forEach(snapshot => {
      const mb = (snapshot.memory / 1024 / 1024).toFixed(2)
      const growth = ((snapshot.memory - initialMemory) / 1024 / 1024).toFixed(2)
      console.log(`- ${(snapshot.time / 1000).toFixed(0)}s: ${mb}MB (+${growth}MB)`)
    })
    
    // Check for memory leaks
    const finalMemory = memorySnapshots[memorySnapshots.length - 1].memory
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024
    
    console.log(`Total memory growth: ${memoryGrowth.toFixed(2)}MB`)
    expect(memoryGrowth).toBeLessThan(100) // Less than 100MB growth
    
    await context.close()
  })
})