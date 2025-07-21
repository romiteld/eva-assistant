#!/usr/bin/env node

const CLIENT_ID = process.env.ZOHO_CLIENT_ID || 'your-zoho-client-id';
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || 'your-zoho-client-secret';
const REDIRECT_URI = 'http://localhost:3000/api/zoho/callback';
const SCOPE = 'ZohoCRM.modules.ALL,ZohoCRM.users.READ,ZohoCRM.settings.fields.ALL,ZohoCRM.settings.related_lists.ALL,ZohoCRM.notifications.ALL';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const AUTH_URL = `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth`;

// Build the authorization URL
const authParams = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  scope: SCOPE,
  redirect_uri: REDIRECT_URI,
  access_type: 'offline',
  prompt: 'consent'
});

const authUrl = `${AUTH_URL}?${authParams.toString()}`;

console.log('🚀 ZOHO OAUTH - QUICK START');
console.log('============================\n');
console.log('1️⃣  COPY AND PASTE THIS URL IN YOUR BROWSER:\n');
console.log(authUrl);
console.log('\n2️⃣  After authorizing, you\'ll be redirected to:');
console.log('   http://localhost:3000/api/zoho/callback?code=YOUR_CODE_HERE');
console.log('\n3️⃣  COPY THE CODE from the URL and run:');
console.log('   node scripts/zoho-exchange-code.js YOUR_CODE_HERE\n');
console.log('⏱️  HURRY! The code expires in a few minutes!\n');