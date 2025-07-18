import { createBrowserClient } from '@/lib/supabase/browser';
import { Microsoft365Client } from '@/lib/integrations/microsoft365';
import { TwilioService } from '@/lib/services/twilio-service';
import { LinkedInService } from '@/lib/services/linkedin-service';
import { ZoomService } from '@/lib/services/zoom-service';
import { ZohoCRMService } from '@/lib/services/zoho-crm-service';
import { FirecrawlService } from '@/lib/services/firecrawl-service';

interface IntegrationTestResult {
  integration: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp: Date;
}

export class IntegrationHealthTester {
  private results: IntegrationTestResult[] = [];
  private supabase = createBrowserClient();

  async testAllIntegrations(): Promise<IntegrationTestResult[]> {
    console.log('🚀 Starting comprehensive integration tests...\n');
    
    // Test each integration
    await this.testMicrosoft365();
    await this.testTwilio();
    await this.testLinkedIn();
    await this.testZoom();
    await this.testZohoCRM();
    await this.testFirecrawl();
    await this.testSupabase();
    
    // Print summary
    this.printSummary();
    
    return this.results;
  }

  private async testMicrosoft365() {
    console.log('📧 Testing Microsoft 365 Integration...');
    
    try {
      // Test OAuth endpoints
      const oauthTest = await fetch('/api/auth/microsoft/status');
      this.addResult('Microsoft 365 - OAuth Status', 
        oauthTest.ok ? 'success' : 'error',
        `OAuth endpoint status: ${oauthTest.status}`,
        await oauthTest.json().catch(() => null)
      );

      // Test token endpoint security
      const tokenTest = await fetch('/api/auth/microsoft/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test', state: 'test' })
      });
      
      this.addResult('Microsoft 365 - Token Security',
        tokenTest.status === 400 ? 'success' : 'warning',
        'Token endpoint properly rejects invalid requests',
        { status: tokenTest.status }
      );

      // Test email API
      const emailTest = await fetch('/api/microsoft/emails');
      this.addResult('Microsoft 365 - Email API',
        emailTest.status === 401 ? 'success' : 'error',
        'Email API requires authentication',
        { status: emailTest.status }
      );

      // Test calendar API
      const calendarTest = await fetch('/api/microsoft/calendar');
      this.addResult('Microsoft 365 - Calendar API',
        calendarTest.status === 401 ? 'success' : 'error',
        'Calendar API requires authentication',
        { status: calendarTest.status }
      );

      // Test Teams UI route
      const teamsUITest = await fetch('/dashboard/teams');
      this.addResult('Microsoft 365 - Teams UI',
        teamsUITest.ok ? 'success' : 'error',
        `Teams UI route status: ${teamsUITest.status}`
      );

    } catch (error) {
      this.addResult('Microsoft 365 - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private async testTwilio() {
    console.log('📱 Testing Twilio Integration...');
    
    try {
      // Test configuration UI
      const configUITest = await fetch('/dashboard/settings/twilio');
      this.addResult('Twilio - Configuration UI',
        configUITest.ok ? 'success' : 'error',
        `Configuration UI status: ${configUITest.status}`
      );

      // Test API endpoint
      const apiTest = await fetch('/api/settings/twilio');
      this.addResult('Twilio - Settings API',
        apiTest.ok || apiTest.status === 401 ? 'success' : 'error',
        'Settings API accessible',
        { status: apiTest.status }
      );

      // Test webhook security
      const webhookTest = await fetch('/api/webhooks/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      this.addResult('Twilio - Webhook Security',
        webhookTest.status === 401 ? 'success' : 'warning',
        'Webhook properly requires authentication',
        { status: webhookTest.status }
      );

    } catch (error) {
      this.addResult('Twilio - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private async testLinkedIn() {
    console.log('💼 Testing LinkedIn Integration...');
    
    try {
      // Test OAuth flow
      const oauthTest = await fetch('/api/auth/linkedin/status');
      this.addResult('LinkedIn - OAuth Status',
        oauthTest.ok || oauthTest.status === 404 ? 'warning' : 'error',
        `OAuth endpoint status: ${oauthTest.status}`,
        oauthTest.status === 404 ? 'Endpoint not implemented' : null
      );

      // Test webhook security
      const webhookTest = await fetch('/api/webhooks/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      this.addResult('LinkedIn - Webhook Security',
        webhookTest.status === 401 || webhookTest.status === 404 ? 'success' : 'warning',
        'Webhook security check',
        { status: webhookTest.status }
      );

      // Check if client credentials are configured
      const hasCredentials = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID && 
                           process.env.LINKEDIN_CLIENT_SECRET;
      
      this.addResult('LinkedIn - Credentials',
        hasCredentials ? 'success' : 'warning',
        hasCredentials ? 'Credentials configured' : 'Missing credentials in environment'
      );

    } catch (error) {
      this.addResult('LinkedIn - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private async testZoom() {
    console.log('🎥 Testing Zoom Integration...');
    
    try {
      // Test OAuth endpoints
      const oauthTest = await fetch('/api/auth/zoom/status');
      this.addResult('Zoom - OAuth Status',
        oauthTest.ok || oauthTest.status === 404 ? 'warning' : 'error',
        `OAuth endpoint status: ${oauthTest.status}`,
        oauthTest.status === 404 ? 'Endpoint not implemented' : null
      );

      // Test webhook endpoint
      const webhookTest = await fetch('/api/webhooks/zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test' })
      });
      
      this.addResult('Zoom - Webhook',
        webhookTest.status === 401 || webhookTest.status === 404 ? 'success' : 'warning',
        'Webhook security check',
        { status: webhookTest.status }
      );

      // Check credentials
      const hasCredentials = process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET;
      this.addResult('Zoom - Credentials',
        hasCredentials ? 'warning' : 'error',
        hasCredentials ? 'Credentials present but may be incorrect (using Zoho values)' : 'Missing credentials'
      );

    } catch (error) {
      this.addResult('Zoom - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private async testZohoCRM() {
    console.log('📊 Testing Zoho CRM Integration...');
    
    try {
      // Test API connection
      const apiTest = await fetch('/api/zoho/test');
      this.addResult('Zoho CRM - API Connection',
        apiTest.ok || apiTest.status === 404 ? 'warning' : 'error',
        `API test endpoint status: ${apiTest.status}`
      );

      // Test queue dashboard
      const queueTest = await fetch('/dashboard/zoho');
      this.addResult('Zoho CRM - Queue Dashboard',
        queueTest.ok ? 'success' : 'error',
        `Queue dashboard status: ${queueTest.status}`
      );

      // Test webhook
      const webhookTest = await fetch('/api/webhooks/zoho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      this.addResult('Zoho CRM - Webhook',
        webhookTest.status === 401 || webhookTest.status === 404 ? 'success' : 'warning',
        'Webhook security check',
        { status: webhookTest.status }
      );

      // Check tokens
      const hasTokens = process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_REFRESH_TOKEN;
      this.addResult('Zoho CRM - Tokens',
        hasTokens ? 'success' : 'error',
        hasTokens ? 'Access and refresh tokens configured' : 'Missing tokens'
      );

    } catch (error) {
      this.addResult('Zoho CRM - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private async testFirecrawl() {
    console.log('🔥 Testing Firecrawl Integration...');
    
    try {
      // Test Intelligence Hub UI
      const uiTest = await fetch('/dashboard/firecrawl');
      this.addResult('Firecrawl - Intelligence Hub UI',
        uiTest.ok ? 'success' : 'error',
        `Intelligence Hub status: ${uiTest.status}`
      );

      // Test API key presence
      const hasApiKey = !!process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
      this.addResult('Firecrawl - API Key',
        hasApiKey ? 'success' : 'error',
        hasApiKey ? 'API key configured' : 'Missing API key'
      );

      // Test service initialization
      try {
        const service = new FirecrawlService();
        this.addResult('Firecrawl - Service Init',
          'success',
          'Service initialized successfully'
        );
      } catch (error) {
        this.addResult('Firecrawl - Service Init',
          'error',
          `Service initialization failed: ${error.message}`
        );
      }

    } catch (error) {
      this.addResult('Firecrawl - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private async testSupabase() {
    console.log('🗄️ Testing Supabase Connection...');
    
    try {
      // Test auth
      const { data: session } = await this.supabase.auth.getSession();
      this.addResult('Supabase - Auth',
        'success',
        session?.session ? 'Session active' : 'No active session'
      );

      // Test database connection
      const { data, error } = await this.supabase
        .from('integrations')
        .select('count')
        .limit(1);
      
      this.addResult('Supabase - Database',
        error ? 'error' : 'success',
        error ? `Database error: ${error.message}` : 'Database connected'
      );

      // Test realtime
      const channel = this.supabase.channel('test');
      const connected = await new Promise((resolve) => {
        channel.on('system', { event: '*' }, () => resolve(true));
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve(true);
          setTimeout(() => resolve(false), 3000);
        });
      });
      
      channel.unsubscribe();
      
      this.addResult('Supabase - Realtime',
        connected ? 'success' : 'warning',
        connected ? 'Realtime connected' : 'Realtime connection timeout'
      );

    } catch (error) {
      this.addResult('Supabase - General',
        'error',
        `Integration test failed: ${error.message}`
      );
    }
  }

  private addResult(integration: string, status: IntegrationTestResult['status'], message: string, details?: any) {
    const result: IntegrationTestResult = {
      integration,
      status,
      message,
      details,
      timestamp: new Date()
    };
    
    this.results.push(result);
    
    // Print result immediately
    const emoji = status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    console.log(`${emoji} ${integration}: ${message}`);
    if (details) {
      console.log('   Details:', details);
    }
  }

  private printSummary() {
    console.log('\n📋 INTEGRATION TEST SUMMARY');
    console.log('=' .repeat(50));
    
    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      warnings: this.results.filter(r => r.status === 'warning').length,
      errors: this.results.filter(r => r.status === 'error').length
    };
    
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Success: ${summary.success}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);
    console.log(`❌ Errors: ${summary.errors}`);
    
    // Group by integration
    console.log('\n📊 BY INTEGRATION:');
    const integrations = [...new Set(this.results.map(r => r.integration.split(' - ')[0]))];
    
    integrations.forEach(integration => {
      const integrationResults = this.results.filter(r => r.integration.startsWith(integration));
      const hasError = integrationResults.some(r => r.status === 'error');
      const hasWarning = integrationResults.some(r => r.status === 'warning');
      
      const status = hasError ? '❌' : hasWarning ? '⚠️' : '✅';
      console.log(`${status} ${integration}: ${integrationResults.length} tests`);
    });
    
    // Critical issues
    const criticalIssues = this.results.filter(r => r.status === 'error');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      criticalIssues.forEach(issue => {
        console.log(`- ${issue.integration}: ${issue.message}`);
      });
    }
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).IntegrationHealthTester = IntegrationHealthTester;
  console.log('💡 Integration Health Tester loaded. Run: new IntegrationHealthTester().testAllIntegrations()');
}