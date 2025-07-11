#!/usr/bin/env node

/**
 * Zoho Authorization Code Exchange
 * This script exchanges an authorization code for access and refresh tokens
 */

const https = require('https');

// Zoho Client Details
const CLIENT_ID = '1000.GEK1C9AW7F6ROW9K6WT60NJ60FWN5U';
const CLIENT_SECRET = '4e695305c1b73fc9d169808ec70e0d9f1d6a610e4e';
const REDIRECT_URI = 'http://localhost:3000/api/zoho/callback';

// Zoho OAuth URLs - IMPORTANT: Change based on your region
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'; // Options: .com, .eu, .in, .com.au, .jp
const TOKEN_URL = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

// Get code from command line
const code = process.argv[2];

if (!code) {
  console.log('❌ Error: No authorization code provided');
  console.log('');
  console.log('Usage: node zoho-exchange-code.js YOUR_AUTHORIZATION_CODE');
  console.log('');
  console.log('To get an authorization code:');
  console.log('1. Visit this URL in your browser:');
  console.log(`${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?response_type=code&client_id=${CLIENT_ID}&scope=ZohoCRM.modules.ALL,ZohoCRM.users.READ,ZohoCRM.settings.fields.ALL,ZohoCRM.settings.related_lists.ALL,ZohoCRM.notifications.ALL&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&access_type=offline&prompt=consent`);
  console.log('');
  console.log('2. After authorizing, copy the code from the redirect URL');
  console.log('3. Run this script with the code');
  process.exit(1);
}

console.log('🚀 Zoho Code Exchange');
console.log('====================');
console.log('Authorization Code:', code.substring(0, 20) + '...');
console.log('');

// Function to exchange code for tokens
async function exchangeCodeForTokens(authCode) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: authCode
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.toString().length
      }
    };

    console.log('📡 Making request to:', TOKEN_URL);
    console.log('');

    const req = https.request(TOKEN_URL, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.error('❌ Error Response:');
            console.error('Status Code:', res.statusCode);
            console.error('Response:', JSON.stringify(response, null, 2));
            reject(new Error(`HTTP ${res.statusCode}: ${response.error || 'Unknown error'}`));
            return;
          }
          
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(params.toString());
    req.end();
  });
}

// Main function
async function main() {
  try {
    console.log('🔄 Exchanging authorization code for tokens...\n');
    
    const tokens = await exchangeCodeForTokens(code);
    
    if (tokens.error) {
      console.error('❌ Error getting tokens:', tokens.error);
      if (tokens.error_description) {
        console.error('Description:', tokens.error_description);
      }
      
      console.log('\n💡 Common issues:');
      console.log('   - The code has already been used (codes are single-use)');
      console.log('   - The code has expired (usually expires in a few minutes)');
      console.log('   - The redirect_uri doesn\'t match exactly');
      console.log('   - Wrong region (check ZOHO_ACCOUNTS_URL)');
      
      process.exit(1);
    }
    
    console.log('🎉 SUCCESS! Here are your tokens:\n');
    console.log('================================');
    console.log('ACCESS TOKEN:', tokens.access_token);
    console.log('');
    console.log('REFRESH TOKEN:', tokens.refresh_token || 'Not provided');
    console.log('');
    console.log('API DOMAIN:', tokens.api_domain);
    console.log('');
    console.log('TOKEN TYPE:', tokens.token_type);
    console.log('EXPIRES IN:', tokens.expires_in, 'seconds');
    console.log('================================\n');
    
    // Save to .env format
    console.log('📝 Add these to your .env file:\n');
    console.log(`ZOHO_CLIENT_ID="${CLIENT_ID}"`);
    console.log(`ZOHO_CLIENT_SECRET="${CLIENT_SECRET}"`);
    console.log(`ZOHO_REDIRECT_URI="${REDIRECT_URI}"`);
    console.log(`ZOHO_ACCESS_TOKEN="${tokens.access_token}"`);
    if (tokens.refresh_token) {
      console.log(`ZOHO_REFRESH_TOKEN="${tokens.refresh_token}"`);
    }
    console.log(`ZOHO_API_DOMAIN="${tokens.api_domain}"`);
    console.log('');
    
    console.log('✅ Integration ready! The tokens have been generated successfully.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();