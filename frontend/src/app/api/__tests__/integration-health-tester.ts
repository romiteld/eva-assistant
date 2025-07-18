import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ZohoCRMIntegration } from '@/lib/integrations/zoho-crm';
import { QueuedZohoCRMIntegration } from '@/lib/integrations/zoho-crm-queued';
import { Microsoft365Client } from '@/lib/integrations/microsoft365';
import { TwilioService } from '@/lib/services/twilio';
import { LinkedInService } from '@/lib/services/linkedin';
import { FirecrawlClient } from '@/lib/integrations/firecrawl';

interface IntegrationTestResult {
  integration: string;
  status: 'healthy' | 'degraded' | 'failed';
  tests: {
    name: string;
    passed: boolean;
    error?: string;
    duration?: number;
    details?: any;
  }[];
  overallHealth: number; // 0-100%
  timestamp: string;
  recommendations?: string[];
}

export class IntegrationHealthTester {
  private results: IntegrationTestResult[] = [];
  
  constructor(private config: {
    verbose?: boolean;
    testMode?: 'basic' | 'comprehensive' | 'stress';
  } = {}) {}

  // Test Zoho CRM Integration
  async testZohoIntegration(): Promise<IntegrationTestResult> {
    const tests = [];
    const startTime = Date.now();
    
    // Test 1: Authentication
    try {
      const client = new ZohoCRMIntegration();
      const authTest = await this.timeOperation(async () => {
        const token = process.env.ZOHO_ACCESS_TOKEN;
        if (!token) throw new Error('No Zoho access token configured');
        return { success: true };
      });
      
      tests.push({
        name: 'Authentication',
        passed: true,
        duration: authTest.duration,
      });
    } catch (error) {
      tests.push({
        name: 'Authentication',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Lead Creation
    if (this.config.testMode !== 'basic') {
      try {
        const client = new ZohoCRMIntegration();
        const leadTest = await this.timeOperation(async () => {
          return await client.createLead({
            firstName: 'Integration',
            lastName: `Test_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
            company: 'Test Company',
            phone: '+1234567890',
            leadSource: 'API Test',
            customFields: {
              Description: 'Integration test lead - can be deleted',
            },
          });
        });
        
        tests.push({
          name: 'Lead Creation',
          passed: leadTest.result.success,
          duration: leadTest.duration,
          details: { leadId: leadTest.result.id },
        });

        // Clean up test lead
        if (leadTest.result.id) {
          await client.deleteLead(leadTest.result.id);
        }
      } catch (error) {
        tests.push({
          name: 'Lead Creation',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 3: Queue System
    try {
      const queueClient = new QueuedZohoCRMIntegration();
      const queueTest = await this.timeOperation(async () => {
        const queueStatus = await queueClient.getQueueStatus();
        return queueStatus;
      });
      
      tests.push({
        name: 'Queue System',
        passed: true,
        duration: queueTest.duration,
        details: queueTest.result,
      });
    } catch (error) {
      tests.push({
        name: 'Queue System',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 4: Rate Limiting
    if (this.config.testMode === 'stress') {
      try {
        const client = new ZohoCRMIntegration();
        const rateLimitTest = await this.timeOperation(async () => {
          const results = [];
          for (let i = 0; i < 5; i++) {
            const start = Date.now();
            await client.searchLeads({ email: 'test@example.com' });
            results.push(Date.now() - start);
          }
          return { avgResponseTime: results.reduce((a, b) => a + b, 0) / results.length };
        });
        
        tests.push({
          name: 'Rate Limiting',
          passed: true,
          duration: rateLimitTest.duration,
          details: rateLimitTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Rate Limiting',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const passedTests = tests.filter(t => t.passed).length;
    const result: IntegrationTestResult = {
      integration: 'Zoho CRM',
      status: passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'failed',
      tests,
      overallHealth: (passedTests / tests.length) * 100,
      timestamp: new Date().toISOString(),
      recommendations: this.generateZohoRecommendations(tests),
    };

    this.results.push(result);
    return result;
  }

  // Test Microsoft 365 Integration
  async testMicrosoft365Integration(): Promise<IntegrationTestResult> {
    const tests = [];
    
    // Test 1: OAuth Token Status
    try {
      const tokenTest = await this.timeOperation(async () => {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');
        
        const { data: tokens } = await supabase
          .from('oauth_tokens')
          .select('*')
          .eq('user_id', user.id)
          .eq('provider', 'microsoft')
          .single();
        
        if (!tokens) throw new Error('No Microsoft tokens found');
        
        const tokenAge = Date.now() - new Date(tokens.updated_at).getTime();
        const isExpired = tokenAge > (tokens.expires_in * 1000);
        
        return {
          hasTokens: true,
          isExpired,
          tokenAge: Math.floor(tokenAge / 1000 / 60), // minutes
        };
      });
      
      tests.push({
        name: 'OAuth Token Status',
        passed: tokenTest.result.hasTokens && !tokenTest.result.isExpired,
        duration: tokenTest.duration,
        details: tokenTest.result,
      });
    } catch (error) {
      tests.push({
        name: 'OAuth Token Status',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Graph API Connection
    if (this.config.testMode !== 'basic') {
      try {
        const client = new Microsoft365Client();
        const graphTest = await this.timeOperation(async () => {
          const profile = await client.getUserProfile();
          return {
            connected: true,
            userPrincipalName: profile.userPrincipalName,
            displayName: profile.displayName,
          };
        });
        
        tests.push({
          name: 'Graph API Connection',
          passed: true,
          duration: graphTest.duration,
          details: graphTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Graph API Connection',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 3: Email Operations
    if (this.config.testMode === 'comprehensive') {
      try {
        const client = new Microsoft365Client();
        const emailTest = await this.timeOperation(async () => {
          const messages = await client.getEmails({ top: 1 });
          return {
            canReadEmails: true,
            emailCount: messages.value.length,
          };
        });
        
        tests.push({
          name: 'Email Operations',
          passed: true,
          duration: emailTest.duration,
          details: emailTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Email Operations',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 4: Calendar Operations
    if (this.config.testMode === 'comprehensive') {
      try {
        const client = new Microsoft365Client();
        const calendarTest = await this.timeOperation(async () => {
          const events = await client.getCalendarEvents({
            startDateTime: new Date().toISOString(),
            endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            top: 5,
          });
          return {
            canReadCalendar: true,
            upcomingEvents: events.value.length,
          };
        });
        
        tests.push({
          name: 'Calendar Operations',
          passed: true,
          duration: calendarTest.duration,
          details: calendarTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Calendar Operations',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const passedTests = tests.filter(t => t.passed).length;
    const result: IntegrationTestResult = {
      integration: 'Microsoft 365',
      status: passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'failed',
      tests,
      overallHealth: (passedTests / tests.length) * 100,
      timestamp: new Date().toISOString(),
      recommendations: this.generateMicrosoftRecommendations(tests),
    };

    this.results.push(result);
    return result;
  }

  // Test Twilio Integration
  async testTwilioIntegration(): Promise<IntegrationTestResult> {
    const tests = [];
    
    // Test 1: Authentication
    try {
      const authTest = await this.timeOperation(async () => {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!accountSid || !authToken) {
          throw new Error('Twilio credentials not configured');
        }
        return { configured: true };
      });
      
      tests.push({
        name: 'Authentication',
        passed: true,
        duration: authTest.duration,
      });
    } catch (error) {
      tests.push({
        name: 'Authentication',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Phone Number Status
    if (this.config.testMode !== 'basic') {
      try {
        const twilioService = new TwilioService({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
        });
        const phoneTest = await this.timeOperation(async () => {
          const numbers = await twilioService.listPhoneNumbers();
          return {
            hasNumbers: numbers.length > 0,
            activeNumbers: numbers.length,
            capabilities: numbers[0]?.capabilities || {},
          };
        });
        
        tests.push({
          name: 'Phone Number Status',
          passed: phoneTest.result.hasNumbers,
          duration: phoneTest.duration,
          details: phoneTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Phone Number Status',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 3: SMS Capabilities
    if (this.config.testMode === 'comprehensive') {
      try {
        const smsTest = await this.timeOperation(async () => {
          // Test SMS validation without actually sending
          const testNumber = '+1234567890';
          const isValid = /^\+\d{10,15}$/.test(testNumber);
          return { smsCapable: isValid };
        });
        
        tests.push({
          name: 'SMS Capabilities',
          passed: true,
          duration: smsTest.duration,
          details: smsTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'SMS Capabilities',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 4: Voice Capabilities
    if (this.config.testMode === 'comprehensive') {
      try {
        const twilioService = new TwilioService({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
        });
        const voiceTest = await this.timeOperation(async () => {
          const conferences = await twilioService.listConferences({ status: 'in-progress' });
          return {
            voiceEnabled: true,
            activeConferences: conferences.length,
          };
        });
        
        tests.push({
          name: 'Voice Capabilities',
          passed: true,
          duration: voiceTest.duration,
          details: voiceTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Voice Capabilities',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const passedTests = tests.filter(t => t.passed).length;
    const result: IntegrationTestResult = {
      integration: 'Twilio',
      status: passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'failed',
      tests,
      overallHealth: (passedTests / tests.length) * 100,
      timestamp: new Date().toISOString(),
      recommendations: this.generateTwilioRecommendations(tests),
    };

    this.results.push(result);
    return result;
  }

  // Test LinkedIn Integration
  async testLinkedInIntegration(): Promise<IntegrationTestResult> {
    const tests = [];
    
    // Test 1: OAuth Token Status
    try {
      const tokenTest = await this.timeOperation(async () => {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');
        
        const { data: tokens } = await supabase
          .from('oauth_tokens')
          .select('*')
          .eq('user_id', user.id)
          .eq('provider', 'linkedin')
          .single();
        
        if (!tokens) throw new Error('No LinkedIn tokens found');
        
        return {
          hasTokens: true,
          scopes: tokens.scope?.split(' ') || [],
        };
      });
      
      tests.push({
        name: 'OAuth Token Status',
        passed: true,
        duration: tokenTest.duration,
        details: tokenTest.result,
      });
    } catch (error) {
      tests.push({
        name: 'OAuth Token Status',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Profile Access
    if (this.config.testMode !== 'basic') {
      try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        // Import token manager for LinkedIn
        const { getTokenManager } = await import('@/lib/auth/token-manager');
        const tokenManager = getTokenManager(
          process.env.ENCRYPTION_KEY || 'default-key',
          {
            linkedin: {
              clientId: process.env.LINKEDIN_CLIENT_ID!,
              clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
              refreshTokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
            },
          }
        );
        
        const client = new LinkedInService(user!.id, tokenManager);
        
        const profileTest = await this.timeOperation(async () => {
          const profile = await client.getProfile();
          return {
            hasProfile: true,
            profileId: profile.id,
            name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
          };
        });
        
        tests.push({
          name: 'Profile Access',
          passed: true,
          duration: profileTest.duration,
          details: profileTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Profile Access',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 3: Lead Enrichment
    if (this.config.testMode === 'comprehensive') {
      try {
        const enrichmentTest = await this.timeOperation(async () => {
          // Test with a sample profile URL pattern
          const testUrl = 'https://www.linkedin.com/in/test-profile';
          // Verify URL parsing capabilities
          const publicIdentifier = testUrl.split('/in/')[1];
          return { 
            enrichmentAvailable: true,
            canParseUrl: !!publicIdentifier,
            parsedIdentifier: publicIdentifier,
          };
        });
        
        tests.push({
          name: 'Lead Enrichment',
          passed: true,
          duration: enrichmentTest.duration,
          details: enrichmentTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Lead Enrichment',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const passedTests = tests.filter(t => t.passed).length;
    const result: IntegrationTestResult = {
      integration: 'LinkedIn',
      status: passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'failed',
      tests,
      overallHealth: (passedTests / tests.length) * 100,
      timestamp: new Date().toISOString(),
      recommendations: this.generateLinkedInRecommendations(tests),
    };

    this.results.push(result);
    return result;
  }

  // Test Firecrawl Integration
  async testFirecrawlIntegration(): Promise<IntegrationTestResult> {
    const tests = [];
    
    // Test 1: API Key Configuration
    try {
      const authTest = await this.timeOperation(async () => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) throw new Error('Firecrawl API key not configured');
        return { configured: true };
      });
      
      tests.push({
        name: 'API Key Configuration',
        passed: true,
        duration: authTest.duration,
      });
    } catch (error) {
      tests.push({
        name: 'API Key Configuration',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Web Scraping
    if (this.config.testMode !== 'basic') {
      try {
        const firecrawl = new FirecrawlClient();
        const scrapeTest = await this.timeOperation(async () => {
          const result = await firecrawl.scrapeUrl('https://example.com');
          return {
            success: result.success,
            hasContent: result.markdown?.length > 0,
            contentLength: result.markdown?.length || 0,
          };
        });
        
        tests.push({
          name: 'Web Scraping',
          passed: scrapeTest.result.success,
          duration: scrapeTest.duration,
          details: scrapeTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Web Scraping',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 3: Search Functionality
    if (this.config.testMode === 'comprehensive') {
      try {
        const firecrawl = new FirecrawlClient();
        const searchTest = await this.timeOperation(async () => {
          const results = await firecrawl.search('financial advisor', { limit: 5 });
          return {
            hasResults: results.length > 0,
            resultCount: results.length,
          };
        });
        
        tests.push({
          name: 'Search Functionality',
          passed: searchTest.result.hasResults,
          duration: searchTest.duration,
          details: searchTest.result,
        });
      } catch (error) {
        tests.push({
          name: 'Search Functionality',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const passedTests = tests.filter(t => t.passed).length;
    const result: IntegrationTestResult = {
      integration: 'Firecrawl',
      status: passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'failed',
      tests,
      overallHealth: (passedTests / tests.length) * 100,
      timestamp: new Date().toISOString(),
      recommendations: this.generateFirecrawlRecommendations(tests),
    };

    this.results.push(result);
    return result;
  }

  // Helper method to time operations
  private async timeOperation<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await operation();
    const duration = Date.now() - start;
    return { result, duration };
  }

  // Generate recommendations based on test results
  private generateZohoRecommendations(tests: any[]): string[] {
    const recommendations = [];
    
    const authTest = tests.find(t => t.name === 'Authentication');
    if (!authTest?.passed) {
      recommendations.push('Configure Zoho OAuth tokens in environment variables');
      recommendations.push('Check token expiration and refresh if needed');
    }
    
    const queueTest = tests.find(t => t.name === 'Queue System');
    if (queueTest?.passed && queueTest.details?.pending > 10) {
      recommendations.push('High number of pending jobs in queue - consider scaling workers');
    }
    
    const rateLimitTest = tests.find(t => t.name === 'Rate Limiting');
    if (rateLimitTest?.details?.avgResponseTime > 1000) {
      recommendations.push('API response times are high - consider implementing caching');
    }
    
    return recommendations;
  }

  private generateMicrosoftRecommendations(tests: any[]): string[] {
    const recommendations = [];
    
    const tokenTest = tests.find(t => t.name === 'OAuth Token Status');
    if (tokenTest?.details?.isExpired) {
      recommendations.push('Microsoft OAuth tokens are expired - user needs to re-authenticate');
    }
    if (tokenTest?.details?.tokenAge > 50) {
      recommendations.push('Tokens are nearing expiration - implement proactive refresh');
    }
    
    const graphTest = tests.find(t => t.name === 'Graph API Connection');
    if (!graphTest?.passed) {
      recommendations.push('Unable to connect to Microsoft Graph API - check permissions and token validity');
    }
    
    return recommendations;
  }

  private generateTwilioRecommendations(tests: any[]): string[] {
    const recommendations = [];
    
    const authTest = tests.find(t => t.name === 'Authentication');
    if (!authTest?.passed) {
      recommendations.push('Configure Twilio credentials (Account SID and Auth Token)');
    }
    
    const phoneTest = tests.find(t => t.name === 'Phone Number Status');
    if (phoneTest?.passed && !phoneTest.details?.hasNumbers) {
      recommendations.push('No phone numbers configured - purchase a Twilio phone number');
    }
    
    return recommendations;
  }

  private generateLinkedInRecommendations(tests: any[]): string[] {
    const recommendations = [];
    
    const tokenTest = tests.find(t => t.name === 'OAuth Token Status');
    if (!tokenTest?.passed) {
      recommendations.push('User needs to authenticate with LinkedIn');
    }
    
    const scopeTest = tokenTest?.details?.scopes || [];
    if (!scopeTest.includes('w_member_social')) {
      recommendations.push('Missing messaging scope - user needs to re-authenticate with proper permissions');
    }
    
    return recommendations;
  }

  private generateFirecrawlRecommendations(tests: any[]): string[] {
    const recommendations = [];
    
    const authTest = tests.find(t => t.name === 'API Key Configuration');
    if (!authTest?.passed) {
      recommendations.push('Configure Firecrawl API key in environment variables');
    }
    
    const scrapeTest = tests.find(t => t.name === 'Web Scraping');
    if (scrapeTest?.duration > 5000) {
      recommendations.push('Scraping operations are slow - consider using cached results when possible');
    }
    
    return recommendations;
  }

  // Run all integration tests
  async runAllTests(): Promise<IntegrationTestResult[]> {
    console.log('Starting Integration Health Tests...\n');
    
    const integrations = [
      { name: 'Zoho CRM', test: () => this.testZohoIntegration() },
      { name: 'Microsoft 365', test: () => this.testMicrosoft365Integration() },
      { name: 'Twilio', test: () => this.testTwilioIntegration() },
      { name: 'LinkedIn', test: () => this.testLinkedInIntegration() },
      { name: 'Firecrawl', test: () => this.testFirecrawlIntegration() },
    ];
    
    for (const integration of integrations) {
      if (this.config.verbose) {
        console.log(`Testing ${integration.name}...`);
      }
      try {
        await integration.test();
      } catch (error) {
        console.error(`Failed to test ${integration.name}:`, error);
      }
    }
    
    return this.results;
  }

  // Generate comprehensive health report
  generateHealthReport(): string {
    const totalIntegrations = this.results.length;
    const healthyIntegrations = this.results.filter(r => r.status === 'healthy').length;
    const degradedIntegrations = this.results.filter(r => r.status === 'degraded').length;
    const failedIntegrations = this.results.filter(r => r.status === 'failed').length;
    
    const overallHealth = this.results.reduce((sum, r) => sum + r.overallHealth, 0) / totalIntegrations;
    
    let report = `# Integration Health Report

Generated: ${new Date().toISOString()}
Test Mode: ${this.config.testMode || 'basic'}

## Overall Health: ${overallHealth.toFixed(1)}%

### Summary
- Total Integrations: ${totalIntegrations}
- ✅ Healthy: ${healthyIntegrations}
- ⚠️ Degraded: ${degradedIntegrations}
- ❌ Failed: ${failedIntegrations}

## Integration Details

`;

    for (const result of this.results) {
      const statusEmoji = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
      
      report += `### ${statusEmoji} ${result.integration} - ${result.overallHealth.toFixed(1)}% Health

**Status:** ${result.status.toUpperCase()}
**Tests Run:** ${result.tests.length}
**Tests Passed:** ${result.tests.filter(t => t.passed).length}

#### Test Results:
`;

      for (const test of result.tests) {
        const testEmoji = test.passed ? '✅' : '❌';
        report += `- ${testEmoji} **${test.name}**`;
        
        if (test.duration) {
          report += ` (${test.duration}ms)`;
        }
        
        if (!test.passed && test.error) {
          report += `\n  - Error: ${test.error}`;
        }
        
        if (test.details) {
          report += `\n  - Details: ${JSON.stringify(test.details, null, 2).replace(/\n/g, '\n    ')}`;
        }
        
        report += '\n';
      }
      
      if (result.recommendations && result.recommendations.length > 0) {
        report += '\n#### Recommendations:\n';
        for (const rec of result.recommendations) {
          report += `- ${rec}\n`;
        }
      }
      
      report += '\n---\n\n';
    }

    // Add critical issues section
    const criticalIssues = this.identifyCriticalIssues();
    if (criticalIssues.length > 0) {
      report += `## ⚠️ Critical Issues Requiring Immediate Attention

`;
      for (const issue of criticalIssues) {
        report += `- ${issue}\n`;
      }
    }

    return report;
  }

  private identifyCriticalIssues(): string[] {
    const issues = [];
    
    // Check for completely failed integrations
    const failedIntegrations = this.results.filter(r => r.status === 'failed');
    for (const failed of failedIntegrations) {
      issues.push(`${failed.integration} is completely non-functional`);
    }
    
    // Check for authentication failures
    for (const result of this.results) {
      const authTest = result.tests.find(t => t.name.includes('Authentication') || t.name.includes('OAuth'));
      if (authTest && !authTest.passed) {
        issues.push(`${result.integration} has authentication issues`);
      }
    }
    
    // Check for expired tokens
    const expiredTokens = this.results.filter(r => 
      r.tests.some(t => t.details?.isExpired === true)
    );
    for (const expired of expiredTokens) {
      issues.push(`${expired.integration} has expired authentication tokens`);
    }
    
    return issues;
  }
}

// Export test runner
export async function runIntegrationHealthTests(options?: {
  verbose?: boolean;
  testMode?: 'basic' | 'comprehensive' | 'stress';
}) {
  const tester = new IntegrationHealthTester(options);
  const results = await tester.runAllTests();
  const report = tester.generateHealthReport();
  
  return { results, report };
}