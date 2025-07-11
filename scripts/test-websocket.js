#!/usr/bin/env node

// WebSocket Edge Function Test Script
// Tests connection stability, message handling, and performance

const WebSocket = require('ws');
const readline = require('readline');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const WS_ENDPOINT = `${SUPABASE_URL.replace('http', 'ws')}/functions/v1/websocket-handler`;

// Test state
let ws = null;
let sessionId = null;
let messageCount = 0;
let errorCount = 0;
let startTime = null;
let latencyTests = [];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Logging functions
function log(message, color = colors.reset) {
  console.log(`${color}${new Date().toISOString()} - ${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
  errorCount++;
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

// Connect to WebSocket
function connect() {
  return new Promise((resolve, reject) => {
    logInfo('Connecting to WebSocket endpoint...');
    
    ws = new WebSocket(WS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    ws.on('open', () => {
      startTime = Date.now();
      logSuccess('WebSocket connection established');
      resolve();
    });
    
    ws.on('message', (data) => {
      messageCount++;
      try {
        const message = JSON.parse(data);
        handleMessage(message);
      } catch (error) {
        logError(`Failed to parse message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      logError(`WebSocket error: ${error.message}`);
      reject(error);
    });
    
    ws.on('close', (code, reason) => {
      const uptime = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : 0;
      logWarning(`WebSocket closed - Code: ${code}, Reason: ${reason}, Uptime: ${uptime}s`);
    });
    
    // Timeout connection attempt
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

// Handle incoming messages
function handleMessage(message) {
  switch (message.type) {
    case 'connection':
      sessionId = message.sessionId;
      logSuccess(`Session established: ${sessionId}`);
      break;
      
    case 'text_response':
      logInfo(`Text response: ${message.data.text}`);
      break;
      
    case 'audio_response':
      logInfo(`Audio response received (${message.data.confidence} confidence)`);
      break;
      
    case 'video_analysis':
      logInfo(`Video analysis: ${JSON.stringify(message.data.findings)}`);
      break;
      
    case 'command_result':
      logInfo(`Command ${message.command} result: ${JSON.stringify(message.result)}`);
      break;
      
    case 'error':
      logError(`Server error: ${message.message}`);
      break;
      
    case 'pong':
      const latency = Date.now() - message.timestamp;
      latencyTests.push(latency);
      logInfo(`Latency: ${latency}ms`);
      break;
      
    default:
      logWarning(`Unknown message type: ${message.type}`);
  }
}

// Send message
function sendMessage(type, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
      sessionId
    };
    
    ws.send(JSON.stringify(message));
    logInfo(`Sent ${type} message`);
  } else {
    logError('WebSocket not connected');
  }
}

