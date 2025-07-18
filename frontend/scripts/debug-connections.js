#!/usr/bin/env node

/**
 * Debug script for testing Gemini Live API and authentication
 */

const https = require('https');
const WebSocket = require('ws');
require('dotenv').config({ path: '.env.local' });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const color = {
    error: colors.red,
    success: colors.green,
    warning: colors.yellow,
    info: colors.cyan,
  }[type] || colors.reset;
  
  console.log(`${color}[${new Date().toISOString()}] ${message}${colors.reset}`);
}

// Test 1: Check Environment Variables
function checkEnvironmentVariables() {
  log('=== Checking Environment Variables ===', 'info');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'NEXT_PUBLIC_MICROSOFT_CLIENT_ID',
    'NEXT_PUBLIC_MICROSOFT_TENANT_ID',
    'ENTRA_CLIENT_ID',
    'ENTRA_CLIENT_SECRET',
    'ENTRA_TENANT_ID',
    'NEXTAUTH_SECRET',
  ];

  let allPresent = true;
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      log(`✓ ${varName}: ${process.env[varName].substring(0, 10)}...`, 'success');
    } else {
      log(`✗ ${varName}: NOT SET`, 'error');
      allPresent = false;
    }
  });

  return allPresent;
}

// Test 2: Test Gemini API Connection
async function testGeminiAPI() {
  log('\\n=== Testing Gemini API Connection ===', 'info');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log('GEMINI_API_KEY not found', 'error');
    return false;
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('✓ Gemini API is accessible', 'success');
          resolve(true);
        } else {
          log(`✗ Gemini API returned status ${res.statusCode}: ${data}`, 'error');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      log(`✗ Gemini API connection error: ${error.message}`, 'error');
      resolve(false);
    });

    const body = JSON.stringify({
      contents: [{
        parts: [{
          text: 'Hello, this is a test'
        }]
      }]
    });

    req.write(body);
    req.end();
  });
}

// Test 3: Test Gemini WebSocket
async function testGeminiWebSocket() {
  log('\\n=== Testing Gemini WebSocket Connection ===', 'info');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log('GEMINI_API_KEY not found', 'error');
    return false;
  }

  return new Promise((resolve) => {
    const wsUrl = `wss://generativelanguage.googleapis.com/v1alpha/models/gemini-2.0-flash-exp:streamGenerateContent?key=${apiKey}`;
    
    log(`Connecting to: ${wsUrl.replace(apiKey, 'API_KEY_HIDDEN')}`, 'info');
    
    const ws = new WebSocket(wsUrl);
    let connected = false;

    ws.on('open', () => {
      connected = true;
      log('✓ WebSocket connected successfully', 'success');
      
      // Send a setup message
      const setupMessage = {
        setup: {
          model: 'models/gemini-2.0-flash-exp'
        }
      };
      
      ws.send(JSON.stringify(setupMessage));
      log('Sent setup message', 'info');
      
      // Close after a short delay
      setTimeout(() => {
        ws.close();
        resolve(true);
      }, 2000);
    });

    ws.on('message', (data) => {
      log(`Received message: ${data.toString().substring(0, 100)}...`, 'info');
    });

    ws.on('error', (error) => {
      log(`✗ WebSocket error: ${error.message}`, 'error');
      if (!connected) resolve(false);
    });

    ws.on('close', (code, reason) => {
      log(`WebSocket closed: ${code} - ${reason}`, 'info');
      if (!connected) resolve(false);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!connected) {
        log('✗ WebSocket connection timeout', 'error');
        ws.close();
        resolve(false);
      }
    }, 10000);
  });
}

// Test 4: Check Microsoft OAuth Configuration
function checkMicrosoftOAuth() {
  log('\\n=== Checking Microsoft OAuth Configuration ===', 'info');
  
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || process.env.ENTRA_CLIENT_ID;
  const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.ENTRA_TENANT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;

  let configValid = true;

  if (!clientId) {
    log('✗ Microsoft Client ID not found', 'error');
    configValid = false;
  } else {
    log(`✓ Client ID: ${clientId}`, 'success');
  }

  if (!tenantId) {
    log('✗ Microsoft Tenant ID not found', 'error');
    configValid = false;
  } else {
    log(`✓ Tenant ID: ${tenantId}`, 'success');
  }

  if (!clientSecret) {
    log('✗ Microsoft Client Secret not found (required for server-side auth)', 'error');
    configValid = false;
  } else {
    log('✓ Client Secret is set', 'success');
  }

  // Test OAuth endpoints
  if (clientId && tenantId) {
    const authEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    log(`Auth Endpoint: ${authEndpoint}`, 'info');
    log(`Token Endpoint: ${tokenEndpoint}`, 'info');
    
    // Build redirect URI
    const redirectUri = process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback';
    log(`Redirect URI: ${redirectUri}`, 'info');
    log('⚠️  Make sure this redirect URI is registered in your Azure App Registration', 'warning');
  }

  return configValid;
}

// Test 5: Check Supabase Configuration
async function checkSupabaseConfig() {
  log('\\n=== Checking Supabase Configuration ===', 'info');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    log('✗ Supabase configuration incomplete', 'error');
    return false;
  }

  log(`✓ Supabase URL: ${supabaseUrl}`, 'success');
  log('✓ Supabase Anon Key is set', 'success');
  log(supabaseServiceKey ? '✓ Service Role Key is set' : '⚠️  Service Role Key not set', 
      supabaseServiceKey ? 'success' : 'warning');

  // Test Supabase Edge Function endpoint
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gemini-websocket`;
  log(`Edge Function URL: ${edgeFunctionUrl}`, 'info');

  return true;
}

// Main execution
async function runDiagnostics() {
  log('\\n🔍 EVA Assistant Diagnostics Tool\\n', 'info');
  
  const results = {
    envVars: checkEnvironmentVariables(),
    microsoftOAuth: checkMicrosoftOAuth(),
    supabase: await checkSupabaseConfig(),
    geminiAPI: await testGeminiAPI(),
    geminiWebSocket: await testGeminiWebSocket(),
  };

  // Summary
  log('\\n=== Diagnostics Summary ===', 'info');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  Object.entries(results).forEach(([test, passed]) => {
    log(`${passed ? '✓' : '✗'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`, 
        passed ? 'success' : 'error');
  });

  if (!allPassed) {
    log('\\n⚠️  Some tests failed. Please check the configuration above.', 'warning');
    log('\\n📝 Next Steps:', 'info');
    
    if (!results.envVars) {
      log('1. Copy .env.example to .env.local and fill in the missing values', 'info');
    }
    
    if (!results.microsoftOAuth) {
      log('2. Register your app in Azure Portal and get the Client ID, Tenant ID, and Client Secret', 'info');
      log('   - Add http://localhost:3000/auth/microsoft/callback to redirect URIs', 'info');
    }
    
    if (!results.geminiAPI || !results.geminiWebSocket) {
      log('3. Get a Gemini API key from Google AI Studio: https://makersuite.google.com/app/apikey', 'info');
    }
    
    if (!results.supabase) {
      log('4. Set up your Supabase project and deploy the Edge Functions', 'info');
    }
  } else {
    log('\\n✅ All tests passed! Your configuration looks good.', 'success');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run diagnostics
runDiagnostics().catch(error => {
  log(`Unexpected error: ${error.message}`, 'error');
  process.exit(1);
});
