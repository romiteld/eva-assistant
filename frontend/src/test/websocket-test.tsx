// WebSocket and Real-time Features Test Suite
// Tests connection stability, voice streaming, message broadcasting, and error recovery

import React, { useState, useEffect, useRef } from 'react';
import { supabase, realtimeHelpers } from '@/lib/supabase/browser';
import { GeminiLiveClient } from '@/lib/gemini/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Database,
  Zap,
  RefreshCw
} from 'lucide-react';

interface TestResult {
  id: string;
  test: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  message: string;
  timestamp: Date;
  duration?: number;
  details?: any;
}

interface ConnectionMetrics {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  reconnectAttempts: number;
  errors: number;
  uptime: number;
}

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export default function WebSocketTestSuite() {
  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');
  
  // Connection states
  const [wsConnection, setWsConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [supabaseConnection, setSupabaseConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [geminiConnection, setGeminiConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  // Feature states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Metrics
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics>({
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
    reconnectAttempts: 0,
    errors: 0,
    uptime: 0
  });
  
  const [memoryMetrics, setMemoryMetrics] = useState<MemoryMetrics | null>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const geminiClientRef = useRef<GeminiLiveClient | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add test result
  const addTestResult = (test: string, status: TestResult['status'], message: string, details?: any) => {
    const result: TestResult = {
      id: Date.now().toString(),
      test,
      status,
      message,
      timestamp: new Date(),
      details
    };
    
    setTestResults(prev => [...prev, result]);
    
    // Update previous test duration if exists
    setTestResults(prev => {
      const lastIndex = prev.length - 2;
      if (lastIndex >= 0 && prev[lastIndex].status === 'running') {
        const updated = [...prev];
        updated[lastIndex] = {
          ...updated[lastIndex],
          duration: Date.now() - updated[lastIndex].timestamp.getTime()
        };
        return updated;
      }
      return prev;
    });
  };
  
  // Test 1: WebSocket Connection Establishment
  const testWebSocketConnection = async () => {
    setCurrentTest('WebSocket Connection');
    addTestResult('WebSocket Connection', 'running', 'Establishing WebSocket connection...');
    
    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https', 'wss')}/functions/v1/websocket-handler`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout after 10 seconds'));
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          setWsConnection('connected');
          addTestResult('WebSocket Connection', 'passed', 'Successfully connected to WebSocket');
          
          // Send test message
          ws.send(JSON.stringify({
            type: 'text',
            data: { text: 'Connection test' },
            timestamp: new Date().toISOString()
          }));
          
          resolve();
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          setWsConnection('error');
          addTestResult('WebSocket Connection', 'failed', 'WebSocket connection error', error);
          reject(error);
        };
        
        ws.onclose = () => {
          setWsConnection('disconnected');
        };
        
        ws.onmessage = (event) => {
          setConnectionMetrics(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            bytesTransferred: prev.bytesTransferred + event.data.length
          }));
        };
      });
    } catch (error) {
      addTestResult('WebSocket Connection', 'failed', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };
  
  // Test 2: Supabase Realtime Connection
  const testSupabaseRealtime = async () => {
    setCurrentTest('Supabase Realtime');
    addTestResult('Supabase Realtime', 'running', 'Connecting to Supabase Realtime...');
    
    try {
      setSupabaseConnection('connecting');
      
      // Subscribe to test channel
      const channel = supabase.channel('test-channel')
        .on('presence', { event: 'sync' }, () => {
          addTestResult('Supabase Realtime', 'passed', 'Presence sync successful');
        })
        .on('broadcast', { event: 'test' }, (payload: any) => {
          addTestResult('Supabase Broadcast', 'passed', 'Received broadcast message', payload);
        })
        .subscribe((status: any) => {
          if (status === 'SUBSCRIBED') {
            setSupabaseConnection('connected');
            addTestResult('Supabase Realtime', 'passed', 'Successfully subscribed to channel');
            
            // Test broadcast
            channel.send({
              type: 'broadcast',
              event: 'test',
              payload: { message: 'Test broadcast' }
            });
          } else if (status === 'CHANNEL_ERROR') {
            setSupabaseConnection('error');
            addTestResult('Supabase Realtime', 'failed', 'Channel subscription error');
          }
        });
      
      supabaseChannelRef.current = channel;
      
      // Test database subscription
      const dbChannel = realtimeHelpers.subscribeToConversations(
        'test-user-id',
        (payload: any) => {
          addTestResult('Database Subscription', 'passed', 'Received database change', payload);
        }
      );
      
      // Wait for subscription
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      addTestResult('Supabase Realtime', 'failed', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };
  
  // Test 3: Voice Streaming
  const testVoiceStreaming = async () => {
    setCurrentTest('Voice Streaming');
    addTestResult('Voice Streaming', 'running', 'Testing voice capture and streaming...');
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setIsStreaming(true);
      
      addTestResult('Voice Streaming', 'passed', 'Microphone access granted');
      
      // Create audio context for analysis
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Monitor audio levels
      let silenceCount = 0;
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        
        if (average < 10) {
          silenceCount++;
          if (silenceCount > 50) { // ~1 second of silence
            addTestResult('Voice Streaming', 'warning', 'No audio detected - check microphone');
          }
        } else {
          silenceCount = 0;
          addTestResult('Voice Activity', 'passed', `Audio level: ${average.toFixed(0)}`);
        }
      };
      
      const audioCheckInterval = setInterval(checkAudioLevel, 20);
      
      // Test WebRTC data channel for audio streaming
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Simulate audio data sending
        const audioData = new ArrayBuffer(1024);
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: btoa(String.fromCharCode(...new Uint8Array(audioData))),
          timestamp: new Date().toISOString()
        }));
        
        setConnectionMetrics(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1,
          bytesTransferred: prev.bytesTransferred + 1024
        }));
        
        addTestResult('Audio Streaming', 'passed', 'Successfully sent audio data');
      }
      
      // Clean up after 3 seconds
      setTimeout(() => {
        clearInterval(audioCheckInterval);
        audioContext.close();
      }, 3000);
      
    } catch (error) {
      addTestResult('Voice Streaming', 'failed', `Microphone access denied: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsStreaming(false);
    }
  };
  
  // Test 4: Screen Sharing
  const testScreenSharing = async () => {
    setCurrentTest('Screen Sharing');
    addTestResult('Screen Sharing', 'running', 'Testing screen capture...');
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: false 
      });
      
      setIsScreenSharing(true);
      addTestResult('Screen Sharing', 'passed', 'Screen capture started');
      
      // Capture frame and test sending
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              addTestResult('Frame Capture', 'passed', `Captured frame: ${blob.size} bytes`);
              
              // Test sending frame
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                blob.arrayBuffer().then(buffer => {
                  wsRef.current!.send(JSON.stringify({
                    type: 'screen',
                    data: btoa(String.fromCharCode(...new Uint8Array(buffer))),
                    timestamp: new Date().toISOString()
                  }));
                  
                  addTestResult('Frame Transmission', 'passed', 'Successfully sent screen frame');
                });
              }
            }
          }, 'image/jpeg', 0.8);
        }
        
        // Stop after capturing one frame
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          setIsScreenSharing(false);
        }, 1000);
      };
      
    } catch (error) {
      addTestResult('Screen Sharing', 'failed', `Screen capture denied: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsScreenSharing(false);
    }
  };
  
  // Test 5: Message Broadcasting
  const testMessageBroadcasting = async () => {
    setCurrentTest('Message Broadcasting');
    addTestResult('Message Broadcasting', 'running', 'Testing message broadcast system...');
    
    try {
      if (!supabaseChannelRef.current) {
        throw new Error('Supabase channel not initialized');
      }
      
      const testMessages = [
        { type: 'status', content: 'User online' },
        { type: 'typing', content: 'User is typing...' },
        { type: 'activity', content: 'Document uploaded' }
      ];
      
      for (const msg of testMessages) {
        await supabaseChannelRef.current.send({
          type: 'broadcast',
          event: msg.type,
          payload: {
            ...msg,
            timestamp: new Date().toISOString(),
            userId: 'test-user'
          }
        });
        
        addTestResult('Broadcast Send', 'passed', `Sent ${msg.type} message`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      addTestResult('Message Broadcasting', 'passed', 'All broadcast messages sent successfully');
      
    } catch (error) {
      addTestResult('Message Broadcasting', 'failed', `Broadcast error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Test 6: Connection Recovery
  const testConnectionRecovery = async () => {
    setCurrentTest('Connection Recovery');
    addTestResult('Connection Recovery', 'running', 'Testing connection recovery mechanisms...');
    
    try {
      // Simulate connection loss
      if (wsRef.current) {
        wsRef.current.close();
        addTestResult('Connection Loss', 'warning', 'Simulated connection loss');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Attempt reconnection
        setConnectionMetrics(prev => ({
          ...prev,
          reconnectAttempts: prev.reconnectAttempts + 1
        }));
        
        await testWebSocketConnection();
        addTestResult('Connection Recovery', 'passed', 'Successfully recovered connection');
      }
      
      // Test Supabase reconnection
      if (supabaseChannelRef.current) {
        await supabaseChannelRef.current.unsubscribe();
        addTestResult('Channel Unsubscribe', 'warning', 'Unsubscribed from channel');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Resubscribe
        await testSupabaseRealtime();
        addTestResult('Channel Recovery', 'passed', 'Successfully resubscribed to channel');
      }
      
    } catch (error) {
      addTestResult('Connection Recovery', 'failed', `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Test 7: Error Handling
  const testErrorHandling = async () => {
    setCurrentTest('Error Handling');
    addTestResult('Error Handling', 'running', 'Testing error handling mechanisms...');
    
    try {
      // Test malformed message
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('invalid json');
        addTestResult('Malformed Message', 'passed', 'Sent malformed message');
        
        // Test unknown message type
        wsRef.current.send(JSON.stringify({
          type: 'unknown_type',
          data: {},
          timestamp: new Date().toISOString()
        }));
        addTestResult('Unknown Message Type', 'passed', 'Sent unknown message type');
        
        // Test large payload
        const largeData = new Array(1000000).fill('x').join('');
        wsRef.current.send(JSON.stringify({
          type: 'text',
          data: { text: largeData },
          timestamp: new Date().toISOString()
        }));
        addTestResult('Large Payload', 'passed', 'Sent large payload (1MB)');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if connection is still alive
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        addTestResult('Error Handling', 'passed', 'Connection survived error tests');
      } else {
        addTestResult('Error Handling', 'warning', 'Connection closed during error tests');
      }
      
    } catch (error) {
      addTestResult('Error Handling', 'failed', `Error handling test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Test 8: Memory Leak Detection
  const testMemoryLeaks = async () => {
    setCurrentTest('Memory Leak Detection');
    addTestResult('Memory Leak Detection', 'running', 'Monitoring memory usage...');
    
    try {
      // Get initial memory usage
      if ('memory' in performance) {
        const initialMemory = (performance as any).memory;
        setMemoryMetrics({
          heapUsed: initialMemory.usedJSHeapSize,
          heapTotal: initialMemory.totalJSHeapSize,
          external: 0,
          arrayBuffers: 0
        });
        
        addTestResult('Initial Memory', 'passed', 
          `Heap: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Perform memory-intensive operations
        const messages = [];
        for (let i = 0; i < 1000; i++) {
          messages.push({
            type: 'text',
            data: { text: `Test message ${i}` },
            timestamp: new Date().toISOString()
          });
        }
        
        // Send messages
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          for (const msg of messages) {
            wsRef.current.send(JSON.stringify(msg));
          }
        }
        
        // Wait and check memory
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const finalMemory = (performance as any).memory;
        const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
        const increaseInMB = memoryIncrease / 1024 / 1024;
        
        setMemoryMetrics({
          heapUsed: finalMemory.usedJSHeapSize,
          heapTotal: finalMemory.totalJSHeapSize,
          external: 0,
          arrayBuffers: 0
        });
        
        if (increaseInMB < 10) {
          addTestResult('Memory Leak Detection', 'passed', 
            `Memory increase: ${increaseInMB.toFixed(2)} MB (acceptable)`);
        } else {
          addTestResult('Memory Leak Detection', 'warning', 
            `Memory increase: ${increaseInMB.toFixed(2)} MB (potential leak)`);
        }
      } else {
        addTestResult('Memory Leak Detection', 'warning', 'Performance.memory API not available');
      }
      
    } catch (error) {
      addTestResult('Memory Leak Detection', 'failed', `Memory test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Test 9: Latency Measurement
  const testLatency = async () => {
    setCurrentTest('Latency Measurement');
    addTestResult('Latency Measurement', 'running', 'Measuring round-trip latency...');
    
    try {
      const latencies: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        // Send ping message
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const pingId = `ping-${Date.now()}`;
          
          await new Promise<void>((resolve) => {
            const messageHandler = (event: MessageEvent) => {
              const data = JSON.parse(event.data);
              if (data.pingId === pingId) {
                const latency = Date.now() - startTime;
                latencies.push(latency);
                wsRef.current!.removeEventListener('message', messageHandler);
                resolve();
              }
            };
            
            wsRef.current!.addEventListener('message', messageHandler);
            
            wsRef.current!.send(JSON.stringify({
              type: 'command',
              data: { command: 'ping', params: { pingId } },
              timestamp: new Date().toISOString()
            }));
            
            // Timeout after 5 seconds
            setTimeout(resolve, 5000);
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (latencies.length > 0) {
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);
        
        setConnectionMetrics(prev => ({
          ...prev,
          latency: avgLatency
        }));
        
        addTestResult('Latency Measurement', 'passed', 
          `Avg: ${avgLatency.toFixed(0)}ms, Min: ${minLatency}ms, Max: ${maxLatency}ms`);
      } else {
        addTestResult('Latency Measurement', 'warning', 'No latency measurements collected');
      }
      
    } catch (error) {
      addTestResult('Latency Measurement', 'failed', `Latency test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    startTimeRef.current = new Date();
    
    // Start metrics collection
    metricsIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setConnectionMetrics(prev => ({
          ...prev,
          uptime: Date.now() - startTimeRef.current!.getTime()
        }));
      }
    }, 1000);
    
    const tests = [
      testWebSocketConnection,
      testSupabaseRealtime,
      testVoiceStreaming,
      testScreenSharing,
      testMessageBroadcasting,
      testConnectionRecovery,
      testErrorHandling,
      testMemoryLeaks,
      testLatency
    ];
    
    for (const test of tests) {
      try {
        await test();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
      } catch (error) {
        console.error('Test failed:', error);
        setConnectionMetrics(prev => ({
          ...prev,
          errors: prev.errors + 1
        }));
      }
    }
    
    setCurrentTest('');
    setIsRunning(false);
    addTestResult('Test Suite Complete', 'passed', 'All tests completed');
  };
  
  // Cleanup
  useEffect(() => {
    const geminiClient = geminiClientRef.current;
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.unsubscribe();
      }
      if (geminiClient) {
        geminiClient.disconnect();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);
  
  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      connected: 'bg-green-500',
      connecting: 'bg-yellow-500',
      disconnected: 'bg-gray-500',
      error: 'bg-red-500'
    };
    
    return (
      <Badge className={`${colors[status as keyof typeof colors] || colors.disconnected} text-white`}>
        {status}
      </Badge>
    );
  };
  
  // Test result icon
  const TestResultIcon = ({ status }: { status: TestResult['status'] }) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-6 h-6" />
              WebSocket & Real-time Features Test Suite
            </span>
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              variant={isRunning ? "secondary" : "default"}
            >
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentTest && (
            <Alert className="mb-4">
              <Zap className="w-4 h-4" />
              <AlertDescription>
                Currently testing: <strong>{currentTest}</strong>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-5 h-5" />
                    <span className="font-medium">WebSocket</span>
                  </div>
                  <StatusBadge status={wsConnection} />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    <span className="font-medium">Supabase</span>
                  </div>
                  <StatusBadge status={supabaseConnection} />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium">Gemini Live</span>
                  </div>
                  <StatusBadge status={geminiConnection} />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Feature Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isStreaming ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    <span className="font-medium">Voice Streaming</span>
                  </div>
                  <Badge variant={isStreaming ? "default" : "secondary"}>
                    {isStreaming ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isScreenSharing ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
                    <span className="font-medium">Screen Sharing</span>
                  </div>
                  <Badge variant={isScreenSharing ? "default" : "secondary"}>
                    {isScreenSharing ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium">Broadcasting</span>
                  </div>
                  <Badge variant={isBroadcasting ? "default" : "secondary"}>
                    {isBroadcasting ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="results" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="results">Test Results</TabsTrigger>
              <TabsTrigger value="metrics">Connection Metrics</TabsTrigger>
              <TabsTrigger value="memory">Memory Usage</TabsTrigger>
            </TabsList>
            
            <TabsContent value="results">
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-[400px] pr-4">
                    {testResults.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No test results yet. Click &quot;Run All Tests&quot; to start.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {testResults.map((result: TestResult) => (
                          <div
                            key={result.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20"
                          >
                            <TestResultIcon status={result.status} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{result.test}</span>
                                {result.duration && (
                                  <span className="text-xs text-muted-foreground">
                                    ({result.duration}ms)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{result.message}</p>
                              {result.details && (
                                <pre className="text-xs mt-1 p-2 bg-secondary/30 rounded">
                                  {JSON.stringify(result.details, null, 2)}
                                </pre>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="metrics">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Latency</p>
                      <p className="text-2xl font-bold">{connectionMetrics.latency.toFixed(0)}ms</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Uptime</p>
                      <p className="text-2xl font-bold">
                        {Math.floor(connectionMetrics.uptime / 1000)}s
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Messages Sent</p>
                      <p className="text-2xl font-bold">{connectionMetrics.messagesSent}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Messages Received</p>
                      <p className="text-2xl font-bold">{connectionMetrics.messagesReceived}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Data Transferred</p>
                      <p className="text-2xl font-bold">
                        {(connectionMetrics.bytesTransferred / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Reconnect Attempts</p>
                      <p className="text-2xl font-bold">{connectionMetrics.reconnectAttempts}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Errors</p>
                      <p className="text-2xl font-bold text-red-500">{connectionMetrics.errors}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="memory">
              <Card>
                <CardContent className="pt-6">
                  {memoryMetrics ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Heap Used</span>
                          <span className="text-sm">
                            {(memoryMetrics.heapUsed / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(memoryMetrics.heapUsed / memoryMetrics.heapTotal) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Total Heap Size</p>
                        <p className="text-lg">
                          {(memoryMetrics.heapTotal / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Memory metrics will be available after running tests
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}