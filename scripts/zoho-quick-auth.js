#!/usr/bin/env node

const CLIENT_ID = '1000.GEK1C9AW7F6ROW9K6WT60NJ60FWN5U';
const CLIENT_SECRET = '4e695305c1b73fc9d169808ec70e0d9f1d6a610e4e';
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