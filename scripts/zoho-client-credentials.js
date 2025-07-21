#!/usr/bin/env node

/**
 * Zoho Client Credentials Token Generator
 * This script generates tokens using client credentials flow (server-to-server)
 */

const https = require('https');

// Zoho Client Details
const CLIENT_ID = process.env.ZOHO_CLIENT_ID || 'your-zoho-client-id';
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || 'your-zoho-client-secret';
const SCOPE = 'ZohoCRM.modules.ALL,ZohoCRM.users.READ,ZohoCRM.settings.fields.ALL,ZohoCRM.settings.related_lists.ALL,ZohoCRM.notifications.ALL';

// Zoho OAuth URLs - IMPORTANT: Change based on your region
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'; // Options: .com, .eu, .in, .com.au, .jp
const TOKEN_URL = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

console.log('🚀 Zoho Client Credentials Token Generator');
console.log('==========================================');
console.log('Client ID:', CLIENT_ID);
console.log('Grant Type: client_credentials');
console.log('Scope:', SCOPE);
console.log('');

// Function to get tokens
async function getTokens() {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: SCOPE
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

// Alternative: Using authorization code (if client credentials doesn't work)
function printAuthorizationCodeInstructions() {
  console.log('\n📋 Alternative: Authorization Code Flow');
  console.log('=======================================');
  console.log('If client credentials doesn\'t work, you need to:');
  console.log('');
  console.log('1. Generate an authorization code by visiting this URL in your browser:');
  console.log(`${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}&redirect_uri=http://localhost:3000/api/zoho/callback&access_type=offline&prompt=consent`);
  console.log('');
  console.log('2. After authorizing, you\'ll be redirected to a URL like:');
  console.log('   http://localhost:3000/api/zoho/callback?code=YOUR_CODE_HERE');
  console.log('');
  console.log('3. Copy the code and run:');
  console.log('   node scripts/zoho-exchange-code.js YOUR_CODE_HERE');
  console.log('');
}

// Main function
async function main() {
  try {
    console.log('🔄 Attempting to get tokens using client credentials...\n');
    
    const tokens = await getTokens();
    
    if (tokens.error) {
      console.error('❌ Error getting tokens:', tokens.error);
      if (tokens.error_description) {
        console.error('Description:', tokens.error_description);
      }
      
      console.log('\n💡 This might happen if:');
      console.log('   - Client credentials flow is not enabled for your app');
      console.log('   - The scope requires user authorization');
      console.log('   - Your app is configured for a different region');
      
      printAuthorizationCodeInstructions();
      process.exit(1);
    }
    
    console.log('🎉 SUCCESS! Here are your tokens:\n');
    console.log('================================');
    console.log('ACCESS TOKEN:', tokens.access_token);
    console.log('');
    console.log('API DOMAIN:', tokens.api_domain);
    console.log('');
    console.log('TOKEN TYPE:', tokens.token_type);
    console.log('EXPIRES IN:', tokens.expires_in, 'seconds');
    console.log('================================\n');
    
    console.log('⚠️  Note: Client credentials flow typically doesn\'t provide refresh tokens.');
    console.log('    Access tokens expire after', tokens.expires_in, 'seconds.');
    console.log('    You\'ll need to request new tokens when they expire.\n');
    
    // Save to .env format
    console.log('📝 Add these to your .env file:\n');
    console.log(`ZOHO_CLIENT_ID="${CLIENT_ID}"`);
    console.log(`ZOHO_CLIENT_SECRET="${CLIENT_SECRET}"`);
    console.log(`ZOHO_ACCESS_TOKEN="${tokens.access_token}"`);
    console.log(`ZOHO_API_DOMAIN="${tokens.api_domain}"`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    printAuthorizationCodeInstructions();
    process.exit(1);
  }
}

// Run the script
main();