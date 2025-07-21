#!/usr/bin/env node

/**
 * Quick OAuth Readiness Test
 * Tests which OAuth integrations are ready to use
 */

const fs = require('fs');

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

function isConfigured(value) {
  return value && !value.startsWith('your_') && !value.includes('placeholder');
}

function main() {
  log('🔧 Eva Assistant - OAuth Readiness Check', 'blue');
  log('========================================\n', 'blue');
  
  // Load environment files
  const rootEnv = loadEnvFile('.env.local');
  const frontendEnv = loadEnvFile('frontend/.env.local');
  
  const integrations = [
    {
      name: 'LinkedIn OAuth',
      ready: isConfigured(frontendEnv.NEXT_PUBLIC_LINKEDIN_CLIENT_ID) && 
             isConfigured(rootEnv.LINKEDIN_CLIENT_ID) && 
             isConfigured(rootEnv.LINKEDIN_CLIENT_SECRET),
      testUrl: 'http://localhost:3000/dashboard/integrations',
      notes: 'Traditional OAuth - requires user authorization'
    },
    {
      name: 'Microsoft OAuth',
      ready: isConfigured(frontendEnv.NEXT_PUBLIC_MICROSOFT_CLIENT_ID) && 
             isConfigured(rootEnv.MICROSOFT_CLIENT_ID) && 
             isConfigured(rootEnv.MICROSOFT_CLIENT_SECRET) &&
             isConfigured(rootEnv.MICROSOFT_TENANT_ID),
      testUrl: 'http://localhost:3000/auth/microsoft',
      notes: 'Entra ID OAuth - enterprise ready'
    },
    {
      name: 'Zoho CRM OAuth',
      ready: isConfigured(frontendEnv.NEXT_PUBLIC_ZOHO_CLIENT_ID) && 
             isConfigured(rootEnv.ZOHO_CLIENT_ID) && 
             isConfigured(rootEnv.ZOHO_CLIENT_SECRET),
      testUrl: 'http://localhost:3000/dashboard/integrations',
      notes: 'CRM integration - webhook token optional'
    },
    {
      name: 'Zoom Integration',
      ready: isConfigured(rootEnv.ZOOM_API_KEY),
      testUrl: 'Server-to-Server mode',
      notes: 'Server-to-Server OAuth with API key (no user auth needed)',
      mode: 'api_key'
    }
  ];

  log('📋 Integration Readiness Status:', 'cyan');
  
  let readyCount = 0;
  integrations.forEach(integration => {
    const status = integration.ready ? '✅ READY' : '❌ NOT READY';
    const color = integration.ready ? 'green' : 'red';
    
    log(`\n${integration.name}:`, 'cyan');
    log(`  Status: ${status}`, color);
    log(`  Test: ${integration.testUrl}`, 'blue');
    log(`  Notes: ${integration.notes}`, 'yellow');
    
    if (integration.ready) readyCount++;
  });

  // Security status
  log('\n🔒 Security Status:', 'cyan');
  const securityIssues = [];
  
  // Check for exposed secrets in frontend
  ['LINKEDIN_CLIENT_SECRET', 'ZOOM_CLIENT_SECRET', 'ZOHO_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET'].forEach(secret => {
    if (frontendEnv[secret] || frontendEnv[`NEXT_PUBLIC_${secret}`]) {
      securityIssues.push(`${secret} exposed in frontend`);
    }
  });
  
  if (securityIssues.length === 0) {
    log('✅ All secrets properly secured (server-side only)', 'green');
  } else {
    securityIssues.forEach(issue => log(`❌ ${issue}`, 'red'));
  }

  // Summary
  log('\n📊 Summary:', 'blue');
  log(`Ready Integrations: ${readyCount}/4`, readyCount >= 3 ? 'green' : readyCount >= 2 ? 'yellow' : 'red');
  log(`Security Issues: ${securityIssues.length}`, securityIssues.length === 0 ? 'green' : 'red');
  
  if (readyCount >= 2 && securityIssues.length === 0) {
    log('\n🎉 OAuth integrations are ready for testing!', 'green');
    log('\nNext Steps:', 'cyan');
    log('1. Start your dev server: npm run dev', 'white');
    log('2. Navigate to: http://localhost:3000/dashboard/integrations', 'white');
    log('3. Click "Connect" on any ready integration', 'white');
    log('4. Complete the OAuth flow in your browser', 'white');
    
    log('\nReady to test:', 'green');
    integrations.filter(i => i.ready).forEach(i => {
      log(`• ${i.name}`, 'green');
    });
  } else {
    log('\n⚠️  Some integrations need configuration.', 'yellow');
    if (readyCount < 2) {
      log('Configure at least 2 integrations before testing.', 'yellow');
    }
  }

  // Environment file status
  log('\n📁 Configuration Files:', 'cyan');
  log(`✅ Root .env.local: ${Object.keys(rootEnv).length} variables`, 'green');
  log(`✅ Frontend .env.local: ${Object.keys(frontendEnv).length} variables`, 'green');
}

if (require.main === module) {
  main();
}