'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from '@/app/providers';
import {
  WebSocketContextValue,
  ConnectionState,
  WebSocketEvent,
  AuthPayload,
  UserPresence,
} from '@/types/websocket';
import { getWebSocketService, destroyWebSocketService } from '@/lib/services/websocket';
import WebSocketService from '@/lib/services/websocket';

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
  autoConnect?: boolean;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  url,
  autoConnect = true 
}) => {
  const { user, loading } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isConnected, setIsConnected] = useState(false);
  const webSocketServiceRef = useRef<WebSocketService | null>(null);
  const hasAuthenticatedRef = useRef(false);
  const [sessionToken, setSessionToken] = useState<string>('');

  // Get session token from Supabase
  useEffect(() => {
    const getSessionToken = async () => {
      if (user) {
        const { supabase } = await import('@/lib/supabase/browser');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          setSessionToken(session.access_token);
        }
      }
    };
    getSessionToken();
  }, [user]);

  // Initialize WebSocket service
  useEffect(() => {
    let handleConnectionStateChange: ((state: ConnectionState) => void) | undefined;

    if (!webSocketServiceRef.current && !loading && (!user || sessionToken)) {
      const authPayload: AuthPayload | undefined = user && sessionToken ? {
        token: sessionToken,
        userId: user.id,
        email: user.email,
        metadata: {
          name: user.profile?.full_name || user.email,
          image: user.profile?.avatar_url,
        },
      } : undefined;

      webSocketServiceRef.current = getWebSocketService({
        url,
        autoConnect: false, // We'll handle connection manually
        auth: authPayload,
      });

      // Listen for connection state changes
      handleConnectionStateChange = (state: ConnectionState) => {
        setConnectionState(state);
        setIsConnected(state === ConnectionState.CONNECTED);
      };
      
      webSocketServiceRef.current.on('connectionStateChange', handleConnectionStateChange);

      // Auto-connect if user is authenticated and autoConnect is true
      if (autoConnect && user && authPayload) {
        webSocketServiceRef.current.connect();
      }
    }

    return () => {
      if (webSocketServiceRef.current && handleConnectionStateChange) {
        webSocketServiceRef.current.off('connectionStateChange', handleConnectionStateChange);
      }
    };
  }, [loading, user, url, autoConnect, sessionToken]);

  // Handle authentication when user changes
  useEffect(() => {
    const handleAuth = async () => {
      if (
        webSocketServiceRef.current && 
        user && 
        sessionToken &&
        webSocketServiceRef.current.isConnected() &&
        !hasAuthenticatedRef.current
      ) {
        try {
          const authPayload: AuthPayload = {
            token: sessionToken,
            userId: user.id,
            email: user.email,
            metadata: {
              name: user.profile?.full_name || user.email,
              image: user.profile?.avatar_url,
            },
          };

          await webSocketServiceRef.current.authenticate(authPayload);
          hasAuthenticatedRef.current = true;
          console.log('WebSocket authenticated successfully');
        } catch (error) {
          console.error('WebSocket authentication failed:', error);
        }
      }
    };

    handleAuth();
  }, [user, isConnected, sessionToken]);

  // Reset authentication flag when disconnected
  useEffect(() => {
    if (!isConnected) {
      hasAuthenticatedRef.current = false;
    }
  }, [isConnected]);

  // Context methods
  const connect = useCallback(() => {
    if (webSocketServiceRef.current && !webSocketServiceRef.current.isConnected()) {
      webSocketServiceRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.disconnect();
      hasAuthenticatedRef.current = false;
    }
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.emitEvent(event, data);
    }
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (webSocketServiceRef.current && handler) {
      webSocketServiceRef.current.off(event, handler);
    }
  }, []);

  const joinRoom = useCallback(async (roomId: string) => {
    if (webSocketServiceRef.current) {
      await webSocketServiceRef.current.joinRoom(roomId);
    }
  }, []);

  const leaveRoom = useCallback(async (roomId: string) => {
    if (webSocketServiceRef.current) {
      await webSocketServiceRef.current.leaveRoom(roomId);
    }
  }, []);

  const updatePresence = useCallback((status: UserPresence['status']) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.updatePresence(status);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webSocketServiceRef.current) {
        webSocketServiceRef.current.disconnect();
        destroyWebSocketService();
        webSocketServiceRef.current = null;
      }
    };
  }, []);

  const contextValue: WebSocketContextValue = {
    socket: webSocketServiceRef.current?.['socket'] || null,
    connectionState,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    updatePresence,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;