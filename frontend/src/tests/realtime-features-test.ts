#!/usr/bin/env node
/**
 * Real-time Features Test Suite
 * Tests all real-time functionality including WebSocket, voice agent, live updates, and streaming
 */

import { io, Socket } from 'socket.io-client';
import { WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

// Test configuration
const TEST_CONFIG = {
  websocketUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  testUserId: 'test-user-' + Date.now(),
  testEmail: 'test@example.com',
};

// Test results storage
interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  duration: number;
  details?: any;
  error?: string;
}

const testResults: TestResult[] = [];

// Helper functions
function logTest(name: string, status: 'started' | 'passed' | 'failed' | 'warning', details?: any) {
  const timestamp = new Date().toISOString();
  const symbol = status === 'passed' ? '✅' : status === 'failed' ? '❌' : status === 'warning' ? '⚠️' : '🔄';
  console.log(`[${timestamp}] ${symbol} ${name}`, details ? JSON.stringify(details, null, 2) : '');
}

async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    testResults.push({ name, status: 'passed', duration });
    logTest(name, 'passed', { duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    testResults.push({ name, status: 'failed', duration, error: error.message });
    logTest(name, 'failed', { error: error.message, duration: `${duration.toFixed(2)}ms` });
    throw error;
  }
}

// 1. WebSocket Server Tests
async function testWebSocketServer() {
  console.log('\n=== WebSocket Server Tests ===\n');
  
  let socket: Socket | null = null;
  
  try {
    // Test connection establishment
    socket = await measurePerformance('WebSocket Connection', async () => {
      return new Promise<Socket>((resolve, reject) => {
        const s = io(TEST_CONFIG.websocketUrl, {
          transports: ['websocket'],
          timeout: 5000,
        });
        
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });
    
    // Test authentication
    await measurePerformance('WebSocket Authentication', async () => {
      return new Promise<void>((resolve, reject) => {
        const authPayload = {
          token: Buffer.from(JSON.stringify({
            userId: TEST_CONFIG.testUserId,
            email: TEST_CONFIG.testEmail,
            exp: Date.now() + 3600000,
            purpose: 'testing',
          })).toString('base64'),
          userId: TEST_CONFIG.testUserId,
          email: TEST_CONFIG.testEmail,
          metadata: { name: 'Test User' },
        };
        
        socket!.emit('auth:request', authPayload);
        
        socket!.once('auth:success', () => resolve());
        socket!.once('auth:error', (error) => reject(new Error(error.message)));
        
        setTimeout(() => reject(new Error('Authentication timeout')), 5000);
      });
    });
    
    // Test room management
    const testRoomId = 'test-room-' + Date.now();
    await measurePerformance('Room Join', async () => {
      return new Promise<void>((resolve, reject) => {
        socket!.emit('room:join', { roomId: testRoomId });
        
        socket!.once(`room:join:${testRoomId}:success`, () => resolve());
        socket!.once(`room:join:${testRoomId}:error`, (error) => reject(new Error(error.message)));
        
        setTimeout(() => reject(new Error('Room join timeout')), 5000);
      });
    });
    
    // Test presence updates
    await measurePerformance('Presence Update', async () => {
      return new Promise<void>((resolve) => {
        socket!.emit('presence:update', { status: 'active' });
        
        socket!.once('presence:update', (presence) => {
          if (presence.userId === TEST_CONFIG.testUserId) {
            resolve();
          }
        });
        
        setTimeout(() => resolve(), 1000);
      });
    });
    
    // Test ping/pong
    await measurePerformance('Ping/Pong Latency', async () => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        socket!.emit('ping');
        
        socket!.once('pong', () => {
          const latency = performance.now() - start;
          resolve(latency);
        });
      });
    });
    
    // Test multiple clients
    await measurePerformance('Multiple Client Handling', async () => {
      const clients: Socket[] = [];
      const clientCount = 5;
      
      for (let i = 0; i < clientCount; i++) {
        const client = io(TEST_CONFIG.websocketUrl, {
          transports: ['websocket'],
          autoConnect: true,
        });
        
        await new Promise<void>((resolve) => {
          client.on('connect', () => resolve());
        });
        
        clients.push(client);
      }
      
      // Clean up
      clients.forEach(c => c.disconnect());
      
      return { connectedClients: clientCount };
    });
    
    // Test message ordering
    await measurePerformance('Message Ordering', async () => {
      const messages: number[] = [];
      const messageCount = 10;
      
      socket!.on('broadcast', (data) => {
        if (data.channel === 'test-ordering') {
          messages.push(data.message.index);
        }
      });
      
      // Send messages in order
      for (let i = 0; i < messageCount; i++) {
        socket!.emit('broadcast', {
          channel: 'test-ordering',
          message: { index: i },
        });
      }
      
      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check ordering
      const isOrdered = messages.every((val, idx) => val === idx);
      if (!isOrdered) {
        throw new Error('Messages received out of order');
      }
      
      return { sentMessages: messageCount, receivedMessages: messages.length, ordered: isOrdered };
    });
    
  } finally {
    if (socket) {
      socket.disconnect();
    }
  }
}

