#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Edge Function Test Suite
 * Tests all edge functions to verify deployment and functionality
 */

interface TestResult {
  function: string;
  endpoint: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  responseTime?: number;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

class EdgeFunctionTester {
  private results: TestResult[] = [];
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(
    functionName: string,
    path: string = '',
    options: RequestInit = {}
  ): Promise<{response: Response, time: number}> {
    const url = `${this.baseUrl}/functions/v1/${functionName}${path}`;
    const start = Date.now();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders
      });
      const time = Date.now() - start;
      return { response, time };
    } catch (error) {
      const time = Date.now() - start;
      throw new Error(`Network error: ${error.message}`);
    }
  }

  private addResult(result: TestResult) {
    this.results.push(result);
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
    console.log(`${statusIcon} ${result.function}${result.endpoint}: ${result.message} ${result.responseTime ? `(${result.responseTime}ms)` : ''}`);
  }

  async testVoiceStream() {
    console.log('\n🎤 Testing voice-stream function...');

    // Test OPTIONS request (CORS)
    try {
      const { response, time } = await this.makeRequest('voice-stream', '', {
        method: 'OPTIONS'
      });
      
      this.addResult({
        function: 'voice-stream',
        endpoint: ' (CORS)',
        status: response.ok ? 'pass' : 'fail',
        message: response.ok ? 'CORS preflight successful' : `CORS failed: ${response.status}`,
        responseTime: time
      });
    } catch (error) {
      this.addResult({
        function: 'voice-stream',
        endpoint: ' (CORS)',
        status: 'fail',
        message: `CORS test failed: ${error.message}`
      });
    }

    // Test invalid operation
    try {
      const { response, time } = await this.makeRequest('voice-stream', '/invalid', {
        method: 'GET'
      });
      
      this.addResult({
        function: 'voice-stream',
        endpoint: '/invalid',
        status: response.status === 400 ? 'pass' : 'fail',
        message: response.status === 400 ? 'Invalid operation correctly rejected' : `Unexpected status: ${response.status}`,
        responseTime: time
      });
    } catch (error) {
      this.addResult({
        function: 'voice-stream',
        endpoint: '/invalid',
        status: 'fail',
        message: `Invalid operation test failed: ${error.message}`
      });
    }

    // Test transcribe endpoint (without auth - should fail gracefully)
    try {
      const { response, time } = await this.makeRequest('voice-stream', '/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioData: '', sessionId: 'test' })
      });
      
      this.addResult({
        function: 'voice-stream',
        endpoint: '/transcribe',
        status: response.status === 400 || response.status === 401 ? 'pass' : 'fail',
        message: response.status === 400 ? 'Correctly rejected empty audio data' : 
                response.status === 401 ? 'Correctly requires authentication' : 
                `Unexpected status: ${response.status}`,
        responseTime: time
      });
    } catch (error) {
      this.addResult({
        function: 'voice-stream',
        endpoint: '/transcribe',
        status: 'fail',
        message: `Transcribe test failed: ${error.message}`
      });
    }

    // Test synthesize endpoint (without text - should fail)
    try {
      const { response, time } = await this.makeRequest('voice-stream', '/synthesize', {
        method: 'GET'
      });
      
      this.addResult({
        function: 'voice-stream',
        endpoint: '/synthesize',
        status: response.status === 400 || response.status === 401 ? 'pass' : 'fail',
        message: response.status === 400 ? 'Correctly requires text parameter' : 
                response.status === 401 ? 'Correctly requires authentication' : 
                `Unexpected status: ${response.status}`,
        responseTime: time
      });
    } catch (error) {
      this.addResult({
        function: 'voice-stream',
        endpoint: '/synthesize',
        status: 'fail',
        message: `Synthesize test failed: ${error.message}`
      });
    }
  }

  async testOtherFunctions() {
    console.log('\n🔧 Testing other edge functions...');

    const functionsToTest = [
      'agent-orchestrator',
      'ai-agents',
      'error-logger',
      'process-document',
      'queue-processor',
      'rag-query',
      'setup-storage',
      'twilio-ivr',
      'twilio-webhook',
      'websocket-relay'
    ];

    for (const functionName of functionsToTest) {
      try {
        const { response, time } = await this.makeRequest(functionName, '', {
          method: 'GET'
        });
        
        this.addResult({
          function: functionName,
          endpoint: '',
          status: response.status < 500 ? 'pass' : 'fail',
          message: response.status < 500 ? 'Function accessible' : `Server error: ${response.status}`,
          responseTime: time
        });
      } catch (error) {
        this.addResult({
          function: functionName,
          endpoint: '',
          status: 'fail',
          message: `Function not accessible: ${error.message}`
        });
      }
    }
  }

  async runTests() {
    console.log('🚀 Starting Edge Function Tests');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Auth: ${SUPABASE_ANON_KEY ? 'Configured' : 'Missing'}`);
    console.log('=' * 50);

    await this.testVoiceStream();
    await this.testOtherFunctions();

    console.log('\n📊 Test Summary:');
    console.log('=' * 50);
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  - ${r.function}${r.endpoint}: ${r.message}`));
    }

    return {
      total: this.results.length,
      passed,
      failed,
      skipped,
      results: this.results
    };
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  const tester = new EdgeFunctionTester(SUPABASE_URL);
  const results = await tester.runTests();
  
  // Exit with error code if tests failed
  Deno.exit(results.failed > 0 ? 1 : 0);
}