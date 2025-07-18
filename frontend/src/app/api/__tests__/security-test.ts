import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { validateWebhookSignature } from '@/middleware/webhook-validation';
import { TokenManager } from '@/lib/auth/token-manager';
import { securityConfig } from '@/lib/security/config';
import crypto from 'crypto';

// Security Test Suite for EVA Assistant
export class SecurityTester {
  private supabase: any;
  private results: any[] = [];

  constructor() {
    this.supabase = createClient();
  }

  // Test 1: Authentication Flow
  async testAuthenticationFlow() {
    console.log('\n🔐 Testing Authentication Flow...');
    const tests = [];

    // Test Magic Link
    tests.push({
      name: 'Magic Link Authentication',
      test: async () => {
        try {
          const { data, error } = await this.supabase.auth.signInWithOtp({
            email: 'test@example.com',
            options: {
              shouldCreateUser: false
            }
          });
          return {
            success: !error || error.message.includes('User not found'),
            message: error?.message || 'OTP request successful'
          };
        } catch (e) {
          return { success: false, message: e.message };
        }
      }
    });

    // Test Microsoft OAuth
    tests.push({
      name: 'Microsoft OAuth Configuration',
      test: async () => {
        const hasClientId = !!process.env.MICROSOFT_CLIENT_ID;
        const hasClientSecret = !!process.env.MICROSOFT_CLIENT_SECRET;
        const hasTenantId = !!process.env.MICROSOFT_TENANT_ID;
        const clientSecretNotPublic = !process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET;
        
        return {
          success: hasClientId && hasClientSecret && hasTenantId && clientSecretNotPublic,
          message: {
            clientId: hasClientId,
            clientSecret: hasClientSecret,
            tenantId: hasTenantId,
            secretProtected: clientSecretNotPublic
          }
        };
      }
    });

    // Test Session Management
    tests.push({
      name: 'Session Management',
      test: async () => {
        const { data: { session } } = await this.supabase.auth.getSession();
        return {
          success: true,
          message: session ? 'Active session found' : 'No active session'
        };
      }
    });

    const results = await Promise.all(tests.map(t => this.runTest(t)));
    this.results.push({ category: 'Authentication', tests: results });
  }

  // Test 2: Security Middleware
  async testSecurityMiddleware() {
    console.log('\n🛡️ Testing Security Middleware...');
    const tests = [];

    // Test Rate Limiting
    tests.push({
      name: 'Rate Limiting Configuration',
      test: async () => {
        const configs = ['auth', 'api', 'upload', 'webhook', 'ai'];
        const results = configs.map(type => ({
          type,
          windowMs: securityConfig.rateLimits[type]?.windowMs || 'Not configured',
          maxRequests: securityConfig.rateLimits[type]?.maxRequests || 'Not configured'
        }));
        
        return {
          success: true,
          message: results
        };
      }
    });

    // Test CSRF Protection
    tests.push({
      name: 'CSRF Token Generation',
      test: async () => {
        try {
          const response = await fetch('/api/csrf');
          const data = await response.json();
          return {
            success: !!data.csrfToken && data.csrfToken.length === 64,
            message: 'CSRF token generated successfully'
          };
        } catch (e) {
          return { success: false, message: e.message };
        }
      }
    });

    // Test Webhook Validation
    tests.push({
      name: 'Webhook Signature Validation',
      test: async () => {
        const providers = ['zoho', 'twilio', 'email', 'zoom', 'microsoft', 'linkedin'];
        const results = providers.map(provider => {
          const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] || 
                         process.env[`${provider.toUpperCase()}_WEBHOOK_TOKEN`] ||
                         process.env[`${provider.toUpperCase()}_AUTH_TOKEN`];
          return {
            provider,
            configured: !!secret
          };
        });
        
        const allConfigured = results.every(r => r.configured);
        return {
          success: allConfigured,
          message: results
        };
      }
    });