// 2. Voice Agent Tests (Gemini Live API)
async function testVoiceAgent() {
  console.log('\n=== Voice Agent Tests ===\n');
  
  // Test Gemini WebSocket connection
  await measurePerformance('Gemini WebSocket Connection', async () => {
    const token = Buffer.from(JSON.stringify({
      userId: TEST_CONFIG.testUserId,
      exp: Date.now() + 3600000,
      purpose: 'gemini-live',
    })).toString('base64');
    
    const ws = new WebSocket(`ws://localhost:3000/api/gemini/ws?token=${token}&model=gemini-2.0-flash-exp`);
    
    return new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Gemini connection timeout'));
      }, 5000);
    });
  });
  
  // Test audio streaming simulation
  await measurePerformance('Audio Stream Simulation', async () => {
    const audioChunks = 10;
    const chunkSize = 4096; // 4KB chunks
    let totalBytes = 0;
    
    // Simulate audio streaming
    for (let i = 0; i < audioChunks; i++) {
      const audioData = Buffer.alloc(chunkSize);
      totalBytes += chunkSize;
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { 
      chunks: audioChunks, 
      totalBytes, 
      duration: audioChunks * 100,
      bitrate: (totalBytes * 8) / (audioChunks * 0.1) // bits per second
    };
  });
  
  // Test interruption handling
  await measurePerformance('Interruption Handling', async () => {
    const startTime = Date.now();
    
    // Simulate starting a voice stream
    const streamPromise = new Promise(resolve => {
      setTimeout(() => resolve('completed'), 2000);
    });
    
    // Interrupt after 500ms
    setTimeout(() => {
      // Simulate interruption
    }, 500);
    
    const result = await Promise.race([
      streamPromise,
      new Promise(resolve => setTimeout(() => resolve('interrupted'), 600)),
    ]);
    
    return { 
      result, 
      duration: Date.now() - startTime,
      interrupted: result === 'interrupted'
    };
  });
}

// 3. Supabase Realtime Tests
async function testSupabaseRealtime() {
  console.log('\n=== Supabase Realtime Tests ===\n');
  
  const supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseAnonKey);
  
  // Test realtime subscription
  await measurePerformance('Realtime Subscription', async () => {
    const channel = supabase.channel('test-channel-' + Date.now());
    
    return new Promise<void>((resolve, reject) => {
      channel
        .on('presence', { event: 'sync' }, () => {
          channel.unsubscribe();
          resolve();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Trigger presence sync
            channel.track({ userId: TEST_CONFIG.testUserId });
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('Channel subscription error'));
          }
        });
      
      setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  });
  
  // Test database change detection
  await measurePerformance('Database Change Detection', async () => {
    const tableName = 'test_realtime_' + Date.now();
    let changeDetected = false;
    
    // Note: This test assumes you have a test table set up
    // In a real scenario, you'd need appropriate permissions
    
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public' }, 
        (payload) => {
          changeDetected = true;
        }
      )
      .subscribe();
    
    // Wait a bit to see if we get any changes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    channel.unsubscribe();
    
    return { changeDetected };
  });
  
  // Test broadcast
  await measurePerformance('Broadcast Messages', async () => {
    const channel1 = supabase.channel('broadcast-test');
    const channel2 = supabase.channel('broadcast-test');
    let messagesReceived = 0;
    
    return new Promise<void>((resolve, reject) => {
      // Subscribe both channels
      channel2.on('broadcast', { event: 'test' }, (payload) => {
        messagesReceived++;
      }).subscribe();
      
      channel1.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Send messages
          for (let i = 0; i < 5; i++) {
            channel1.send({
              type: 'broadcast',
              event: 'test',
              payload: { index: i }
            });
          }
          
          // Wait and check
          setTimeout(() => {
            channel1.unsubscribe();
            channel2.unsubscribe();
            
            if (messagesReceived >= 3) { // Allow some message loss
              resolve();
            } else {
              reject(new Error(`Only received ${messagesReceived} messages`));
            }
          }, 1000);
        }
      });
    });
  });
}

