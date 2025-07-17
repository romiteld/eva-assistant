#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../../.env.local') });

interface TestResult {
  endpoint: string;
  method: string;
  category: string;
  status: 'working' | 'broken' | 'partial';
  statusCode?: number;
  error?: string;
  authRequired?: boolean;
  rateLimitChecked?: boolean;
  notes?: string;
}

class APIEndpointValidator {
  private baseUrl: string;
  private results: TestResult[] = [];
  private authToken?: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private async makeRequest(
    endpoint: string,
    method: string = 'GET',
    options: {
      headers?: Record<string, string>;
      body?: any;
      expectStatus?: number;
    } = {}
  ) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      return {
        status: 0,
        statusText: 'Network Error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private addResult(result: TestResult) {
    this.results.push(result);
    console.log(`[${result.status}] ${result.method} ${result.endpoint} - ${result.statusCode || 'N/A'}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.notes) {
      console.log(`  Notes: ${result.notes}`);
    }
  }

  async testAuthenticationFlow() {
    console.log('\n🔐 Testing Authentication Flow...\n');

    // Test login endpoint
    const loginResult = await this.makeRequest('/api/auth/test-login', 'POST', {
      body: { email: 'test@example.com', password: 'test123' },
    });
    
    this.addResult({
      endpoint: '/api/auth/test-login',
      method: 'POST',
      category: 'Authentication',
      status: loginResult.status === 200 ? 'working' : 'broken',
      statusCode: loginResult.status,
      error: loginResult.error || loginResult.data?.error,
      authRequired: false,
    });

    // Test auth status
    const authStatusResult = await this.makeRequest('/api/auth-status');
    this.addResult({
      endpoint: '/api/auth-status',
      method: 'GET',
      category: 'Authentication',
      status: authStatusResult.status === 200 || authStatusResult.status === 401 ? 'working' : 'broken',
      statusCode: authStatusResult.status,
      authRequired: true,
    });

    // Test signout
    const signoutResult = await this.makeRequest('/api/auth/signout', 'POST');
    this.addResult({
      endpoint: '/api/auth/signout',
      method: 'POST',
      category: 'Authentication',
      status: signoutResult.status === 200 ? 'working' : 'broken',
      statusCode: signoutResult.status,
      authRequired: false,
    });

    // Test Microsoft callback (should exist but return error without proper params)
    const msCallbackResult = await this.makeRequest('/api/auth/microsoft/callback');
    this.addResult({
      endpoint: '/api/auth/microsoft/callback',
      method: 'GET',
      category: 'Authentication',
      status: msCallbackResult.status !== 404 ? 'working' : 'broken',
      statusCode: msCallbackResult.status,
      authRequired: false,
      notes: 'Expects OAuth parameters',
    });
  }

  async testAgentManagementAPIs() {
    console.log('\n🤖 Testing Agent Management APIs...\n');

    const endpoints = [
      { path: '/api/agents', method: 'GET', description: 'List agents' },
      { path: '/api/agents', method: 'POST', description: 'Execute agent', body: { action: 'test' } },
      { path: '/api/agents/monitor', method: 'GET', description: 'Monitor agents' },
      { path: '/api/agents/assign', method: 'POST', description: 'Assign tasks', body: { taskId: '123' } },
      { path: '/api/agents/rebalance', method: 'POST', description: 'Rebalance tasks' },
      { path: '/api/agents/stats', method: 'GET', description: 'Get statistics' },
      { path: '/api/agents/workflows', method: 'GET', description: 'List workflows' },
      { path: '/api/agents/workflows', method: 'POST', description: 'Create workflow', body: { name: 'test' } },
    ];

    for (const endpoint of endpoints) {
      const result = await this.makeRequest(endpoint.path, endpoint.method, {
        body: endpoint.body,
      });

      this.addResult({
        endpoint: endpoint.path,
        method: endpoint.method,
        category: 'Agent Management',
        status: result.status !== 404 && result.status !== 500 ? 'working' : 'broken',
        statusCode: result.status,
        error: result.error,
        authRequired: result.status === 401,
        notes: endpoint.description,
      });
    }
  }

  async testBusinessLogicAPIs() {
    console.log('\n💼 Testing Business Logic APIs...\n');

    const endpoints = [
      {
        path: '/api/deals/create-from-email',
        method: 'POST',
        body: { emailContent: 'Test email content', from: 'test@example.com' },
      },
      {
        path: '/api/deals/create-from-template',
        method: 'POST',
        body: { templateId: 'test-template', data: {} },
      },
      {
        path: '/api/deals/quick-create',
        method: 'POST',
        body: { name: 'Test Deal', amount: 10000 },
      },
      {
        path: '/api/deals/metrics',
        method: 'GET',
      },
    ];

    for (const endpoint of endpoints) {
      const result = await this.makeRequest(endpoint.path, endpoint.method, {
        body: endpoint.body,
      });

      this.addResult({
        endpoint: endpoint.path,
        method: endpoint.method,
        category: 'Business Logic',
        status: result.status !== 404 && result.status !== 500 ? 'working' : 'broken',
        statusCode: result.status,
        error: result.error,
        authRequired: result.status === 401,
      });
    }
  }

  async testIntegrationAPIs() {
    console.log('\n🔌 Testing Integration APIs...\n');

    const endpoints = [
      // Microsoft APIs
      { path: '/api/microsoft/emails', method: 'GET', category: 'Microsoft' },
      { path: '/api/microsoft/emails', method: 'POST', category: 'Microsoft', body: { to: 'test@example.com', subject: 'Test', content: 'Test' } },
      { path: '/api/microsoft/calendar', method: 'GET', category: 'Microsoft' },
      { path: '/api/microsoft/calendar', method: 'POST', category: 'Microsoft', body: { title: 'Test Event' } },
      { path: '/api/microsoft/contacts', method: 'GET', category: 'Microsoft' },
      { path: '/api/microsoft/contacts', method: 'POST', category: 'Microsoft', body: { name: 'Test Contact' } },
      
      // Zoom APIs
      { path: '/api/zoom/meetings', method: 'GET', category: 'Zoom' },
      { path: '/api/zoom/meetings', method: 'POST', category: 'Zoom', body: { topic: 'Test Meeting' } },
      
      // Twilio APIs
      { path: '/api/twilio/sms', method: 'POST', category: 'Twilio', body: { to: '+1234567890', message: 'Test' } },
      { path: '/api/twilio/voice', method: 'POST', category: 'Twilio', body: { to: '+1234567890' } },
      { path: '/api/twilio/status', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/config', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/ivr', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/ivr', method: 'POST', category: 'Twilio', body: { name: 'Test IVR' } },
      { path: '/api/twilio/ivr/execute', method: 'POST', category: 'Twilio', body: { flowId: 'test-id' } },
      { path: '/api/twilio/sms/templates', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/sms/campaigns', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/sync', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/sync/websocket', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/analytics', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/conferences', method: 'GET', category: 'Twilio' },
      { path: '/api/twilio/conferences', method: 'POST', category: 'Twilio', body: { name: 'Test Conference' } },
      
      // Zoho APIs
      { path: '/api/zoho/queue', method: 'GET', category: 'Zoho' },
      { path: '/api/zoho/queue', method: 'POST', category: 'Zoho', body: { action: 'process' } },
    ];

    for (const endpoint of endpoints) {
      const result = await this.makeRequest(endpoint.path, endpoint.method, {
        body: endpoint.body,
      });

      this.addResult({
        endpoint: endpoint.path,
        method: endpoint.method,
        category: `Integration - ${endpoint.category}`,
        status: result.status !== 404 && result.status !== 500 ? 'working' : 'broken',
        statusCode: result.status,
        error: result.error,
        authRequired: result.status === 401,
      });
    }
  }

  async testAIChatAPIs() {
    console.log('\n🤖 Testing AI/Chat APIs...\n');

    const endpoints = [
      {
        path: '/api/chat',
        method: 'POST',
        body: { message: 'Hello', model: 'gpt-4' },
      },
      {
        path: '/api/chat/stream',
        method: 'POST',
        body: { message: 'Hello', model: 'gpt-4' },
      },
      {
        path: '/api/gemini',
        method: 'POST',
        body: { prompt: 'Hello' },
      },
    ];

    for (const endpoint of endpoints) {
      const result = await this.makeRequest(endpoint.path, endpoint.method, {
        body: endpoint.body,
      });

      this.addResult({
        endpoint: endpoint.path,
        method: endpoint.method,
        category: 'AI/Chat',
        status: result.status !== 404 && result.status !== 500 ? 'working' : 'broken',
        statusCode: result.status,
        error: result.error,
        authRequired: result.status === 401,
      });
    }
  }

  async testFileOperations() {
    console.log('\n📁 Testing File Operations...\n');

    // Test file upload with mock FormData
    const uploadResult = await this.makeRequest('/api/upload', 'POST', {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: { file: 'mock-file-data' },
    });

    this.addResult({
      endpoint: '/api/upload',
      method: 'POST',
      category: 'File Operations',
      status: uploadResult.status !== 404 ? 'working' : 'broken',
      statusCode: uploadResult.status,
      error: uploadResult.error,
      authRequired: uploadResult.status === 401,
      notes: 'Requires proper FormData with file',
    });
  }

  async testWebhookEndpoints() {
    console.log('\n🪝 Testing Webhook Endpoints...\n');

    const webhooks = [
      { path: '/api/webhooks/zoom', description: 'Zoom webhook' },
      { path: '/api/webhooks/email', description: 'Email webhook' },
      { path: '/api/twilio/webhooks/sms', description: 'Twilio SMS webhook' },
      { path: '/api/twilio/webhooks/voice', description: 'Twilio Voice webhook' },
      { path: '/api/twilio/webhooks/call-status', description: 'Twilio Call Status webhook' },
      { path: '/api/twilio/webhooks/ivr-handler', description: 'Twilio IVR Handler webhook' },
      { path: '/api/twilio/webhooks/recording', description: 'Twilio Recording webhook' },
      { path: '/api/twilio/webhooks/transcription', description: 'Twilio Transcription webhook' },
    ];

    for (const webhook of webhooks) {
      // Test without auth (should work)
      const result = await this.makeRequest(webhook.path, 'POST', {
        body: { test: true },
      });

      this.addResult({
        endpoint: webhook.path,
        method: 'POST',
        category: 'Webhooks',
        status: result.status !== 404 && result.status !== 401 ? 'working' : 'broken',
        statusCode: result.status,
        error: result.error,
        authRequired: false,
        notes: `${webhook.description} - Should not require auth`,
      });

      // Test rate limiting (make multiple requests)
      console.log(`  Testing rate limiting for ${webhook.path}...`);
      let rateLimitHit = false;
      for (let i = 0; i < 15; i++) {
        const rateLimitTest = await this.makeRequest(webhook.path, 'POST', {
          body: { test: true, attempt: i },
        });
        if (rateLimitTest.status === 429) {
          rateLimitHit = true;
          break;
        }
      }

      if (rateLimitHit) {
        console.log(`  ✓ Rate limiting working for ${webhook.path}`);
      } else {
        console.log(`  ⚠️  Rate limiting may not be configured for ${webhook.path}`);
      }
    }
  }

  async testRateLimiting() {
    console.log('\n⏱️  Testing Rate Limiting...\n');

    const testEndpoint = '/api/agents/stats';
    let rateLimitHit = false;
    let requestCount = 0;

    console.log(`Making rapid requests to ${testEndpoint}...`);
    
    for (let i = 0; i < 25; i++) {
      const result = await this.makeRequest(testEndpoint);
      requestCount++;
      
      if (result.status === 429) {
        rateLimitHit = true;
        console.log(`Rate limit hit after ${requestCount} requests`);
        break;
      }
    }

    this.addResult({
      endpoint: testEndpoint,
      method: 'GET',
      category: 'Rate Limiting',
      status: rateLimitHit ? 'working' : 'broken',
      statusCode: rateLimitHit ? 429 : 200,
      notes: `Rate limiting ${rateLimitHit ? 'working' : 'not detected'} after ${requestCount} requests`,
      rateLimitChecked: true,
    });
  }

  generateReport() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 API ENDPOINT VALIDATION REPORT');
    console.log('='.repeat(80) + '\n');

    // Summary statistics
    const working = this.results.filter(r => r.status === 'working').length;
    const broken = this.results.filter(r => r.status === 'broken').length;
    const partial = this.results.filter(r => r.status === 'partial').length;
    const total = this.results.length;

    console.log('📈 SUMMARY STATISTICS:');
    console.log(`Total Endpoints Tested: ${total}`);
    console.log(`✅ Working: ${working} (${((working/total)*100).toFixed(1)}%)`);
    console.log(`❌ Broken: ${broken} (${((broken/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Partial: ${partial} (${((partial/total)*100).toFixed(1)}%)`);

    // Group results by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    console.log('\n📁 RESULTS BY CATEGORY:\n');
    
    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      console.log(`\n${category}:`);
      console.log('-'.repeat(category.length + 1));
      
      for (const result of categoryResults) {
        const icon = result.status === 'working' ? '✅' : result.status === 'broken' ? '❌' : '⚠️';
        console.log(`${icon} ${result.method} ${result.endpoint}`);
        
        if (result.statusCode) {
          console.log(`   Status: ${result.statusCode}`);
        }
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        if (result.authRequired !== undefined) {
          console.log(`   Auth Required: ${result.authRequired ? 'Yes' : 'No'}`);
        }
        if (result.notes) {
          console.log(`   Notes: ${result.notes}`);
        }
      }
    }

    // Authentication Coverage
    console.log('\n🔐 AUTHENTICATION COVERAGE:\n');
    const authRequired = this.results.filter(r => r.authRequired === true);
    const authNotRequired = this.results.filter(r => r.authRequired === false);
    console.log(`Endpoints requiring auth: ${authRequired.length}`);
    console.log(`Endpoints not requiring auth: ${authNotRequired.length}`);
    console.log(`Webhooks without auth: ${this.results.filter(r => r.category === 'Webhooks' && !r.authRequired).length}`);

    // Rate Limiting
    console.log('\n⏱️  RATE LIMITING:\n');
    const rateLimitTested = this.results.filter(r => r.rateLimitChecked);
    console.log(`Rate limiting tested on ${rateLimitTested.length} endpoint(s)`);
    for (const result of rateLimitTested) {
      console.log(`- ${result.endpoint}: ${result.notes}`);
    }

    // Broken Endpoints Detail
    const brokenEndpoints = this.results.filter(r => r.status === 'broken');
    if (brokenEndpoints.length > 0) {
      console.log('\n❌ BROKEN ENDPOINTS REQUIRING ATTENTION:\n');
      for (const result of brokenEndpoints) {
        console.log(`${result.method} ${result.endpoint}`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
        console.log(`  Status Code: ${result.statusCode || 'N/A'}`);
      }
    }

    // Export results to JSON
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        working,
        broken,
        partial,
        percentageWorking: ((working/total)*100).toFixed(1),
      },
      results: this.results,
    };

    console.log('\n\n💾 Full report saved to: api-validation-report.json');
    return reportData;
  }

  async runAllTests() {
    console.log('🚀 Starting EVA Platform API Endpoint Validation...');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log('='.repeat(80));

    await this.testAuthenticationFlow();
    await this.testAgentManagementAPIs();
    await this.testBusinessLogicAPIs();
    await this.testIntegrationAPIs();
    await this.testAIChatAPIs();
    await this.testFileOperations();
    await this.testWebhookEndpoints();
    await this.testRateLimiting();

    const report = this.generateReport();
    
    // Save report to file
    const fs = await import('fs/promises');
    await fs.writeFile(
      join(__dirname, 'api-validation-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

// Run the validator
const validator = new APIEndpointValidator();
validator.runAllTests().catch(console.error);