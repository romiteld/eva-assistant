// Real-time WebSocket Connection Hook
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { supabase } from '@/lib/supabase/browser';
import { getHttpWebSocketURL } from '@/lib/utils/url';

interface ConnectionState {
  isConnected: boolean;
  connectionId: string | null;
  latency: number;
  transport: string | null;
}

interface UseRealtimeConnectionOptions {
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeConnection(options: UseRealtimeConnectionOptions = {}) {
  const { toast } = useToast();
  const {
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [session, setSession] = useState<any>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    connectionId: null,
    latency: 0,
    transport: null
  });

  const [reconnectCount, setReconnectCount] = useState(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get session on mount and when user changes
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, [user]);

  // Heartbeat for connection health monitoring
  const startHeartbeat = useCallback(() => {
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping');
      }
    }, 25000); // Every 25 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Initialize socket connection
  const connect = useCallback(() => {
    if (!session?.access_token) {
      console.warn('No auth token available');
      return;
    }

    if (socketRef.current?.connected) {
      console.warn('Socket already connected');
      return;
    }

    const socket = io(getHttpWebSocketURL(), {
      auth: {
        token: session.access_token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setConnectionState({
        isConnected: true,
        connectionId: socket.id || null,
        latency: 0,
        transport: socket.io.engine.transport.name
      });
      setReconnectCount(0);
      onConnect?.();
      
      // Start heartbeat
      startHeartbeat();
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        connectionId: null
      }));
      stopHeartbeat();
      onDisconnect?.(reason);
      
      // Handle reconnection logic
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't auto-reconnect
        toast({
          title: 'Disconnected by server',
          variant: 'destructive'
        });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      onError?.(error);
      
      setReconnectCount(prev => prev + 1);
      if (reconnectCount >= reconnectionAttempts) {
        toast({
          title: 'Failed to connect to server',
          variant: 'destructive'
        });
        socket.disconnect();
      }
    });

    // Latency measurement
    socket.on('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      setConnectionState(prev => ({
        ...prev,
        latency
      }));
    });

    // Transport upgrade
    socket.io.on('upgrade' as any, (transport: any) => {
      console.log('Transport upgraded to:', transport.name);
      setConnectionState(prev => ({
        ...prev,
        transport: transport.name
      }));
    });

    socketRef.current = socket;
  }, [session, reconnectionAttempts, reconnectionDelay, onConnect, onDisconnect, onError, reconnectCount, startHeartbeat, stopHeartbeat, toast]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      stopHeartbeat();
    }
  }, [stopHeartbeat]);

  // Emit event helper
  const emit = useCallback((event: string, data?: any) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected, cannot emit event:', event);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  // Subscribe to event helper
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socketRef.current) {
      console.warn('Socket not initialized');
      return;
    }
    socketRef.current.on(event, handler);
    
    // Return cleanup function
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  // Subscribe to event once
  const once = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socketRef.current) {
      console.warn('Socket not initialized');
      return;
    }
    socketRef.current.once(event, handler);
  }, []);

  // Get socket instance (for advanced usage)
  const getSocket = useCallback(() => socketRef.current, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && session?.access_token) {
      connect();
    }

    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, session, connect, disconnect]);

  // Reconnect on auth change
  useEffect(() => {
    if (session?.access_token && socketRef.current && !socketRef.current.connected) {
      connect();
    }
  }, [session, connect]);

  return {
    // Connection state
    isConnected: connectionState.isConnected,
    connectionId: connectionState.connectionId,
    latency: connectionState.latency,
    transport: connectionState.transport,
    
    // Connection controls
    connect,
    disconnect,
    
    // Event methods
    emit,
    on,
    once,
    
    // Advanced
    getSocket,
    
    // Debugging
    reconnectCount
  };
}

// Namespace-specific hooks
export function useRealtimeNamespace(namespace: string, options?: UseRealtimeConnectionOptions) {
  const auth = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!auth.user) return;

    const socket = io(`${getHttpWebSocketURL()}/${namespace}`, {
      auth: {
        userId: auth.user.id
      }
    });

    socket.on('connect', () => {
      setIsConnected(true);
      options?.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      options?.onDisconnect?.(reason);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [namespace, auth.user, options]);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  return { isConnected, emit, on, socket: socketRef.current };
}