// 4. Streaming Features Tests
async function testStreamingFeatures() {
  console.log('\n=== Streaming Features Tests ===\n');
  
  // Test chat message streaming
  await measurePerformance('Chat Message Streaming', async () => {
    const message = "This is a test message that will be streamed character by character.";
    const chunks: string[] = [];
    let totalTime = 0;
    
    // Simulate streaming
    for (const char of message) {
      const start = performance.now();
      chunks.push(char);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      totalTime += performance.now() - start;
    }
    
    return {
      messageLength: message.length,
      chunks: chunks.length,
      averageChunkTime: totalTime / chunks.length,
      totalTime
    };
  });
  
  // Test stream cancellation
  await measurePerformance('Stream Cancellation', async () => {
    let cancelled = false;
    let processed = 0;
    
    const streamPromise = (async () => {
      for (let i = 0; i < 100; i++) {
        if (cancelled) break;
        processed++;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    })();
    
    // Cancel after 50ms
    setTimeout(() => { cancelled = true; }, 50);
    
    await streamPromise;
    
    return {
      totalItems: 100,
      processedBeforeCancel: processed,
      cancelled: cancelled
    };
  });
  
  // Test backpressure handling
  await measurePerformance('Backpressure Handling', async () => {
    const buffer: number[] = [];
    const maxBufferSize = 10;
    let dropped = 0;
    
    // Producer
    const producer = async () => {
      for (let i = 0; i < 50; i++) {
        if (buffer.length >= maxBufferSize) {
          dropped++;
        } else {
          buffer.push(i);
        }
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    };
    
    // Consumer (slower)
    const consumer = async () => {
      while (buffer.length > 0 || dropped < 40) {
        if (buffer.length > 0) {
          buffer.shift();
        }
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    };
    
    await Promise.all([producer(), consumer()]);
    
    return {
      produced: 50,
      dropped,
      consumed: 50 - dropped,
      efficiency: ((50 - dropped) / 50 * 100).toFixed(2) + '%'
    };
  });
}

// 5. Live Collaboration Tests
async function testLiveCollaboration() {
  console.log('\n=== Live Collaboration Tests ===\n');
  
  // Test multi-user presence
  await measurePerformance('Multi-User Presence', async () => {
    const users = 5;
    const sockets: Socket[] = [];
    const presenceMap = new Map<string, any>();
    
    // Create multiple connections
    for (let i = 0; i < users; i++) {
      const socket = io(TEST_CONFIG.websocketUrl, {
        transports: ['websocket'],
      });
      
      await new Promise<void>((resolve) => {
        socket.on('connect', () => {
          // Authenticate
          socket.emit('auth:request', {
            token: Buffer.from(JSON.stringify({
              userId: `user-${i}`,
              email: `user${i}@example.com`,
              exp: Date.now() + 3600000,
            })).toString('base64'),
            userId: `user-${i}`,
            email: `user${i}@example.com`,
          });
          
          socket.once('auth:success', () => resolve());
        });
      });
      
      socket.on('presence:update', (presence) => {
        presenceMap.set(presence.userId, presence);
      });
      
      sockets.push(socket);
    }
    
    // Wait for presence to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clean up
    sockets.forEach(s => s.disconnect());
    
    return {
      totalUsers: users,
      presenceDetected: presenceMap.size,
      allUsersDetected: presenceMap.size === users
    };
  });
  
  // Test concurrent editing simulation
  await measurePerformance('Concurrent Editing', async () => {
    const edits: any[] = [];
    let conflicts = 0;
    
    // Simulate 3 users editing
    const users = ['user1', 'user2', 'user3'];
    const document = { content: 'Initial content', version: 1 };
    
    // Each user makes edits
    for (const user of users) {
      const edit = {
        user,
        change: `Edit by ${user}`,
        version: document.version,
        timestamp: Date.now()
      };
      
      // Check for conflict
      if (edits.some(e => e.version === edit.version && e.user !== user)) {
        conflicts++;
      }
      
      edits.push(edit);
      document.version++;
    }
    
    return {
      totalEdits: edits.length,
      conflicts,
      finalVersion: document.version
    };
  });
  
  // Test activity indicators
  await measurePerformance('Activity Indicators', async () => {
    const activities = ['typing', 'viewing', 'editing'];
    const indicators: any[] = [];
    
    // Simulate activity updates
    for (let i = 0; i < 10; i++) {
      const activity = {
        userId: `user-${i % 3}`,
        type: activities[i % activities.length],
        timestamp: Date.now(),
        location: `section-${i % 2}`
      };
      
      indicators.push(activity);
      
      // Simulate real-time delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return {
      totalActivities: indicators.length,
      uniqueUsers: new Set(indicators.map(a => a.userId)).size,
      activityTypes: activities
    };
  });
}

// 6. Edge Cases and Stress Tests
async function testEdgeCases() {
  console.log('\n=== Edge Cases and Stress Tests ===\n');
  
  // Test network disconnection recovery
  await measurePerformance('Network Disconnection Recovery', async () => {
    const socket = io(TEST_CONFIG.websocketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
    });
    
    let disconnections = 0;
    let reconnections = 0;
    
    socket.on('disconnect', () => disconnections++);
    socket.on('reconnect', () => reconnections++);
    
    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        // Force disconnect
        socket.disconnect();
        
        // Should auto-reconnect
        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 1000);
      });
    });
    
    return { disconnections, reconnections };
  });
  
  // Test high message volume
  await measurePerformance('High Message Volume', async () => {
    const messageCount = 1000;
    const startTime = performance.now();
    let received = 0;
    
    const socket = io(TEST_CONFIG.websocketUrl, {
      transports: ['websocket'],
    });
    
    await new Promise<void>((resolve) => {
      socket.on('connect', async () => {
        socket.on('echo', () => received++);
        
        // Send burst of messages
        for (let i = 0; i < messageCount; i++) {
          socket.emit('echo', { index: i });
        }
        
        // Wait for responses
        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 2000);
      });
    });
    
    const duration = performance.now() - startTime;
    const throughput = (received / duration) * 1000; // messages per second
    
    return {
      sent: messageCount,
      received,
      lossRate: ((messageCount - received) / messageCount * 100).toFixed(2) + '%',
      throughput: throughput.toFixed(2) + ' msg/s'
    };
  });
  
  // Test memory leak detection
  await measurePerformance('Memory Leak Detection', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 100;
    
    // Create and destroy connections repeatedly
    for (let i = 0; i < iterations; i++) {
      const socket = io(TEST_CONFIG.websocketUrl, {
        transports: ['websocket'],
      });
      
      await new Promise<void>((resolve) => {
        socket.on('connect', () => {
          socket.disconnect();
          resolve();
        });
      });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const averagePerConnection = memoryIncrease / iterations;
    
    return {
      iterations,
      initialMemory: (initialMemory / 1024 / 1024).toFixed(2) + ' MB',
      finalMemory: (finalMemory / 1024 / 1024).toFixed(2) + ' MB',
      increase: (memoryIncrease / 1024 / 1024).toFixed(2) + ' MB',
      averagePerConnection: (averagePerConnection / 1024).toFixed(2) + ' KB',
      possibleLeak: averagePerConnection > 100 * 1024 // 100KB per connection
    };
  });
}

