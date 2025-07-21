#!/usr/bin/env node
/**
 * Zoom Configuration Test Script
 * Tests the Zoom integration setup and provides detailed feedback
 */

require('dotenv').config({ path: './.env.local' });

const crypto = require('crypto');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(color + message + colors.reset);
}

function header(text) {
  const line = '='.repeat(60);
  console.log(colors.cyan + line);
  console.log(colors.cyan + colors.bold + text);
  console.log(colors.cyan + line + colors.reset);
}

function section(text) {
  console.log(colors.blue + colors.bold + '\n' + text + colors.reset);
}

function success(text) {
  log(colors.green, '✅ ' + text);
}

function error(text) {
  log(colors.red, '❌ ' + text);
}

function warning(text) {
  log(colors.yellow, '⚠️  ' + text);
}

function info(text) {
  log(colors.cyan, '📋 ' + text);
}

function validateZoomConfiguration() {
  header('🔍 ZOOM INTEGRATION CONFIGURATION TEST');

  // Environment variables check
  const envVars = {
    ZOOM_API_KEY: process.env.ZOOM_API_KEY,
    ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID,
    ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
    ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
    ZOOM_WEBHOOK_SECRET_TOKEN: process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
    ZOOM_WEBHOOK_URL: process.env.ZOOM_WEBHOOK_URL,
    NEXT_PUBLIC_ZOOM_CLIENT_ID: process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID,
    NEXT_PUBLIC_ZOOM_ACCOUNT_ID: process.env.NEXT_PUBLIC_ZOOM_ACCOUNT_ID,
  };

  section('📊 Environment Variables Status');
  
  let hasServerToServerConfig = false;
  let hasOAuthConfig = false;

  Object.entries(envVars).forEach(([key, value]) => {
    if (value && value !== 'your_zoom_client_id' && value !== 'your_zoom_account_id' && 
        value !== 'your_zoom_client_secret' && value !== 'your_zoom_webhook_secret') {
      success(`${key}: Set (${value.substring(0, 8)}...)`);
    } else {
      warning(`${key}: Not set or using placeholder`);
    }
  });

  // Determine configuration mode
  if (envVars.ZOOM_API_KEY && envVars.ZOOM_ACCOUNT_ID && envVars.ZOOM_CLIENT_ID && envVars.ZOOM_CLIENT_SECRET) {
    hasServerToServerConfig = true;
  }
  
  if (envVars.ZOOM_CLIENT_ID && envVars.ZOOM_CLIENT_SECRET) {
    hasOAuthConfig = true;
  }

  section('🔧 Configuration Analysis');

  if (hasServerToServerConfig) {
    success('Server-to-Server OAuth configuration detected (RECOMMENDED)');
    info('This mode allows app-level authentication without user authorization');
    
    if (envVars.ZOOM_WEBHOOK_SECRET_TOKEN) {
      success('Webhook secret configured for secure webhook handling');
    } else {
      warning('Consider adding ZOOM_WEBHOOK_SECRET_TOKEN for webhook signature verification');
    }
    
    // Test API key format
    if (envVars.ZOOM_API_KEY && envVars.ZOOM_API_KEY.length === 64) {
      success('API key appears to have correct format (64 characters)');
    } else if (envVars.ZOOM_API_KEY) {
      warning(`API key length is ${envVars.ZOOM_API_KEY.length}, expected 64 characters`);
    }
    
  } else if (hasOAuthConfig) {
    success('Traditional OAuth configuration detected');
    warning('Consider upgrading to Server-to-Server OAuth for better app integration');
    
    if (!envVars.ZOOM_WEBHOOK_SECRET_TOKEN) {
      error('ZOOM_WEBHOOK_SECRET_TOKEN is REQUIRED for traditional OAuth');
    }
  } else {
    error('No valid Zoom configuration found');
  }

  section('🌐 Webhook Configuration');
  
  const webhookUrl = envVars.ZOOM_WEBHOOK_URL || 'https://eva.thewell.solutions/api/webhooks/zoom';
  info(`Webhook URL: ${webhookUrl}`);
  
  if (webhookUrl.includes('localhost')) {
    warning('Localhost webhook URL detected - this will not work in production');
    info('Use ngrok or similar for local development testing');
  } else if (webhookUrl.startsWith('https://')) {
    success('HTTPS webhook URL configured');
  } else {
    error('Webhook URL must use HTTPS');
  }

  section('🧪 Configuration Recommendations');

  if (hasServerToServerConfig) {
    success('Your configuration looks good for Server-to-Server OAuth!');
    
    console.log('\n' + colors.cyan + 'Next steps:');
    console.log(colors.cyan + '1. Create a Server-to-Server OAuth app in Zoom Marketplace');
    console.log(colors.cyan + '2. Add these scopes: meeting:read, meeting:write, user:read, recording:read');
    console.log(colors.cyan + '3. Configure webhook events: meeting.started, meeting.ended, recording.completed');
    console.log(colors.cyan + '4. Set webhook URL: ' + webhookUrl);
    if (envVars.ZOOM_WEBHOOK_SECRET_TOKEN) {
      console.log(colors.cyan + '5. Use this webhook secret: ' + envVars.ZOOM_WEBHOOK_SECRET_TOKEN);
    }
  } else if (hasOAuthConfig) {
    success('Your configuration is set for traditional OAuth');
    
    console.log('\n' + colors.cyan + 'Next steps:');
    console.log(colors.cyan + '1. Create an OAuth app in Zoom Marketplace');
    console.log(colors.cyan + '2. Add redirect URI: https://eva.thewell.solutions/api/auth/zoom/callback');
    console.log(colors.cyan + '3. Add these scopes: meeting:read, meeting:write, user:read, recording:read');
    console.log(colors.cyan + '4. Configure webhook events if needed');
    console.log(colors.cyan + '5. Set ZOOM_WEBHOOK_SECRET_TOKEN for webhook security');
  } else {
    error('Configuration incomplete');
    
    console.log('\n' + colors.yellow + 'For Server-to-Server OAuth (recommended):');
    console.log(colors.yellow + 'Add to your .env.local:');
    console.log(colors.yellow + 'ZOOM_API_KEY="your_64_character_api_key"');
    console.log(colors.yellow + 'ZOOM_ACCOUNT_ID="your_account_id"');
    console.log(colors.yellow + 'ZOOM_CLIENT_ID="your_client_id"');
    console.log(colors.yellow + 'ZOOM_CLIENT_SECRET="your_client_secret"');
    console.log(colors.yellow + 'ZOOM_WEBHOOK_SECRET_TOKEN="your_webhook_secret"');
  }

  section('🔐 Security Check');
  
  if (envVars.ZOOM_CLIENT_SECRET && envVars.ZOOM_CLIENT_SECRET !== 'your_zoom_client_secret') {
    success('Client secret is set (keep this secure!)');
  } else {
    warning('Client secret not configured');
  }
  
  if (envVars.ZOOM_API_KEY && envVars.ZOOM_API_KEY !== 'your_zoom_api_key') {
    success('API key is set (keep this secure!)');
  }

  section('🚀 Testing Commands');
  
  console.log('\n' + colors.green + 'Test your configuration:');
  console.log(colors.green + '1. Start your development server: npm run dev');
  console.log(colors.green + '2. Test webhook endpoint: curl -X POST http://localhost:3000/api/webhooks/zoom');
  console.log(colors.green + '3. Check authentication status in your app');

  console.log('\n' + colors.cyan + '='.repeat(60) + colors.reset);
}

// Test webhook signature generation
function testWebhookSignature() {
  section('🔒 Webhook Signature Test');
  
  const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  const apiKey = process.env.ZOOM_API_KEY;
  
  if (webhookSecret) {
    const testPayload = JSON.stringify({ event: 'test', payload: { message: 'hello' } });
    const timestamp = Date.now().toString();
    const message = `v0:${timestamp}:${testPayload}`;
    const signature = crypto.createHmac('sha256', webhookSecret).update(message).digest('hex');
    
    success('Webhook signature generation test passed');
    info(`Test signature: v0=${signature}`);
  } else if (apiKey) {
    const testToken = 'test_plain_token';
    const hash = crypto.createHmac('sha256', apiKey).update(testToken).digest('hex');
    
    success('API key validation hash generation test passed');
    info(`Test hash: ${hash}`);
  } else {
    warning('No webhook secret or API key to test signature generation');
  }
}

// Main execution
if (require.main === module) {
  validateZoomConfiguration();
  testWebhookSignature();
}