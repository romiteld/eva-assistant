#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Edge Functions Test Runner
 * Comprehensive testing suite for all 12 Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') || 'http://localhost:54321',
  supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'your-service-key',
  testUserId: 'test-user-id',
  timeout: 30000, // 30 seconds
}

// Edge Functions to test
const EDGE_FUNCTIONS = [
  'agent-orchestrator',
  'ai-agents',
  'error-logger',
  'process-document',
  'queue-processor',
  'rag-query',
  'setup-storage',
  'twilio-ivr',
  'twilio-webhook',
  'voice-stream',
  'websocket-relay',
]

// Test results interface
interface TestResult {
  functionName: string
  passed: number
  failed: number
  duration: number
  errors: string[]
  details: any[]
}

// Test runner class
class EdgeFunctionTestRunner {
  private supabase: any
  private results: TestResult[] = []

  constructor() {
    this.supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseServiceKey)
  }

  // Run all tests
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Edge Functions Test Suite')
    console.log('=' .repeat(60))
    
    const startTime = Date.now()
    
    for (const functionName of EDGE_FUNCTIONS) {
      await this.testFunction(functionName)
    }
    
    const totalTime = Date.now() - startTime
    
    console.log('\n' + '=' .repeat(60))
    console.log('📊 Test Results Summary')
    console.log('=' .repeat(60))
    
    let totalPassed = 0
    let totalFailed = 0
    
    for (const result of this.results) {
      totalPassed += result.passed
      totalFailed += result.failed
      
      const status = result.failed === 0 ? '✅' : '❌'
      console.log(`${status} ${result.functionName}: ${result.passed} passed, ${result.failed} failed (${result.duration}ms)`)
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => console.log(`   ⚠️  ${error}`))
      }
    }
    
    console.log('\n' + '-' .repeat(60))
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`)
    console.log(`Total time: ${totalTime}ms`)
    console.log(`Success rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`)
    
    // Exit with appropriate code
    if (totalFailed > 0) {
      Deno.exit(1)
    }
  }

  // Test individual function
  async testFunction(functionName: string): Promise<void> {
    console.log(`\n🧪 Testing ${functionName}`)
    console.log('-' .repeat(40))
    
    const startTime = Date.now()
    const result: TestResult = {
      functionName,
      passed: 0,
      failed: 0,
      duration: 0,
      errors: [],
      details: []
    }
    
    try {
      // Test function deployment status
      await this.testFunctionDeployment(functionName, result)
      
      // Test function health check
      await this.testFunctionHealth(functionName, result)
      
      // Test function-specific functionality
      await this.testFunctionLogic(functionName, result)
      
      // Test error handling
      await this.testErrorHandling(functionName, result)
      
      // Test CORS headers
      await this.testCORSHeaders(functionName, result)
      
    } catch (error) {
      result.failed++
      result.errors.push(`General test failure: ${error.message}`)
    }
    
    result.duration = Date.now() - startTime
    this.results.push(result)
    
    console.log(`✅ Passed: ${result.passed}, ❌ Failed: ${result.failed}`)
  }

  // Test function deployment status
  async testFunctionDeployment(functionName: string, result: TestResult): Promise<void> {
    try {
      const response = await fetch(`${TEST_CONFIG.supabaseUrl}/functions/v1/${functionName}`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.supabaseServiceKey}`,
        },
      })
      
      if (response.ok) {
        result.passed++
        result.details.push({ test: 'deployment', status: 'passed' })
        console.log('  ✅ Function deployment: OK')
      } else {
        result.failed++
        result.errors.push(`Deployment check failed: ${response.status}`)
        console.log('  ❌ Function deployment: FAILED')
      }
    } catch (error) {
      result.failed++
      result.errors.push(`Deployment check error: ${error.message}`)
      console.log('  ❌ Function deployment: ERROR')
    }
  }

  // Test function health check
  async testFunctionHealth(functionName: string, result: TestResult): Promise<void> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TEST_CONFIG.timeout)
      
      const response = await fetch(`${TEST_CONFIG.supabaseUrl}/functions/v1/${functionName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.supabaseServiceKey}`,
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok || response.status === 400) { // 400 is OK for functions expecting specific input
        result.passed++
        result.details.push({ test: 'health', status: 'passed', statusCode: response.status })
        console.log('  ✅ Function health: OK')
      } else {
        result.failed++
        result.errors.push(`Health check failed: ${response.status}`)
        console.log('  ❌ Function health: FAILED')
      }
    } catch (error) {
      result.failed++
      result.errors.push(`Health check error: ${error.message}`)
      console.log('  ❌ Function health: ERROR')
    }
  }

  // Test function-specific logic
  async testFunctionLogic(functionName: string, result: TestResult): Promise<void> {
    try {
      const testData = this.getTestData(functionName)
      
      const response = await fetch(`${TEST_CONFIG.supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      })
      
      if (response.ok) {
        const data = await response.json()
        result.passed++
        result.details.push({ test: 'logic', status: 'passed', response: data })
        console.log('  ✅ Function logic: OK')
      } else {
        result.failed++
        result.errors.push(`Logic test failed: ${response.status}`)
        console.log('  ❌ Function logic: FAILED')
      }
    } catch (error) {
      result.failed++
      result.errors.push(`Logic test error: ${error.message}`)
      console.log('  ❌ Function logic: ERROR')
    }
  }

  // Test error handling
  async testErrorHandling(functionName: string, result: TestResult): Promise<void> {
    try {
      const response = await fetch(`${TEST_CONFIG.supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invalid: 'data' }),
      })
      
      if (response.status === 400 || response.status === 500) {
        result.passed++
        result.details.push({ test: 'error_handling', status: 'passed' })
        console.log('  ✅ Error handling: OK')
      } else {
        result.failed++
        result.errors.push(`Error handling test failed: ${response.status}`)
        console.log('  ❌ Error handling: FAILED')
      }
    } catch (error) {
      result.failed++
      result.errors.push(`Error handling test error: ${error.message}`)
      console.log('  ❌ Error handling: ERROR')
    }
  }

  // Test CORS headers
  async testCORSHeaders(functionName: string, result: TestResult): Promise<void> {
    try {
      const response = await fetch(`${TEST_CONFIG.supabaseUrl}/functions/v1/${functionName}`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.supabaseServiceKey}`,
        },
      })
      
      const corsHeader = response.headers.get('Access-Control-Allow-Origin')
      
      if (corsHeader && corsHeader === '*') {
        result.passed++
        result.details.push({ test: 'cors', status: 'passed' })
        console.log('  ✅ CORS headers: OK')
      } else {
        result.failed++
        result.errors.push(`CORS headers missing or incorrect`)
        console.log('  ❌ CORS headers: FAILED')
      }
    } catch (error) {
      result.failed++
      result.errors.push(`CORS test error: ${error.message}`)
      console.log('  ❌ CORS headers: ERROR')
    }
  }

  // Get test data for specific function
  private getTestData(functionName: string): any {
    const testData: Record<string, any> = {
      'agent-orchestrator': {
        action: 'list',
        userId: TEST_CONFIG.testUserId,
      },
      'ai-agents': {
        agentType: 'lead-generation',
        payload: { query: 'test' },
        userId: TEST_CONFIG.testUserId,
      },
      'error-logger': {
        error: 'test-error',
        context: { test: true },
        userId: TEST_CONFIG.testUserId,
      },
      'process-document': {
        document: 'test document content',
        userId: TEST_CONFIG.testUserId,
      },
      'queue-processor': {
        queueName: 'test-queue',
      },
      'rag-query': {
        query: 'test query',
        userId: TEST_CONFIG.testUserId,
      },
      'voice-stream': {
        action: 'transcribe',
        audio: 'test-audio-data',
        userId: TEST_CONFIG.testUserId,
      },
      'setup-storage': {
        bucketName: 'test-bucket',
        userId: TEST_CONFIG.testUserId,
      },
      'twilio-ivr': {
        callSid: 'test-call-id',
        digits: '1',
      },
      'twilio-webhook': {
        CallSid: 'test-webhook-call',
        From: '+1234567890',
        To: '+1234567890',
      },
      'websocket-relay': {
        channel: 'test-relay',
        message: 'test message',
      },
    }
    
    return testData[functionName] || { test: 'default' }
  }

  // Generate test report
  generateReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      totalFunctions: EDGE_FUNCTIONS.length,
      results: this.results,
      summary: {
        totalPassed: this.results.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      },
    }
    
    // Write report to file
    const reportJson = JSON.stringify(report, null, 2)
    Deno.writeTextFileSync('/tmp/edge-functions-test-report.json', reportJson)
    
    console.log('\n📄 Test report saved to: /tmp/edge-functions-test-report.json')
  }
}

// Main execution
if (import.meta.main) {
  try {
    const runner = new EdgeFunctionTestRunner()
    await runner.runAllTests()
    runner.generateReport()
  } catch (error) {
    console.error('❌ Test runner failed:', error)
    Deno.exit(1)
  }
}