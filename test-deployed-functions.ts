#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test deployed Edge Functions on Supabase
 */

// Test configuration
const SUPABASE_URL = 'https://ztakznzshlvqobzbuewb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMjAwMDAsImV4cCI6MjA1OTg5NjAwMH0.KI7BRrFJGAuVKqgUYaIiJMXJFNKdxQkUPRtdXKaJx8c'

// Edge Functions to test
const EDGE_FUNCTIONS = [
  'agent-orchestrator',
  'ai-agents',
  'gemini-websocket',
  'process-document',
  'queue-processor',
  'rag-query',
  'realtime-stream',
  'setup-storage',
  'twilio-ivr',
  'twilio-webhook',
  'websocket-handler',
  'websocket-relay',
]

// Test results
interface TestResult {
  functionName: string
  status: 'healthy' | 'unhealthy' | 'error'
  statusCode?: number
  responseTime?: number
  error?: string
}

class DeployedFunctionTester {
  private results: TestResult[] = []

  async testAllFunctions(): Promise<void> {
    console.log('🚀 Testing Deployed Edge Functions')
    console.log('=' .repeat(60))
    
    for (const functionName of EDGE_FUNCTIONS) {
      await this.testFunction(functionName)
    }
    
    this.showResults()
  }

  async testFunction(functionName: string): Promise<void> {
    console.log(`\n🧪 Testing ${functionName}`)
    console.log('-' .repeat(40))
    
    const startTime = Date.now()
    
    try {
      // Test CORS preflight
      const corsResponse = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      })
      
      if (corsResponse.ok) {
        console.log('  ✅ CORS preflight: OK')
      } else {
        console.log('  ❌ CORS preflight: FAILED')
      }
      
      // Test basic GET request
      const getResponse = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      })
      
      const responseTime = Date.now() - startTime
      
      if (getResponse.ok || getResponse.status === 400) {
        console.log(`  ✅ Function responding: ${getResponse.status} (${responseTime}ms)`)
        
        this.results.push({
          functionName,
          status: 'healthy',
          statusCode: getResponse.status,
          responseTime,
        })
      } else {
        console.log(`  ❌ Function error: ${getResponse.status} (${responseTime}ms)`)
        
        this.results.push({
          functionName,
          status: 'unhealthy',
          statusCode: getResponse.status,
          responseTime,
          error: `HTTP ${getResponse.status}`,
        })
      }
      
      // Test with sample data (if not WebSocket)
      if (!functionName.includes('websocket') && !functionName.includes('gemini-websocket')) {
        try {
          const testData = this.getTestData(functionName)
          
          const postResponse = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
          })
          
          if (postResponse.ok) {
            console.log('  ✅ POST request: OK')
          } else {
            console.log(`  ⚠️  POST request: ${postResponse.status} (expected for some functions)`)
          }
          
          // Try to parse response
          const responseText = await postResponse.text()
          if (responseText.length > 0) {
            try {
              const responseData = JSON.parse(responseText)
              console.log(`  ℹ️  Response: ${JSON.stringify(responseData).substring(0, 100)}...`)
            } catch {
              console.log(`  ℹ️  Response: ${responseText.substring(0, 100)}...`)
            }
          }
        } catch (error) {
          console.log(`  ⚠️  POST test error: ${error.message}`)
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Test error: ${error.message}`)
      
      this.results.push({
        functionName,
        status: 'error',
        error: error.message,
      })
    }
  }

  private getTestData(functionName: string): any {
    const testData: Record<string, any> = {
      'agent-orchestrator': {
        action: 'list',
        userId: 'test-user-id',
      },
      'ai-agents': {
        agent: 'content',
        prompt: 'Create a test LinkedIn post',
        userId: 'test-user-id',
      },
      'process-document': {
        documentId: 'test-doc-id',
        userId: 'test-user-id',
      },
      'queue-processor': {
        action: 'stats',
      },
      'rag-query': {
        query: 'test query',
        userId: 'test-user-id',
      },
      'realtime-stream': {
        channel: 'test-channel',
        userId: 'test-user-id',
      },
      'setup-storage': {
        action: 'list-buckets',
        userId: 'test-user-id',
      },
      'twilio-ivr': {
        CallSid: 'test-call-id',
        Digits: '1',
      },
      'twilio-webhook': {
        CallSid: 'test-webhook-call',
        CallStatus: 'ringing',
        From: '+1234567890',
        To: '+1234567890',
      },
      'websocket-handler': {
        action: 'connect',
        userId: 'test-user-id',
      },
      'websocket-relay': {
        channel: 'test-relay',
        message: 'test message',
      },
    }
    
    return testData[functionName] || { test: 'default' }
  }

  private showResults(): void {
    console.log('\n📊 Test Results Summary')
    console.log('=' .repeat(60))
    
    const healthy = this.results.filter(r => r.status === 'healthy').length
    const unhealthy = this.results.filter(r => r.status === 'unhealthy').length
    const errors = this.results.filter(r => r.status === 'error').length
    
    console.log(`✅ Healthy: ${healthy}`)
    console.log(`❌ Unhealthy: ${unhealthy}`)
    console.log(`⚠️  Errors: ${errors}`)
    
    console.log('\n🔍 Function Details:')
    this.results.forEach(result => {
      const status = result.status === 'healthy' ? '✅' : 
                    result.status === 'unhealthy' ? '❌' : '⚠️'
      const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A'
      const statusCode = result.statusCode ? `(${result.statusCode})` : ''
      const error = result.error ? ` - ${result.error}` : ''
      
      console.log(`${status} ${result.functionName}: ${responseTime} ${statusCode}${error}`)
    })
    
    const successRate = ((healthy / (healthy + unhealthy + errors)) * 100).toFixed(1)
    console.log(`\n📈 Success Rate: ${successRate}%`)
    
    // Save results to file
    const reportData = {
      timestamp: new Date().toISOString(),
      totalFunctions: EDGE_FUNCTIONS.length,
      healthy,
      unhealthy,
      errors,
      successRate: parseFloat(successRate),
      results: this.results,
    }
    
    try {
      Deno.writeTextFileSync('/tmp/edge-functions-health-report.json', JSON.stringify(reportData, null, 2))
      console.log('\n📄 Health report saved to: /tmp/edge-functions-health-report.json')
    } catch (error) {
      console.error('Failed to save report:', error)
    }
  }
}

// Run tests
if (import.meta.main) {
  const tester = new DeployedFunctionTester()
  await tester.testAllFunctions()
}