// Test functions
async function testTextMessage() {
  logInfo('Testing text message...');
  sendMessage('text', { text: 'Hello, this is a test message' });
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testAudioStream() {
  logInfo('Testing audio stream...');
  // Simulate audio data
  const audioData = Buffer.alloc(1024).toString('base64');
  sendMessage('audio', audioData);
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testVideoStream() {
  logInfo('Testing video stream...');
  // Simulate video frame
  const frameData = Buffer.alloc(2048).toString('base64');
  sendMessage('video', frameData);
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testCommand() {
  logInfo('Testing command execution...');
  sendMessage('command', {
    command: 'schedule_meeting',
    params: {
      title: 'Test Meeting',
      attendees: ['test@example.com'],
      datetime: new Date(Date.now() + 86400000).toISOString(),
      duration: 60
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testLatency() {
  logInfo('Testing latency (10 pings)...');
  latencyTests = [];
  
  for (let i = 0; i < 10; i++) {
    sendMessage('command', {
      command: 'ping',
      params: { timestamp: Date.now() }
    });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (latencyTests.length > 0) {
    const avgLatency = latencyTests.reduce((a, b) => a + b, 0) / latencyTests.length;
    const minLatency = Math.min(...latencyTests);
    const maxLatency = Math.max(...latencyTests);
    
    logSuccess(`Latency - Avg: ${avgLatency.toFixed(2)}ms, Min: ${minLatency}ms, Max: ${maxLatency}ms`);
  }
}

async function testStressLoad() {
  logInfo('Starting stress test (100 messages)...');
  const startTime = Date.now();
  
  for (let i = 0; i < 100; i++) {
    sendMessage('text', { text: `Stress test message ${i}` });
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  const duration = Date.now() - startTime;
  logSuccess(`Sent 100 messages in ${duration}ms (${(100000/duration).toFixed(2)} msg/s)`);
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function testErrorHandling() {
  logInfo('Testing error handling...');
  
  // Send malformed JSON
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send('invalid json');
    logInfo('Sent malformed JSON');
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Send unknown message type
  sendMessage('unknown_type', { test: true });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Send oversized payload
  const largeData = 'x'.repeat(1000000);
  sendMessage('text', { text: largeData });
  logInfo('Sent 1MB payload');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testReconnection() {
  logInfo('Testing reconnection...');
  
  // Close connection
  ws.close();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Reconnect
  try {
    await connect();
    logSuccess('Reconnection successful');
  } catch (error) {
    logError(`Reconnection failed: ${error.message}`);
  }
}

// Interactive mode
function startInteractiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nInteractive Mode Commands:');
  console.log('  text <message>  - Send text message');
  console.log('  audio          - Send audio stream test');
  console.log('  video          - Send video stream test');
  console.log('  command <cmd>  - Execute command');
  console.log('  ping           - Test latency');
  console.log('  stress         - Run stress test');
  console.log('  reconnect      - Test reconnection');
  console.log('  stats          - Show statistics');
  console.log('  exit           - Exit');
  
  rl.on('line', async (input) => {
    const [cmd, ...args] = input.trim().split(' ');
    
    switch (cmd) {
      case 'text':
        sendMessage('text', { text: args.join(' ') || 'Test message' });
        break;
        
      case 'audio':
        await testAudioStream();
        break;
        
      case 'video':
        await testVideoStream();
        break;
        
      case 'command':
        sendMessage('command', {
          command: args[0] || 'ping',
          params: {}
        });
        break;
        
      case 'ping':
        await testLatency();
        break;
        
      case 'stress':
        await testStressLoad();
        break;
        
      case 'reconnect':
        await testReconnection();
        break;
        
      case 'stats':
        const uptime = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : 0;
        console.log('\nConnection Statistics:');
        console.log(`  Uptime: ${uptime}s`);
        console.log(`  Messages received: ${messageCount}`);
        console.log(`  Errors: ${errorCount}`);
        console.log(`  Session ID: ${sessionId || 'N/A'}`);
        console.log(`  WebSocket state: ${ws ? ws.readyState : 'N/A'}`);
        break;
        
      case 'exit':
        if (ws) ws.close();
        process.exit(0);
        break;
        
      default:
        console.log('Unknown command. Type a valid command or "exit" to quit.');
    }
  });
}

// Main test runner
async function runTests() {
  console.log(`${colors.bright}WebSocket Edge Function Test Suite${colors.reset}`);
  console.log(`Endpoint: ${WS_ENDPOINT}\n`);
  
  try {
    // Connect
    await connect();
    
    // Run automated tests
    if (process.argv.includes('--auto')) {
      await testTextMessage();
      await testAudioStream();
      await testVideoStream();
      await testCommand();
      await testLatency();
      await testStressLoad();
      await testErrorHandling();
      await testReconnection();
      
      // Summary
      console.log(`\n${colors.bright}Test Summary:${colors.reset}`);
      console.log(`  Total messages: ${messageCount}`);
      console.log(`  Errors: ${errorCount}`);
      console.log(`  Success rate: ${((messageCount - errorCount) / messageCount * 100).toFixed(2)}%`);
      
      if (ws) ws.close();
      process.exit(errorCount > 0 ? 1 : 0);
    } else {
      // Interactive mode
      startInteractiveMode();
    }
    
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logWarning('\nShutting down...');
  if (ws) ws.close();
  process.exit(0);
});

// Run tests
runTests();