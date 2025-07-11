// Real-time Connection Monitor Component
// Displays live metrics and health status for WebSocket connections

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase, realtimeHelpers } from '@/lib/supabase/browser';
import {
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Zap,
  Users,
  MessageSquare,
  BarChart,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency: number;
  packetLoss: number;
  jitter: number;
  uptime: number;
  lastCheck: Date;
}

interface RealtimeMetrics {
  timestamp: Date;
  activeConnections: number;
  messagesPerSecond: number;
  avgLatency: number;
  errorRate: number;
  bytesTransferred: number;
}

interface PresenceUser {
  userId: string;
  onlineAt: string;
  status: string;
  metadata?: any;
}

export default function RealtimeMonitor() {
  // Connection states
  const [wsHealth, setWsHealth] = useState<ConnectionHealth>({
    status: 'unknown',
    latency: 0,
    packetLoss: 0,
    jitter: 0,
    uptime: 0,
    lastCheck: new Date()
  });
  
  const [supabaseHealth, setSupabaseHealth] = useState<ConnectionHealth>({
    status: 'unknown',
    latency: 0,
    packetLoss: 0,
    jitter: 0,
    uptime: 0,
    lastCheck: new Date()
  });
  
  // Metrics
  const [metrics, setMetrics] = useState<RealtimeMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<RealtimeMetrics>({
    timestamp: new Date(),
    activeConnections: 0,
    messagesPerSecond: 0,
    avgLatency: 0,
    errorRate: 0,
    bytesTransferred: 0
  });
  
  // Presence
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const bytesRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  
  const startMonitoring = async () => {
    // Connect to WebSocket for monitoring
    connectWebSocket();
    
    // Setup Supabase presence channel
    setupPresenceChannel();
    
    // Start health checks
    healthCheckIntervalRef.current = setInterval(performHealthCheck, 5000);
    
    // Start metrics collection
    metricsIntervalRef.current = setInterval(collectMetrics, 1000);
  };
  
  const stopMonitoring = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (presenceChannel) {
      presenceChannel.unsubscribe();
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }
    
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }
  };
  
  const connectWebSocket = () => {
    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https', 'wss')}/functions/v1/websocket-handler`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('Monitor WebSocket connected');
        updateWsHealth('healthy', 0);
      };
      
      ws.onmessage = (event) => {
        messageCountRef.current++;
        bytesRef.current += event.data.length;
        
        try {
          const message = JSON.parse(event.data);
          processMonitoringMessage(message);
        } catch (error) {
          errorCountRef.current++;
          console.error('Error parsing message:', error instanceof Error ? error.message : 'Unknown error');
        }
      };
      
      ws.onerror = () => {
        errorCountRef.current++;
        updateWsHealth('unhealthy', 0);
      };
      
      ws.onclose = () => {
        updateWsHealth('unhealthy', 0);
        // Attempt reconnection after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
      
    } catch (error) {
      console.error('WebSocket connection error:', error instanceof Error ? error.message : 'Unknown error');
      updateWsHealth('unhealthy', 0);
    }
  };
  
  const setupPresenceChannel = () => {
    const channel = supabase.channel('monitor-presence')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Transform presence state to PresenceUser array
        const users: PresenceUser[] = Object.entries(state).flatMap(([_, presences]) => 
          presences.map((presence: any) => ({
            userId: presence.user_id || 'unknown',
            onlineAt: new Date().toISOString(),
            status: 'online',
            metadata: presence
          }))
        );
        setOnlineUsers(users);
        updateSupabaseHealth('healthy', 0);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: 'monitor',
            onlineAt: new Date().toISOString(),
            status: 'monitoring'
          });
        }
      });
    
    setPresenceChannel(channel);
  };
  
  const performHealthCheck = async () => {
    // WebSocket health check
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const pingStart = Date.now();
      
      wsRef.current.send(JSON.stringify({
        type: 'command',
        data: { command: 'ping', params: { timestamp: pingStart } },
        timestamp: new Date().toISOString()
      }));
      
      // Wait for pong response (handled in message processor)
    } else {
      updateWsHealth('unhealthy', 0);
    }
    
    // Supabase health check
    try {
      const start = Date.now();
      const { error } = await supabase.from('websocket_connections').select('count').limit(1);
      const latency = Date.now() - start;
      
      if (!error) {
        updateSupabaseHealth('healthy', latency);
      } else {
        updateSupabaseHealth('degraded', latency);
      }
    } catch (error) {
      console.error('Health check error:', error instanceof Error ? error.message : 'Unknown error');
      updateSupabaseHealth('unhealthy', 0);
    }
  };
  
  const collectMetrics = () => {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000; // seconds
    
    const newMetrics: RealtimeMetrics = {
      timestamp: new Date(),
      activeConnections: onlineUsers.length,
      messagesPerSecond: messageCountRef.current / elapsed,
      avgLatency: (wsHealth.latency + supabaseHealth.latency) / 2,
      errorRate: (errorCountRef.current / messageCountRef.current) * 100 || 0,
      bytesTransferred: bytesRef.current
    };
    
    setCurrentMetrics(newMetrics);
    setMetrics(prev => {
      const updated = [...prev, newMetrics];
      // Keep only last 60 data points (1 minute of data)
      return updated.slice(-60);
    });
  };
  
  const processMonitoringMessage = (message: any) => {
    switch (message.type) {
      case 'pong':
        const latency = Date.now() - message.timestamp;
        updateWsHealth('healthy', latency);
        break;
        
      case 'stats':
        // Process server-side statistics
        if (message.data) {
          setCurrentMetrics(prev => ({
            ...prev,
            activeConnections: message.data.activeConnections || prev.activeConnections,
            messagesPerSecond: message.data.messagesPerSecond || prev.messagesPerSecond
          }));
        }
        break;
        
      case 'error':
        errorCountRef.current++;
        break;
    }
  };
  
  const updateWsHealth = (status: ConnectionHealth['status'], latency: number) => {
    setWsHealth(prev => {
      const jitter = Math.abs(latency - prev.latency);
      return {
        status,
        latency,
        packetLoss: prev.packetLoss, // Would need proper measurement
        jitter: (prev.jitter * 0.9) + (jitter * 0.1), // Exponential moving average
        uptime: Date.now() - startTimeRef.current,
        lastCheck: new Date()
      };
    });
  };
  
  const updateSupabaseHealth = (status: ConnectionHealth['status'], latency: number) => {
    setSupabaseHealth(prev => ({
      ...prev,
      status,
      latency,
      lastCheck: new Date()
    }));
  };
  
  // Helper functions
  const getHealthColor = (status: ConnectionHealth['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };
  
  const getHealthIcon = (status: ConnectionHealth['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy': return <WifiOff className="w-5 h-5 text-red-500" />;
      default: return <Wifi className="w-5 h-5 text-gray-500" />;
    }
  };
  
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };
  
  // Initialize monitoring
  useEffect(() => {
    startMonitoring();
    
    return () => {
      stopMonitoring();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Real-time Connection Monitor
        </h2>
        <Badge variant="outline" className="gap-1">
          <RefreshCw className="w-3 h-3" />
          Live
        </Badge>
      </div>
      
      {/* Connection Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              WebSocket Health
              {getHealthIcon(wsHealth.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`text-sm font-medium ${getHealthColor(wsHealth.status)}`}>
                  {wsHealth.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Latency</span>
                <span className="text-sm font-medium">{wsHealth.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Jitter</span>
                <span className="text-sm font-medium">{wsHealth.jitter.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <span className="text-sm font-medium">{formatUptime(wsHealth.uptime)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Supabase Realtime Health
              {getHealthIcon(supabaseHealth.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`text-sm font-medium ${getHealthColor(supabaseHealth.status)}`}>
                  {supabaseHealth.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Latency</span>
                <span className="text-sm font-medium">{supabaseHealth.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Users</span>
                <span className="text-sm font-medium">{onlineUsers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Check</span>
                <span className="text-sm font-medium">
                  {supabaseHealth.lastCheck.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Real-time Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Real-time Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Messages/sec</p>
              <p className="text-2xl font-bold">
                {currentMetrics.messagesPerSecond.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Latency</p>
              <p className="text-2xl font-bold">
                {currentMetrics.avgLatency.toFixed(0)}ms
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Error Rate</p>
              <p className="text-2xl font-bold">
                {currentMetrics.errorRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data Transfer</p>
              <p className="text-2xl font-bold">
                {formatBytes(currentMetrics.bytesTransferred)}
              </p>
            </div>
          </div>
          
          {/* Latency Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgLatency" 
                  stroke="hsl(var(--primary))" 
                  name="Latency (ms)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="messagesPerSecond" 
                  stroke="hsl(var(--chart-2))" 
                  name="Messages/sec"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Online Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Online Users ({onlineUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users currently online</p>
          ) : (
            <div className="space-y-2">
              {onlineUsers.map((user, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm">{user.userId}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(user.onlineAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Alerts */}
      {(wsHealth.status === 'unhealthy' || supabaseHealth.status === 'unhealthy') && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Connection issues detected. Some features may be unavailable.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}