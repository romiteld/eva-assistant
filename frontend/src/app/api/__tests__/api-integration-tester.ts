import { NextRequest } from 'next/server';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  data?: any;
  testType: string;
  timestamp: string;
}

interface TestConfig {
  baseUrl: string;
  authToken?: string;
  verbose?: boolean;
}

export class APIIntegrationTester {
  private results: TestResult[] = [];
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<TestResult> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.authToken && { Authorization: `Bearer ${this.config.authToken}` }),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseTime = Date.now() - start;
      let data;

      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }

      const result: TestResult = {
        endpoint,
        method,
        status: response.status,
        success: response.ok,
        data,
        testType: 'basic',
        timestamp: new Date().toISOString(),
      };

      if (this.config.verbose) {
        console.log(`✓ ${method} ${endpoint} - ${response.status} (${responseTime}ms)`);
      }

      return result;
    } catch (error) {
      const result: TestResult = {
        endpoint,
        method,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        testType: 'basic',
        timestamp: new Date().toISOString(),
      };

      if (this.config.verbose) {
        console.error(`✗ ${method} ${endpoint} - Error: ${result.error}`);
      }

      return result;
    }
  }

  // Test authentication endpoints
  async testAuthEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test auth status
    results.push(await this.makeRequest('/api/auth-status', 'GET'));

    // Test CSRF token
    results.push(await this.makeRequest('/api/csrf', 'GET'));

    // Test session verification
    results.push(await this.makeRequest('/api/verify-session', 'GET'));

    // Test Microsoft auth endpoints
    results.push(await this.makeRequest('/api/auth/microsoft/session', 'GET'));

    // Test Zoom auth endpoints
    results.push(await this.makeRequest('/api/auth/zoom', 'GET'));
    results.push(await this.makeRequest('/api/auth/zoom/token', 'GET'));

    this.results.push(...results);
    return results;
  }

  // Test agent endpoints
  async testAgentEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test agent monitoring
    results.push(await this.makeRequest('/api/agents/monitor', 'GET'));

    // Test agent stats
    results.push(await this.makeRequest('/api/agents/stats', 'GET'));

    // Test agent workflows
    results.push(await this.makeRequest('/api/agents/workflows', 'GET'));

    // Test agent assignment (requires body)
    results.push(
      await this.makeRequest('/api/agents/assign', 'POST', {
        taskId: 'test-task',
        agentType: 'research',
      })
    );

    this.results.push(...results);
    return results;
  }

  // Test Zoho endpoints
  async testZohoEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test queue endpoints
    results.push(await this.makeRequest('/api/zoho/queue', 'GET'));
    results.push(
      await this.makeRequest('/api/zoho/queue', 'POST', {
        type: 'create_lead',
        data: { name: 'Test Lead' },
      })
    );

    // Test worker endpoint
    results.push(await this.makeRequest('/api/zoho/worker', 'POST'));

    // Test webhook endpoint
    results.push(
      await this.makeRequest('/api/zoho/webhooks', 'POST', {
        module: 'Leads',
        operation: 'create',
        entity_id: 'test-id',
      })
    );

    this.results.push(...results);
    return results;
  }

  // Test Twilio endpoints
  async testTwilioEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test status
    results.push(await this.makeRequest('/api/twilio/status', 'GET'));

    // Test config
    results.push(await this.makeRequest('/api/twilio/config', 'GET'));

    // Test SMS endpoints
    results.push(await this.makeRequest('/api/twilio/sms', 'GET'));
    results.push(await this.makeRequest('/api/twilio/sms/templates', 'GET'));
    results.push(await this.makeRequest('/api/twilio/sms/campaigns', 'GET'));

    // Test voice endpoints
    results.push(await this.makeRequest('/api/twilio/voice', 'GET'));

    // Test conference endpoints
    results.push(await this.makeRequest('/api/twilio/conferences', 'GET'));

    // Test IVR endpoints
    results.push(await this.makeRequest('/api/twilio/ivr', 'GET'));

    // Test analytics
    results.push(await this.makeRequest('/api/twilio/analytics', 'GET'));

    this.results.push(...results);
    return results;
  }

  // Test Microsoft endpoints
  async testMicrosoftEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test email endpoints
    results.push(await this.makeRequest('/api/microsoft/emails', 'GET'));

    // Test calendar endpoints
    results.push(await this.makeRequest('/api/microsoft/calendar', 'GET'));

    // Test contacts endpoints
    results.push(await this.makeRequest('/api/microsoft/contacts', 'GET'));

    this.results.push(...results);
    return results;
  }

  // Test Zoom endpoints
  async testZoomEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test user endpoint
    results.push(await this.makeRequest('/api/zoom/user', 'GET'));

    // Test meetings endpoints
    results.push(await this.makeRequest('/api/zoom/meetings', 'GET'));
    results.push(await this.makeRequest('/api/zoom/meetings/get', 'GET'));

    // Test meeting creation
    results.push(
      await this.makeRequest('/api/zoom/meetings/create', 'POST', {
        topic: 'Test Meeting',
        duration: 30,
      })
    );

    this.results.push(...results);
    return results;
  }

  // Test webhook endpoints
  async testWebhookEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test email webhook
    results.push(
      await this.makeRequest('/api/webhooks/email', 'POST', {
        from: 'test@example.com',
        subject: 'Test Email',
        body: 'Test content',
      })
    );

    // Test Zoom webhook
    results.push(
      await this.makeRequest('/api/webhooks/zoom', 'POST', {
        event: 'meeting.started',
        payload: { meeting_id: 'test-meeting' },
      })
    );

    // Test Twilio webhooks
    results.push(
      await this.makeRequest('/api/twilio/webhooks/sms', 'POST', {
        From: '+1234567890',
        To: '+0987654321',
        Body: 'Test SMS',
      })
    );

    results.push(
      await this.makeRequest('/api/twilio/webhooks/voice', 'POST', {
        CallSid: 'test-call-id',
        From: '+1234567890',
        To: '+0987654321',
      })
    );

    this.results.push(...results);
    return results;
  }

  // Test deal automation endpoints
  async testDealEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test deal creation endpoints
    results.push(
      await this.makeRequest('/api/deals/quick-create', 'POST', {
        dealName: 'Test Deal',
        contactEmail: 'test@example.com',
      })
    );

    results.push(
      await this.makeRequest('/api/deals/create-from-email', 'POST', {
        emailData: {
          from: 'test@example.com',
          subject: 'Interested in services',
          body: 'Please contact me',
        },
      })
    );

    results.push(
      await this.makeRequest('/api/deals/create-from-template', 'POST', {
        templateId: 'test-template',
        variables: { name: 'Test Client' },
      })
    );

    // Test metrics
    results.push(await this.makeRequest('/api/deals/metrics', 'GET'));

    this.results.push(...results);
    return results;
  }

  // Test utility endpoints
  async testUtilityEndpoints(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test health check
    results.push(await this.makeRequest('/api/health', 'GET'));
    results.push(await this.makeRequest('/api/health/database', 'GET'));

    // Test monitoring
    results.push(await this.makeRequest('/api/monitoring/metrics', 'GET'));

    // Test chat endpoints
    results.push(
      await this.makeRequest('/api/chat', 'POST', {
        message: 'Hello, test message',
      })
    );

    // Test upload endpoint
    const formData = new FormData();
    formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          ...(this.config.authToken && { Authorization: `Bearer ${this.config.authToken}` }),
        },
        body: formData,
      });

      results.push({
        endpoint: '/api/upload',
        method: 'POST',
        status: response.status,
        success: response.ok,
        testType: 'file-upload',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        endpoint: '/api/upload',
        method: 'POST',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        testType: 'file-upload',
        timestamp: new Date().toISOString(),
      });
    }

    this.results.push(...results);
    return results;
  }

  // Test error handling
  async testErrorHandling(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test invalid endpoints
    results.push(await this.makeRequest('/api/nonexistent', 'GET'));

    // Test invalid methods
    results.push(await this.makeRequest('/api/health', 'DELETE'));

    // Test missing required fields
    results.push(await this.makeRequest('/api/agents/assign', 'POST', {}));

    // Test invalid JSON
    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.authToken && { Authorization: `Bearer ${this.config.authToken}` }),
        },
        body: 'invalid json',
      });

      results.push({
        endpoint: '/api/chat',
        method: 'POST',
        status: response.status,
        success: response.ok,
        testType: 'error-handling',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        endpoint: '/api/chat',
        method: 'POST',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        testType: 'error-handling',
        timestamp: new Date().toISOString(),
      });
    }

    this.results.push(...results);
    return results;
  }

  // Test rate limiting
  async testRateLimiting(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const endpoint = '/api/health';

    // Make rapid requests
    for (let i = 0; i < 20; i++) {
      const result = await this.makeRequest(endpoint, 'GET');
      result.testType = 'rate-limiting';
      results.push(result);
      
      // Check if we hit rate limit
      if (result.status === 429) {
        console.log(`Rate limit hit after ${i + 1} requests`);
        break;
      }
    }

    this.results.push(...results);
    return results;
  }

  // Test CORS configuration
  async testCORS(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test preflight request
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      const corsHeaders = {
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
      };

      results.push({
        endpoint: '/api/health',
        method: 'OPTIONS',
        status: response.status,
        success: response.ok,
        data: corsHeaders,
        testType: 'cors',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        endpoint: '/api/health',
        method: 'OPTIONS',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        testType: 'cors',
        timestamp: new Date().toISOString(),
      });
    }

    this.results.push(...results);
    return results;
  }

  // Generate comprehensive report
  generateReport(): string {
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;

    const byEndpoint = this.results.reduce((acc, result) => {
      const key = `${result.method} ${result.endpoint}`;
      if (!acc[key]) {
        acc[key] = { success: 0, failed: 0, statuses: [] };
      }
      if (result.success) {
        acc[key].success++;
      } else {
        acc[key].failed++;
      }
      acc[key].statuses.push(result.status);
      return acc;
    }, {} as Record<string, { success: number; failed: number; statuses: number[] }>);

    const report = `
# API Integration Test Report

Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${totalTests}
- Successful: ${successfulTests} (${((successfulTests / totalTests) * 100).toFixed(2)}%)
- Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(2)}%)

## Results by Endpoint

${Object.entries(byEndpoint)
  .map(([endpoint, stats]) => {
    const statusCodes = [...new Set(stats.statuses)].join(', ');
    return `### ${endpoint}
- Success: ${stats.success}
- Failed: ${stats.failed}
- Status Codes: ${statusCodes}`;
  })
  .join('\n\n')}

## Failed Tests

${this.results
  .filter(r => !r.success)
  .map(r => `- ${r.method} ${r.endpoint}: ${r.error || `Status ${r.status}`}`)
  .join('\n')}

## Security Issues

${this.identifySecurityIssues().join('\n')}

## Performance Issues

${this.identifyPerformanceIssues().join('\n')}
`;

    return report;
  }

  private identifySecurityIssues(): string[] {
    const issues: string[] = [];

    // Check for missing authentication
    const unauthenticatedEndpoints = this.results.filter(
      r => r.success && r.status === 200 && !r.endpoint.includes('/health') && !r.endpoint.includes('/auth')
    );

    if (unauthenticatedEndpoints.length > 0) {
      issues.push('- Some endpoints may be accessible without authentication');
    }

    // Check for CORS issues
    const corsResults = this.results.filter(r => r.testType === 'cors');
    if (corsResults.some(r => r.data?.['access-control-allow-origin'] === '*')) {
      issues.push('- CORS policy allows all origins (security risk)');
    }

    // Check for detailed error messages
    const detailedErrors = this.results.filter(
      r => !r.success && r.data && typeof r.data === 'object' && 'stack' in r.data
    );
    if (detailedErrors.length > 0) {
      issues.push('- Stack traces exposed in error responses');
    }

    return issues.length > 0 ? issues : ['- No security issues detected'];
  }

  private identifyPerformanceIssues(): string[] {
    const issues: string[] = [];

    // Check for missing rate limiting
    const rateLimitTests = this.results.filter(r => r.testType === 'rate-limiting');
    if (!rateLimitTests.some(r => r.status === 429)) {
      issues.push('- No rate limiting detected on tested endpoints');
    }

    return issues.length > 0 ? issues : ['- No performance issues detected'];
  }

  // Run all tests
  async runAllTests(): Promise<void> {
    console.log('Starting API Integration Tests...\n');

    await this.testAuthEndpoints();
    await this.testAgentEndpoints();
    await this.testZohoEndpoints();
    await this.testTwilioEndpoints();
    await this.testMicrosoftEndpoints();
    await this.testZoomEndpoints();
    await this.testWebhookEndpoints();
    await this.testDealEndpoints();
    await this.testUtilityEndpoints();
    await this.testErrorHandling();
    await this.testRateLimiting();
    await this.testCORS();

    console.log('\nTests completed. Generating report...');
  }
}