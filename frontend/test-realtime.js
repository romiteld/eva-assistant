#!/usr/bin/env node
/**
 * Real-time Features Test Runner
 * Execute with: node test-realtime.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Check if server is running
const checkServer = () => {
  return new Promise((resolve) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

const runTests = async () => {
  console.log('🔍 EVA Real-time Features Test Suite\n');

  // Check if server is running
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('❌ Server is not running. Please start the development server first:');
    console.error('   npm run dev\n');
    process.exit(1);
  }

  console.log('✅ Server is running\n');

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'GEMINI_API_KEY'
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease ensure your .env.local file contains all required variables.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  // Compile and run TypeScript tests
  console.log('🔄 Compiling and running tests...\n');

  const tsNode = spawn('npx', [
    'tsx',
    path.join(__dirname, 'src/tests/realtime-features-test.ts')
  ], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  tsNode.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All tests completed successfully!');
    } else {
      console.log(`\n❌ Tests failed with exit code ${code}`);
    }
    process.exit(code);
  });

  tsNode.on('error', (err) => {
    console.error('❌ Failed to run tests:', err);
    process.exit(1);
  });
};

// Quick test mode - runs basic connectivity tests only
const runQuickTests = async () => {
  console.log('🚀 Running quick connectivity tests...\n');

  const io = require('socket.io-client');
  const { WebSocket } = require('ws');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Socket.IO connection
  console.log('Testing Socket.IO connection...');
  try {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      timeout: 3000
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ Socket.IO connected');
        passed++;
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', (err) => {
        console.log('❌ Socket.IO connection failed:', err.message);
        failed++;
        reject(err);
      });
      setTimeout(() => reject(new Error('Connection timeout')), 3000);
    }).catch(() => {});
  } catch (error) {
    // Error already logged
  }

  // Test 2: WebSocket direct connection
  console.log('\nTesting WebSocket direct connection...');
  try {
    const ws = new WebSocket('ws://localhost:3000/socket.io/?EIO=4&transport=websocket');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ WebSocket connected');
        passed++;
        ws.close();
        resolve();
      });
      ws.on('error', (err) => {
        console.log('❌ WebSocket connection failed:', err.message);
        failed++;
        reject(err);
      });
      setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 3000);
    }).catch(() => {});
  } catch (error) {
    // Error already logged
  }

  // Test 3: HTTP endpoint
  console.log('\nTesting HTTP endpoint...');
  try {
    const http = require('http');
    await new Promise((resolve, reject) => {
      http.get('http://localhost:3000/api/health', (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          console.log('✅ HTTP server responding');
          passed++;
          resolve();
        } else {
          console.log('❌ HTTP server returned:', res.statusCode);
          failed++;
          reject();
        }
      }).on('error', (err) => {
        console.log('❌ HTTP request failed:', err.message);
        failed++;
        reject(err);
      });
    }).catch(() => {});
  } catch (error) {
    // Error already logged
  }

  console.log(`\n📊 Quick Test Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log('✅ Basic connectivity tests passed! Run full test suite with: node test-realtime.js --full');
  } else {
    console.log('❌ Some connectivity tests failed. Please check your server configuration.');
  }

  process.exit(failed > 0 ? 1 : 0);
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    await runQuickTests();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('EVA Real-time Features Test Suite\n');
    console.log('Usage: node test-realtime.js [options]\n');
    console.log('Options:');
    console.log('  --quick, -q    Run quick connectivity tests only');
    console.log('  --full         Run full test suite (default)');
    console.log('  --help, -h     Show this help message\n');
    process.exit(0);
  } else {
    await runTests();
  }
};

main().catch(console.error);