#!/usr/bin/env node

/**
 * Zoho OAuth Token Generator
 * This script helps generate access and refresh tokens for Zoho CRM integration
 */

const https = require('https');
const http = require('http');
const url = require('url');
const open = require('open');

// Zoho Client Details
const CLIENT_ID = '1000.GEK1C9AW7F6ROW9K6WT60NJ60FWN5U';
const CLIENT_SECRET = '4e695305c1b73fc9d169808ec70e0d9f1d6a610e4e';
const REDIRECT_URI = 'http://localhost:3000/api/zoho/callback';
const SCOPE = 'ZohoCRM.modules.ALL,ZohoCRM.users.READ,ZohoCRM.settings.fields.ALL,ZohoCRM.settings.related_lists.ALL,ZohoCRM.notifications.ALL';

// Zoho OAuth URLs (change based on your region)
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'; // Use .eu, .in, .com.au for other regions
const AUTH_URL = `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth`;
const TOKEN_URL = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

console.log('🚀 Zoho OAuth Token Generator');
console.log('================================');
console.log('Client ID:', CLIENT_ID);
console.log('Redirect URI:', REDIRECT_URI);
console.log('Scope:', SCOPE);
console.log('');

// Function to exchange authorization code for tokens
async function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: code
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.toString().length
      }
    };

    const req = https.request(TOKEN_URL, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const tokens = JSON.parse(data);
          resolve(tokens);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

// Create a local server to handle the callback
function createCallbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      
      if (parsedUrl.pathname === '/api/zoho/callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #e74c3c;">❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>Please close this window and try again.</p>
              </body>
            </html>
          `);
          server.close();
          console.error('❌ Authorization failed:', error);
          process.exit(1);
        }
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #27ae60;">✅ Authorization Successful!</h1>
                <p>You can close this window now.</p>
                <p>Check your terminal for the tokens.</p>
              </body>
            </html>
          `);
          
          server.close();
          
          console.log('\n✅ Authorization code received!');
          console.log('📝 Exchanging code for tokens...\n');
          
          try {
            const tokens = await exchangeCodeForTokens(code);
            
            if (tokens.error) {
              console.error('❌ Error getting tokens:', tokens.error);
              console.error('Description:', tokens.error_description);
              process.exit(1);
            }
            
            console.log('🎉 SUCCESS! Here are your tokens:\n');
            console.log('================================');
            console.log('ACCESS TOKEN:', tokens.access_token);
            console.log('');
            console.log('REFRESH TOKEN:', tokens.refresh_token || 'Not provided (some grant types don\'t return refresh tokens)');
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
            
            resolve(tokens);
          } catch (error) {
            console.error('❌ Error exchanging code for tokens:', error.message);
            process.exit(1);
          }
        }
      }
    });
    
    server.listen(3000, () => {
      console.log('🌐 Callback server listening on http://localhost:3000');
      resolve(server);
    });
  });
}

// Main function
async function main() {
  console.log('📌 Starting OAuth flow...\n');
  
  // Start the callback server
  await createCallbackServer();
  
  // Build the authorization URL
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    access_type: 'offline', // This ensures we get a refresh token
    prompt: 'consent' // Force consent screen to ensure refresh token
  });
  
  const authUrl = `${AUTH_URL}?${authParams.toString()}`;
  
  console.log('🌐 Opening browser for authorization...');
  console.log('If the browser doesn\'t open automatically, visit this URL:');
  console.log(authUrl);
  console.log('');
  
  // Open the browser
  try {
    await open(authUrl);
  } catch (error) {
    console.log('⚠️  Could not open browser automatically. Please visit the URL above.');
  }
  
  console.log('⏳ Waiting for authorization callback...\n');
}

// Run the script
main().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  process.exit(0);
});