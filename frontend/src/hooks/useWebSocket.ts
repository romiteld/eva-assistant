import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { WebSocketEvent, Subscription } from '@/types/websocket';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectOnMount?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    socket,
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
  } = useWebSocketContext();

  const subscriptionsRef = useRef<Map<string, (data: any) => void>>(new Map());

  // Auto-connect on mount if specified
  useEffect(() => {
    if (options.autoConnect && !isConnected) {
      connect();
    }

    return () => {
      if (options.reconnectOnMount) {
        disconnect();
      }
    };
  }, [options.autoConnect, options.reconnectOnMount, isConnected, connect, disconnect]);

  // Enhanced emit with callback support
  const emitWithAck = useCallback(
    (event: string, data?: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket not connected'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Emit timeout'));
        }, 5000);

        socket.emit(event, data, (response: any) => {
          clearTimeout(timeout);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
    },
    [socket]
  );

  // Subscribe to event with automatic cleanup
  const subscribe = useCallback(
    (event: string, handler: (data: any) => void): Subscription => {
      on(event, handler);
      subscriptionsRef.current.set(event, handler);

      return {
        unsubscribe: () => {
          off(event, handler);
          subscriptionsRef.current.delete(event);
        },
      };
    },
    [on, off]
  );

  // Subscribe to multiple events
  const subscribeToMany = useCallback(
    (events: Record<string, (data: any) => void>): Subscription => {
      const unsubscribers: (() => void)[] = [];

      Object.entries(events).forEach(([event, handler]) => {
        const subscription = subscribe(event, handler);
        unsubscribers.push(subscription.unsubscribe);
      });

      return {
        unsubscribe: () => {
          unsubscribers.forEach(unsub => unsub());
        },
      };
    },
    [subscribe]
  );

  // Wait for connection
  const waitForConnection = useCallback(
    (timeout = 5000): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (isConnected) {
          resolve();
          return;
        }

        const timeoutId = setTimeout(() => {
          off(WebSocketEvent.CONNECT, handleConnect);
          reject(new Error('Connection timeout'));
        }, timeout);

        const handleConnect = () => {
          clearTimeout(timeoutId);
          resolve();
        };

        on(WebSocketEvent.CONNECT, handleConnect);
      });
    },
    [isConnected, on, off]
  );

  // Clean up all subscriptions on unmount
  useEffect(() => {
    const subscriptions = subscriptionsRef.current;
    return () => {
      subscriptions.forEach((handler, event) => {
        off(event, handler);
      });
      subscriptions.clear();
    };
  }, [off]);

  return {
    socket,
    connectionState,
    isConnected,
    connect,
    disconnect,
    emit,
    emitWithAck,
    on,
    off,
    subscribe,
    subscribeToMany,
    joinRoom,
    leaveRoom,
    updatePresence,
    waitForConnection,
  };
};