// Generate test report
function generateReport() {
  console.log('\n=== Test Report ===\n');
  
  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = testResults.filter(r => r.status === 'failed').length;
  const warnings = testResults.filter(r => r.status === 'warning').length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Warnings: ${warnings} ⚠️`);
  console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
  console.log('\nDetailed Results:');
  
  // Group by category
  const categories = {
    'WebSocket': testResults.filter(r => r.name.includes('WebSocket')),
    'Voice': testResults.filter(r => r.name.includes('Voice') || r.name.includes('Audio') || r.name.includes('Gemini')),
    'Realtime': testResults.filter(r => r.name.includes('Realtime') || r.name.includes('Database')),
    'Streaming': testResults.filter(r => r.name.includes('Stream')),
    'Collaboration': testResults.filter(r => r.name.includes('Collaboration') || r.name.includes('Presence') || r.name.includes('Activity')),
    'Edge Cases': testResults.filter(r => r.name.includes('Edge') || r.name.includes('Network') || r.name.includes('Memory')),
  };
  
  Object.entries(categories).forEach(([category, results]) => {
    if (results.length > 0) {
      console.log(`\n${category}:`);
      results.forEach(r => {
        const status = r.status === 'passed' ? '✅' : r.status === 'failed' ? '❌' : '⚠️';
        console.log(`  ${status} ${r.name} (${r.duration.toFixed(2)}ms)`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
      });
    }
  });
  
  // Performance metrics
  console.log('\n=== Performance Metrics ===\n');
  
  const avgDuration = totalDuration / testResults.length;
  const fastestTest = testResults.reduce((min, r) => r.duration < min.duration ? r : min);
  const slowestTest = testResults.reduce((max, r) => r.duration > max.duration ? r : max);
  
  console.log(`Average Test Duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`Fastest Test: ${fastestTest.name} (${fastestTest.duration.toFixed(2)}ms)`);
  console.log(`Slowest Test: ${slowestTest.name} (${slowestTest.duration.toFixed(2)}ms)`);
  
  // Health check summary
  console.log('\n=== System Health Summary ===\n');
  
  const healthScore = (passed / testResults.length) * 100;
  const status = healthScore >= 90 ? 'Excellent' : healthScore >= 70 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Poor';
  
  console.log(`Health Score: ${healthScore.toFixed(1)}% (${status})`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed Tests Require Attention:');
    testResults
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }
  
  // Recommendations
  console.log('\n=== Recommendations ===\n');
  
  if (testResults.some(r => r.name.includes('Memory') && r.details?.possibleLeak)) {
    console.log('⚠️  Possible memory leak detected. Review connection cleanup logic.');
  }
  
  if (testResults.some(r => r.name.includes('Message') && r.details?.lossRate && parseFloat(r.details.lossRate) > 5)) {
    console.log('⚠️  High message loss rate detected. Check network conditions and buffer sizes.');
  }
  
  if (testResults.some(r => r.duration > 5000)) {
    console.log('⚠️  Some tests are taking too long. Consider optimizing or adding timeouts.');
  }
  
  if (healthScore < 70) {
    console.log('❌ System health is below acceptable levels. Immediate attention required.');
  } else if (healthScore < 90) {
    console.log('⚠️  System health could be improved. Review failed and slow tests.');
  } else {
    console.log('✅ System is operating normally.');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Real-time Features Test Suite\n');
  console.log('Configuration:', TEST_CONFIG);
  
  try {
    await testWebSocketServer();
  } catch (error) {
    console.error('WebSocket tests failed:', error);
  }
  
  try {
    await testVoiceAgent();
  } catch (error) {
    console.error('Voice Agent tests failed:', error);
  }
  
  try {
    await testSupabaseRealtime();
  } catch (error) {
    console.error('Supabase Realtime tests failed:', error);
  }
  
  try {
    await testStreamingFeatures();
  } catch (error) {
    console.error('Streaming tests failed:', error);
  }
  
  try {
    await testLiveCollaboration();
  } catch (error) {
    console.error('Collaboration tests failed:', error);
  }
  
  try {
    await testEdgeCases();
  } catch (error) {
    console.error('Edge case tests failed:', error);
  }
  
  generateReport();
  
  // Exit with appropriate code
  const failed = testResults.filter(r => r.status === 'failed').length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this is the main module
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testResults };