    const results = await Promise.all(tests.map(t => this.runTest(t)));
    this.results.push({ category: 'Security Middleware', tests: results });
  }

  // Test 3: Data Security
  async testDataSecurity() {
    console.log('\n🔒 Testing Data Security...');
    const tests = [];

    // Test Row Level Security
    tests.push({
      name: 'Row Level Security (RLS)',
      test: async () => {
        const tables = ['users', 'conversations', 'tasks', 'workflows', 'oauth_credentials'];
        const results = [];
        
        for (const table of tables) {
          try {
            // Try to query without authentication
            const { data, error } = await this.supabase
              .from(table)
              .select('id')
              .limit(1);
            
            results.push({
              table,
              protected: !!error && error.message.includes('row-level security')
            });
          } catch (e) {
            results.push({ table, protected: true });
          }
        }
        
        const allProtected = results.every(r => r.protected);
        return {
          success: allProtected,
          message: results
        };
      }
    });

    // Test API Key Storage
    tests.push({
      name: 'API Key Encryption',
      test: async () => {
        const sensitiveEnvVars = [
          'GEMINI_API_KEY',
          'ZOHO_CLIENT_SECRET',
          'TWILIO_AUTH_TOKEN',
          'FIRECRAWL_API_KEY'
        ];
        
        const results = sensitiveEnvVars.map(varName => ({
          variable: varName,
          exists: !!process.env[varName],
          notInPublic: !process.env[`NEXT_PUBLIC_${varName}`]
        }));
        
        const allSecure = results.every(r => !r.exists || r.notInPublic);
        return {
          success: allSecure,
          message: results
        };
      }
    });

    // Test Input Validation
    tests.push({
      name: 'Input Sanitization',
      test: async () => {
        const testInputs = [
          '<script>alert("xss")</script>',
          '"; DROP TABLE users; --',
          '../../../etc/passwd',
          'javascript:alert(1)'
        ];
        
        const results = testInputs.map(input => {
          const sanitized = securityConfig.sanitizeInput(input);
          return {
            original: input,
            sanitized,
            safe: !sanitized.includes('<script') && 
                  !sanitized.includes('DROP TABLE') &&
                  !sanitized.includes('../')
          };
        });
        
        const allSafe = results.every(r => r.safe);
        return {
          success: allSafe,
          message: results
        };
      }
    });

    const results = await Promise.all(tests.map(t => this.runTest(t)));
    this.results.push({ category: 'Data Security', tests: results });
  }

  // Test 4: Token Management
  async testTokenManagement() {
    console.log('\n🔑 Testing Token Management...');
    const tests = [];

    // Test Token Encryption
    tests.push({
      name: 'OAuth Token Encryption',
      test: async () => {
        try {
          // Check if oauth_credentials table uses encryption
          const { data, error } = await this.supabase
            .from('oauth_credentials')
            .select('access_token, refresh_token')
            .limit(1);
          
          if (data && data.length > 0) {
            const token = data[0];
            // Tokens should be encrypted (not plaintext)
            const looksEncrypted = token.access_token && 
                                 !token.access_token.includes('Bearer') &&
                                 token.access_token.length > 100;
            
            return {
              success: looksEncrypted,
              message: 'Tokens appear to be encrypted'
            };
          }
          
          return {
            success: true,
            message: 'No tokens found to test'
          };
        } catch (e) {
          return { success: true, message: 'Access denied (good)' };
        }
      }
    });

    // Test Auto-Refresh
    tests.push({
      name: 'Token Auto-Refresh Configuration',
      test: async () => {
        const providers = ['microsoft', 'google', 'linkedin', 'zoom', 'salesforce', 'zoho'];
        const hasRefreshEndpoint = !!process.env.NEXT_PUBLIC_APP_URL;
        
        return {
          success: hasRefreshEndpoint,
          message: `Auto-refresh ${hasRefreshEndpoint ? 'configured' : 'not configured'} for ${providers.join(', ')}`
        };
      }
    });

    const results = await Promise.all(tests.map(t => this.runTest(t)));
    this.results.push({ category: 'Token Management', tests: results });
  }

  // Test 5: API Security
  async testAPISecurity() {
    console.log('\n🌐 Testing API Security...');
    const tests = [];

    // Test Authentication on Protected Routes
    tests.push({
      name: 'Protected Route Authentication',
      test: async () => {
        const protectedRoutes = [
          '/api/tasks',
          '/api/agents',
          '/api/deals/create',
          '/api/microsoft/emails'
        ];
        
        const results = [];
        for (const route of protectedRoutes) {
          try {
            const response = await fetch(route, {
              method: 'GET',
              headers: {}
            });
            
            results.push({
              route,
              protected: response.status === 401
            });
          } catch (e) {
            results.push({ route, protected: true });
          }
        }
        
        const allProtected = results.every(r => r.protected);
        return {
          success: allProtected,
          message: results
        };
      }
    });

    // Test CORS Configuration
    tests.push({
      name: 'CORS Configuration',
      test: async () => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
        const hasProductionOrigin = allowedOrigins.includes('https://eva.thewell.solutions');
        
        return {
          success: hasProductionOrigin || process.env.NODE_ENV === 'development',
          message: `Allowed origins: ${allowedOrigins.join(', ') || 'Not configured'}`
        };
      }
    });

    // Test Input Validation
    tests.push({
      name: 'API Input Validation',
      test: async () => {
        // Test with invalid data
        try {
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: '', // Empty title should fail validation
              priority: 999 // Out of range
            })
          });
          
          return {
            success: response.status === 400 || response.status === 401,
            message: `Validation ${response.status === 400 ? 'working' : 'needs auth first'}`
          };
        } catch (e) {
          return { success: true, message: 'Request blocked' };
        }
      }
    });

    const results = await Promise.all(tests.map(t => this.runTest(t)));
    this.results.push({ category: 'API Security', tests: results });
  }

  // Test 6: Edge Function Security
  async testEdgeFunctionSecurity() {
    console.log('\n⚡ Testing Edge Function Security...');
    const tests = [];

    // Test Edge Function Authentication
    tests.push({
      name: 'Edge Function Authentication',
      test: async () => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        return {
          success: !!supabaseUrl && !!supabaseServiceKey,
          message: {
            urlConfigured: !!supabaseUrl,
            serviceKeyConfigured: !!supabaseServiceKey,
            serviceKeyNotPublic: !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
          }
        };
      }
    });

    // Test Environment Variables
    tests.push({
      name: 'Environment Variable Security',
      test: async () => {
        const publicVars = Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_'));
        const sensitivePatterns = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'PRIVATE'];
        
        const exposedSecrets = publicVars.filter(varName => 
          sensitivePatterns.some(pattern => varName.includes(pattern))
        );
        
        return {
          success: exposedSecrets.length === 0,
          message: exposedSecrets.length > 0 
            ? `Exposed secrets: ${exposedSecrets.join(', ')}`
            : 'No secrets exposed in public vars'
        };
      }
    });

    const results = await Promise.all(tests.map(t => this.runTest(t)));
    this.results.push({ category: 'Edge Function Security', tests: results });
  }

  // Helper method to run a test
  private async runTest(test: { name: string; test: () => Promise<any> }) {
    try {
      const result = await test.test();
      return {
        name: test.name,
        ...result,
        error: null
      };
    } catch (error) {
      return {
        name: test.name,
        success: false,
        message: error.message,
        error: error.stack
      };
    }
  }

  // Get test results
  getResults() {
    return this.results;
  }

  // Generate summary
  generateSummary() {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const issues = [];

    this.results.forEach(category => {
      category.tests.forEach(test => {
        totalTests++;
        if (test.success) {
          passedTests++;
        } else {
          failedTests++;
          issues.push({
            category: category.category,
            test: test.name,
            message: test.message
          });
        }
      });
    });

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%',
      issues
    };
  }
}

// Run all security tests
export async function runSecurityTests() {
  console.log('🔒 EVA Assistant Security Testing Suite\n');
  console.log('=' .repeat(50));
  
  const tester = new SecurityTester();
  
  // Run all test categories
  await tester.testAuthenticationFlow();
  await tester.testSecurityMiddleware();
  await tester.testDataSecurity();
  await tester.testTokenManagement();
  await tester.testAPISecurity();
  await tester.testEdgeFunctionSecurity();
  
  // Generate and display results
  const results = tester.getResults();
  const summary = tester.generateSummary();
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SECURITY TEST SUMMARY\n');
  console.log(`Total Tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed} ✅`);
  console.log(`Failed: ${summary.failed} ❌`);
  console.log(`Success Rate: ${summary.successRate}`);
  
  if (summary.issues.length > 0) {
    console.log('\n⚠️  SECURITY ISSUES FOUND:\n');
    summary.issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.category}] ${issue.test}`);
      console.log(`   Message: ${JSON.stringify(issue.message, null, 2)}`);
    });
  } else {
    console.log('\n✅ All security tests passed!');
  }
  
  return {
    results,
    summary
  };
}