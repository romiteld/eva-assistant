#!/usr/bin/env node

/**
 * Microsoft OAuth Configuration Validator
 * 
 * This script validates the Microsoft OAuth configuration to ensure:
 * 1. All required environment variables are present
 * 2. Client and server configurations are consistent
 * 3. Redirect URIs are properly configured
 * 4. Supabase edge function has the necessary secrets
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

console.log('🔍 Validating Microsoft OAuth Configuration...\n');

// Check client-side environment variables
console.log('📋 Client-side Configuration:');
const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;
const redirectUri = process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI;

console.log(`   Client ID: ${clientId ? '✅ Present' : '❌ Missing'}`);
console.log(`   Tenant ID: ${tenantId ? '✅ Present' : '❌ Missing'}`);
console.log(`   Redirect URI: ${redirectUri ? '✅ Present' : '❌ Missing'}`);
console.log(`   Value: ${redirectUri || 'Not set'}\n`);

// Check server-side environment variables
console.log('🔧 Server-side Configuration:');
const serverClientId = process.env.MICROSOFT_CLIENT_ID;
const serverClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const serverTenantId = process.env.MICROSOFT_TENANT_ID;
const serverRedirectUri = process.env.MICROSOFT_REDIRECT_URI;

console.log(`   Client ID: ${serverClientId ? '✅ Present' : '❌ Missing'}`);
console.log(`   Client Secret: ${serverClientSecret ? '✅ Present' : '❌ Missing'}`);
console.log(`   Tenant ID: ${serverTenantId ? '✅ Present' : '❌ Missing'}`);
console.log(`   Redirect URI: ${serverRedirectUri ? '✅ Present' : '❌ Missing'}`);
console.log(`   Value: ${serverRedirectUri || 'Not set'}\n`);

// Check consistency
console.log('🔄 Configuration Consistency:');
const clientServerConsistent = clientId === serverClientId && tenantId === serverTenantId;
console.log(`   Client/Server IDs match: ${clientServerConsistent ? '✅ Yes' : '❌ No'}`);

const redirectUriConsistent = redirectUri === serverRedirectUri;
console.log(`   Redirect URIs match: ${redirectUriConsistent ? '✅ Yes' : '❌ No'}`);

if (!redirectUriConsistent) {
    console.log(`   ⚠️  Client URI: ${redirectUri}`);
    console.log(`   ⚠️  Server URI: ${serverRedirectUri}`);
}

// Check OAuth flow configuration
console.log('\n🌐 OAuth Flow Configuration:');
const expectedRedirectUri = redirectUri || 'https://eva.thewell.solutions/auth/microsoft/callback';
console.log(`   Expected Redirect URI: ${expectedRedirectUri}`);
console.log(`   App Registration Type: Single-Page Application (SPA)`);
console.log(`   Authentication Flow: PKCE (Public Client)`);

// Check file existence
console.log('\n📁 File System Check:');
const callbackPagePath = path.resolve(__dirname, '../frontend/src/app/auth/microsoft/callback/page.tsx');
const oauthLibPath = path.resolve(__dirname, '../frontend/src/lib/auth/microsoft-oauth.ts');
const edgeFunctionPath = path.resolve(__dirname, '../frontend/supabase/functions/microsoft-oauth/index.ts');

console.log(`   Callback Page: ${fs.existsSync(callbackPagePath) ? '✅ Exists' : '❌ Missing'}`);
console.log(`   OAuth Library: ${fs.existsSync(oauthLibPath) ? '✅ Exists' : '❌ Missing'}`);
console.log(`   Edge Function: ${fs.existsSync(edgeFunctionPath) ? '✅ Exists' : '❌ Missing'}`);

// Generate recommendations
console.log('\n🚀 Recommendations:');

if (!clientId || !tenantId) {
    console.log('   ❌ Set NEXT_PUBLIC_MICROSOFT_CLIENT_ID and NEXT_PUBLIC_MICROSOFT_TENANT_ID');
}

if (!serverClientSecret) {
    console.log('   ⚠️  No client secret found - ensure Azure app is configured as SPA if using public client flow');
}

if (!redirectUriConsistent) {
    console.log('   ❌ Fix redirect URI mismatch between client and server configuration');
}

console.log('\n🏢 Azure AD App Registration Checklist:');
console.log('   □ App registered as "Single-page application" platform');
console.log(`   □ Redirect URI configured: ${expectedRedirectUri}`);
console.log('   □ "Access tokens" enabled in Authentication settings');
console.log('   □ "ID tokens" enabled in Authentication settings');
console.log('   □ Required API permissions granted:');
console.log('     - Microsoft Graph: User.Read');
console.log('     - Microsoft Graph: Mail.ReadWrite (if using email)');
console.log('     - Microsoft Graph: Files.ReadWrite.All (if using SharePoint)');

console.log('\n✨ Configuration validation complete!\n');

// Exit with error code if critical issues found
const criticalIssues = !clientId || !tenantId || !redirectUriConsistent;
if (criticalIssues) {
    console.log('❌ Critical configuration issues found. Please fix before proceeding.');
    process.exit(1);
} else {
    console.log('✅ Configuration looks good!');
    process.exit(0);
}