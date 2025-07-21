#!/usr/bin/env node

/**
 * OAuth Integration Testing Script
 * Tests all OAuth flows after the environment variable fixes
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`❌ Environment file not found: ${filePath}`, 'red');
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    }
  });
  
  return env;
}

function checkOAuthProvider(provider, config) {
  log(`\n🔍 Checking ${provider.toUpperCase()} OAuth Configuration`, 'cyan');
  
  const checks = config.checks || [];
  let passed = 0;
  let total = checks.length;
  
  checks.forEach(check => {
    const value = check.env[check.key];
    if (value && value !== `your_${provider}_${check.key.toLowerCase()}` && !value.includes('your_')) {
      log(`  ✅ ${check.key}: Configured`, 'green');
      passed++;
    } else {
      log(`  ❌ ${check.key}: Missing or placeholder value`, 'red');
      if (check.required) {
        log(`     Required for: ${check.description}`, 'yellow');
      }
    }
  });
  
  const percentage = Math.round((passed / total) * 100);
  const status = percentage === 100 ? '✅ READY' : percentage >= 50 ? '⚠️  PARTIAL' : '❌ NOT CONFIGURED';
  log(`  ${status} (${passed}/${total} configured)`, percentage === 100 ? 'green' : percentage >= 50 ? 'yellow' : 'red');
  
  return percentage === 100;
}

async function testOAuthEndpoints() {
  log('\n🚀 Testing OAuth Endpoints', 'blue');
  
  const endpoints = [
    { name: 'LinkedIn Auth', path: '/api/auth/linkedin' },
    { name: 'Zoom Auth', path: '/api/auth/zoom' },
    { name: 'Zoho Auth', path: '/api/auth/zoho' },
    { name: 'Microsoft Auth', path: '/api/auth/microsoft' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint.path}`, {
        method: 'GET',
        redirect: 'manual' // Don't follow redirects
      });
      
      if (response.status >= 200 && response.status < 400) {
        log(`  ✅ ${endpoint.name}: Endpoint accessible`, 'green');
      } else {
        log(`  ❌ ${endpoint.name}: HTTP ${response.status}`, 'red');
      }
    } catch (error) {
      log(`  ❌ ${endpoint.name}: ${error.message}`, 'red');
    }
  }
}

function main() {
  log('🔧 OAuth Integration Test Suite', 'blue');
  log('================================\n', 'blue');
  
  // Load environment files
  const rootEnv = loadEnvFile('.env.local');
  const frontendEnv = loadEnvFile('frontend/.env.local');
  
  if (Object.keys(rootEnv).length === 0 && Object.keys(frontendEnv).length === 0) {
    log('❌ No environment files found. Please configure .env.local files.', 'red');
    process.exit(1);
  }
  
  // Test configurations
  const providers = {
    linkedin: {
      checks: [
        { key: 'NEXT_PUBLIC_LINKEDIN_CLIENT_ID', env: frontendEnv, required: true, description: 'Client-side OAuth initiation' },
        { key: 'LINKEDIN_CLIENT_ID', env: rootEnv, required: true, description: 'Server-side token exchange' },
        { key: 'LINKEDIN_CLIENT_SECRET', env: rootEnv, required: true, description: 'Server-side authentication' },
        { key: 'LINKEDIN_REDIRECT_URI', env: rootEnv, required: false, description: 'OAuth callback URL' }
      ]
    },
    zoom: {
      checks: [
        { key: 'NEXT_PUBLIC_ZOOM_CLIENT_ID', env: frontendEnv, required: true, description: 'Client-side OAuth initiation' },
        { key: 'ZOOM_CLIENT_ID', env: rootEnv, required: true, description: 'Server-side token exchange' },
        { key: 'ZOOM_CLIENT_SECRET', env: rootEnv, required: true, description: 'Server-side authentication' },
        { key: 'ZOOM_REDIRECT_URI', env: rootEnv, required: true, description: 'OAuth callback URL' },
        { key: 'ZOOM_WEBHOOK_SECRET_TOKEN', env: rootEnv, required: false, description: 'Webhook verification' }
      ]
    },
    zoho: {
      checks: [
        { key: 'NEXT_PUBLIC_ZOHO_CLIENT_ID', env: frontendEnv, required: true, description: 'Client-side OAuth initiation' },
        { key: 'ZOHO_CLIENT_ID', env: rootEnv, required: true, description: 'Server-side token exchange' },
        { key: 'ZOHO_CLIENT_SECRET', env: rootEnv, required: true, description: 'Server-side authentication' },
        { key: 'ZOHO_WEBHOOK_TOKEN', env: rootEnv, required: false, description: 'Webhook verification' }
      ]
    },
    microsoft: {
      checks: [
        { key: 'NEXT_PUBLIC_MICROSOFT_CLIENT_ID', env: frontendEnv, required: true, description: 'Client-side OAuth initiation' },
        { key: 'MICROSOFT_CLIENT_ID', env: rootEnv, required: true, description: 'Server-side token exchange' },
        { key: 'MICROSOFT_CLIENT_SECRET', env: rootEnv, required: true, description: 'Server-side authentication' },
        { key: 'MICROSOFT_TENANT_ID', env: rootEnv, required: true, description: 'Azure AD tenant' },
        { key: 'MICROSOFT_REDIRECT_URI', env: rootEnv, required: true, description: 'OAuth callback URL' }
      ]
    }
  };
  
  // Check each provider
  let readyProviders = 0;
  Object.entries(providers).forEach(([provider, config]) => {
    if (checkOAuthProvider(provider, config)) {
      readyProviders++;
    }
  });
  
  // Security checks
  log('\n🔒 Security Validation', 'cyan');
  const securityIssues = [];
  
  // Check for exposed secrets
  ['LINKEDIN_CLIENT_SECRET', 'ZOOM_CLIENT_SECRET', 'ZOHO_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET'].forEach(secret => {
    if (frontendEnv[secret] || frontendEnv[`NEXT_PUBLIC_${secret}`]) {
      securityIssues.push(`${secret} exposed in frontend environment`);
    }
  });
  
  // Check encryption key
  const encryptionKey = rootEnv.ENCRYPTION_KEY || rootEnv.OAUTH_ENCRYPTION_KEY;
  if (!encryptionKey) {
    securityIssues.push('ENCRYPTION_KEY missing (required for token storage)');
  } else if (encryptionKey.length !== 32) {
    securityIssues.push('ENCRYPTION_KEY must be exactly 32 characters');
  }
  
  if (securityIssues.length === 0) {
    log('  ✅ No security issues found', 'green');
  } else {
    securityIssues.forEach(issue => log(`  ❌ ${issue}`, 'red'));
  }
  
  // Summary
  log('\n📊 Summary', 'blue');
  log(`Providers ready: ${readyProviders}/4`, readyProviders === 4 ? 'green' : 'yellow');
  log(`Security issues: ${securityIssues.length}`, securityIssues.length === 0 ? 'green' : 'red');
  
  if (readyProviders === 4 && securityIssues.length === 0) {
    log('\n🎉 All OAuth integrations are properly configured!', 'green');
    log('Next steps:', 'cyan');
    log('1. Start your development server: npm run dev', 'cyan');
    log('2. Test OAuth flows in the browser', 'cyan');
    log('3. Deploy Supabase edge functions: supabase functions deploy', 'cyan');
  } else {
    log('\n⚠️  Some OAuth integrations need attention.', 'yellow');
    log('Please fix the issues above before testing OAuth flows.', 'yellow');
  }
}

if (require.main === module) {
  main();
}