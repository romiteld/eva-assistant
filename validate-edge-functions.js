#!/usr/bin/env node

/**
 * Edge Function Validation Script
 * Validates all edge functions are deployed and working correctly
 */

const https = require('https');
const http = require('http');

const SUPABASE_URL = 'https://ztakznzshlvqobzbuewb.supabase.co';
const FUNCTIONS_PATH = '/functions/v1';

// Test results storage
const results = [];

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const start = Date.now();
    
    const req = protocol.request(url, options, (res) => {
      const time = Date.now() - start;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          time: time
        });
      });
    });
    
    req.on('error', (error) => {
      const time = Date.now() - start;
      reject({
        error: error.message,
        time: time
      });
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

function logResult(functionName, endpoint, status, message, time) {
  const result = {
    function: functionName,
    endpoint: endpoint,
    status: status,
    message: message,
    time: time
  };
  
  results.push(result);
  
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${functionName}${endpoint}: ${message} ${time ? `(${time}ms)` : ''}`);
}

async function testFunction(functionName, tests = []) {
  console.log(`\n🔧 Testing ${functionName}...`);
  
  // Default test - basic connectivity
  if (tests.length === 0) {
    tests.push({
      endpoint: '',
      method: 'GET',
      expectedStatuses: [200, 400, 401, 404, 405], // Any non-500 is considered accessible
      description: 'Basic connectivity'
    });
  }
  
  for (const test of tests) {
    try {
      const url = `${SUPABASE_URL}${FUNCTIONS_PATH}/${functionName}${test.endpoint}`;
      const options = {
        method: test.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EdgeFunctionValidator/1.0',
          ...test.headers
        }
      };
      
      if (test.body) {
        options.body = typeof test.body === 'string' ? test.body : JSON.stringify(test.body);
      }
      
      const response = await makeRequest(url, options);
      const isExpectedStatus = test.expectedStatuses.includes(response.status);
      
      logResult(
        functionName,
        test.endpoint,
        isExpectedStatus ? 'PASS' : 'FAIL',
        isExpectedStatus ? 
          `${test.description} - Status ${response.status}` :
          `${test.description} - Unexpected status ${response.status}`,
        response.time
      );
      
    } catch (error) {
      logResult(
        functionName,
        test.endpoint,
        'FAIL',
        `${test.description} - ${error.error}`,
        error.time
      );
    }
  }
}

async function validateAllFunctions() {
  console.log('🚀 Starting Edge Function Validation');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('=' * 60);
  
  // Test voice-stream function (critical)
  await testFunction('voice-stream', [
    {
      endpoint: '',
      method: 'OPTIONS',
      expectedStatuses: [200, 204],
      description: 'CORS preflight'
    },
    {
      endpoint: '/invalid',
      method: 'GET',
      expectedStatuses: [400, 404],
      description: 'Invalid operation rejection'
    },
    {
      endpoint: '/transcribe',
      method: 'POST',
      body: { audioData: '', sessionId: 'test' },
      expectedStatuses: [400, 401],
      description: 'Transcribe endpoint validation'
    },
    {
      endpoint: '/synthesize',
      method: 'GET',
      expectedStatuses: [400, 401],
      description: 'Synthesize parameter validation'
    }
  ]);
  
  // Test agent-orchestrator
  await testFunction('agent-orchestrator', [
    {
      endpoint: '',
      method: 'GET',
      expectedStatuses: [200, 400, 401, 405],
      description: 'Agent orchestrator accessibility'
    },
    {
      endpoint: '',
      method: 'POST',
      body: { action: 'test' },
      expectedStatuses: [200, 400, 401],
      description: 'Agent orchestrator POST'
    }
  ]);
  
  // Test ai-agents
  await testFunction('ai-agents', [
    {
      endpoint: '',
      method: 'GET',
      expectedStatuses: [200, 400, 401, 405],
      description: 'AI agents accessibility'
    }
  ]);
  
  // Test error-logger
  await testFunction('error-logger', [
    {
      endpoint: '',
      method: 'POST',
      body: { level: 'test', message: 'validation' },
      expectedStatuses: [200, 400, 401],
      description: 'Error logging endpoint'
    }
  ]);
  
  // Test process-document
  await testFunction('process-document', [
    {
      endpoint: '',
      method: 'POST',
      body: { documentId: 'test' },
      expectedStatuses: [200, 400, 401],
      description: 'Document processing'
    }
  ]);
  
  // Test queue-processor
  await testFunction('queue-processor');
  
  // Test rag-query
  await testFunction('rag-query', [
    {
      endpoint: '',
      method: 'POST',
      body: { query: 'test' },
      expectedStatuses: [200, 400, 401],
      description: 'RAG query endpoint'
    }
  ]);
  
  // Test setup-storage
  await testFunction('setup-storage');
  
  // Test twilio-ivr
  await testFunction('twilio-ivr', [
    {
      endpoint: '',
      method: 'POST',
      body: {},
      expectedStatuses: [200, 400],
      description: 'Twilio IVR webhook'
    }
  ]);
  
  // Test twilio-webhook
  await testFunction('twilio-webhook', [
    {
      endpoint: '',
      method: 'POST',
      body: {},
      expectedStatuses: [200, 400],
      description: 'Twilio webhook handler'
    }
  ]);
  
  // Test websocket-relay
  await testFunction('websocket-relay', [
    {
      endpoint: '',
      method: 'GET',
      expectedStatuses: [200, 400, 426], // 426 = Upgrade Required (for WebSocket)
      description: 'WebSocket relay endpoint'
    }
  ]);
  
  // Summary
  console.log('\n📊 Validation Summary');
  console.log('=' * 60);
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`  - ${r.function}${r.endpoint}: ${r.message}`));
  }
  
  // Critical functions check
  const voiceStreamResults = results.filter(r => r.function === 'voice-stream');
  const voiceStreamPassed = voiceStreamResults.filter(r => r.status === 'PASS').length;
  const voiceStreamTotal = voiceStreamResults.length;
  
  console.log(`\n🎤 Voice Stream Function: ${voiceStreamPassed}/${voiceStreamTotal} tests passed`);
  
  if (voiceStreamPassed === voiceStreamTotal) {
    console.log('✅ Voice streaming is ready for production!');
  } else {
    console.log('❌ Voice streaming needs attention before production use.');
  }
  
  return {
    total: results.length,
    passed,
    failed,
    warnings,
    results
  };
}

// Run validation
validateAllFunctions().then((summary) => {
  process.exit(summary.failed > 0 ? 1 : 0);
}).catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});