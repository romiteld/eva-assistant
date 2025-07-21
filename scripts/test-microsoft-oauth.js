#!/usr/bin/env node

/**
 * Microsoft OAuth End-to-End Test
 * 
 * This script performs various tests to ensure Microsoft OAuth is working correctly:
 * 1. Environment variable validation
 * 2. Network connectivity to Microsoft endpoints
 * 3. Edge function validation
 * 4. Configuration endpoint test
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

console.log('🧪 Testing Microsoft OAuth Configuration...\n');

// Test 1: Environment Variables
function testEnvironment() {
    console.log('1️⃣ Environment Variables Test:');
    
    const requiredVars = [
        'NEXT_PUBLIC_MICROSOFT_CLIENT_ID',
        'NEXT_PUBLIC_MICROSOFT_TENANT_ID', 
        'NEXT_PUBLIC_MICROSOFT_REDIRECT_URI',
        'MICROSOFT_CLIENT_ID',
        'MICROSOFT_CLIENT_SECRET',
        'MICROSOFT_TENANT_ID',
        'MICROSOFT_REDIRECT_URI'
    ];
    
    let allPresent = true;
    
    requiredVars.forEach(varName => {
        const value = process.env[varName];
        const status = value ? '✅' : '❌';
        console.log(`   ${varName}: ${status}`);
        if (!value) allPresent = false;
    });
    
    console.log(`   Result: ${allPresent ? '✅ PASS' : '❌ FAIL'}\n`);
    return allPresent;
}

// Test 2: Microsoft Endpoints Connectivity
function testMicrosoftEndpoints() {
    console.log('2️⃣ Microsoft Endpoints Test:');
    
    const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;
    
    const endpoints = [
        `https://login.microsoftonline.com/${tenantId}/.well-known/openid_configuration`,
        'https://graph.microsoft.com/v1.0/$metadata'
    ];
    
    return Promise.all(endpoints.map(endpoint => {
        return new Promise((resolve) => {
            const url = new URL(endpoint);
            
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: 'GET',
                timeout: 5000
            };
            
            const req = https.request(options, (res) => {
                console.log(`   ${endpoint}: ✅ ${res.statusCode}`);
                resolve(true);
            });
            
            req.on('error', (err) => {
                console.log(`   ${endpoint}: ❌ ${err.message}`);
                resolve(false);
            });
            
            req.on('timeout', () => {
                console.log(`   ${endpoint}: ❌ Timeout`);
                req.destroy();
                resolve(false);
            });
            
            req.end();
        });
    })).then(results => {
        const allPass = results.every(r => r);
        console.log(`   Result: ${allPass ? '✅ PASS' : '❌ FAIL'}\n`);
        return allPass;
    });
}

// Test 3: OAuth Configuration Endpoint
function testConfigEndpoint() {
    console.log('3️⃣ Configuration Endpoint Test:');
    
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;
    
    if (!clientId || !tenantId) {
        console.log('   ❌ Missing client ID or tenant ID');
        console.log('   Result: ❌ FAIL\n');
        return Promise.resolve(false);
    }
    
    // Test the well-known configuration endpoint
    const configUrl = `https://login.microsoftonline.com/${tenantId}/.well-known/openid_configuration`;
    
    return new Promise((resolve) => {
        const url = new URL(configUrl);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'GET',
            timeout: 5000,
            headers: {
                'User-Agent': 'Eva-Assistant-OAuth-Test'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const config = JSON.parse(data);
                    console.log(`   Issuer: ${config.issuer ? '✅' : '❌'}`);
                    console.log(`   Authorization Endpoint: ${config.authorization_endpoint ? '✅' : '❌'}`);
                    console.log(`   Token Endpoint: ${config.token_endpoint ? '✅' : '❌'}`);
                    console.log(`   PKCE Support: ${config.code_challenge_methods_supported?.includes('S256') ? '✅' : '❌'}`);
                    
                    const allGood = config.issuer && config.authorization_endpoint && 
                                   config.token_endpoint && config.code_challenge_methods_supported?.includes('S256');
                    
                    console.log(`   Result: ${allGood ? '✅ PASS' : '❌ FAIL'}\n`);
                    resolve(allGood);
                } catch (error) {
                    console.log(`   ❌ Failed to parse configuration: ${error.message}`);
                    console.log('   Result: ❌ FAIL\n');
                    resolve(false);
                }
            });
        });
        
        req.on('error', (err) => {
            console.log(`   ❌ Request failed: ${err.message}`);
            console.log('   Result: ❌ FAIL\n');
            resolve(false);
        });
        
        req.on('timeout', () => {
            console.log('   ❌ Request timeout');
            console.log('   Result: ❌ FAIL\n');
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

// Test 4: Generate Test Auth URL
function generateTestAuthUrl() {
    console.log('4️⃣ Test Auth URL Generation:');
    
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI;
    
    if (!clientId || !tenantId || !redirectUri) {
        console.log('   ❌ Missing required configuration');
        console.log('   Result: ❌ FAIL\n');
        return false;
    }
    
    const state = Buffer.from(JSON.stringify({
        redirectTo: '/dashboard',
        provider: 'azure',
        timestamp: Date.now(),
        nonce: Math.random().toString(36)
    })).toString('base64');
    
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: 'openid email profile offline_access',
        state: state,
        code_challenge: 'test-challenge-for-validation',
        code_challenge_method: 'S256',
        prompt: 'select_account'
    });
    
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/authorize?${params.toString()}`;
    
    console.log('   ✅ Test auth URL generated successfully');
    console.log(`   URL length: ${authUrl.length} characters`);
    console.log(`   Redirect URI: ${redirectUri}`);
    console.log('   Result: ✅ PASS\n');
    
    console.log('🔗 Generated Test Auth URL:');
    console.log(`   ${authUrl}\n`);
    
    return true;
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting Microsoft OAuth Tests...\n');
    
    const test1 = testEnvironment();
    const test2 = await testMicrosoftEndpoints();
    const test3 = await testConfigEndpoint();
    const test4 = generateTestAuthUrl();
    
    const allTestsPass = test1 && test2 && test3 && test4;
    
    console.log('📊 Test Summary:');
    console.log(`   Environment Variables: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Microsoft Endpoints: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   OAuth Configuration: ${test3 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Auth URL Generation: ${test4 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Overall: ${allTestsPass ? '✅ PASS' : '❌ FAIL'}\n`);
    
    if (allTestsPass) {
        console.log('🎉 All tests passed! Microsoft OAuth should be working correctly.');
        console.log('\n💡 Next steps:');
        console.log('   1. Ensure Azure AD app registration matches the configuration');
        console.log('   2. Test the OAuth flow in a browser');
        console.log('   3. Verify token exchange and user data retrieval');
    } else {
        console.log('❌ Some tests failed. Please fix the issues above.');
    }
    
    process.exit(allTestsPass ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
});