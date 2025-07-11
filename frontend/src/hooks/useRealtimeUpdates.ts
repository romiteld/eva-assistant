import { useEffect, useCallback, useState, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { WebSocketEvent, RealtimeUpdate, Subscription } from '@/types/websocket';

interface UseRealtimeUpdatesOptions<T> {
  entity: string;
  roomId?: string;
  onUpdate?: (update: RealtimeUpdate<T>) => void;
  onCreate?: (data: T) => void;
  onDelete?: (id: string) => void;
  autoJoinRoom?: boolean;
}

interface RealtimeState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
}

export function useRealtimeUpdates<T extends { id: string }>(
  options: UseRealtimeUpdatesOptions<T>
): {
  state: RealtimeState<T>;
  sendUpdate: (type: RealtimeUpdate<T>['type'], data: Partial<T>, id?: string) => Promise<void>;
  refresh: () => void;
  subscribe: (handler: (update: RealtimeUpdate<T>) => void) => Subscription;
} {
  const { entity, roomId, onUpdate, onCreate, onDelete, autoJoinRoom = true } = options;
  const { isConnected, subscribe, emit, joinRoom, leaveRoom } = useWebSocket();
  
  const [state, setState] = useState<RealtimeState<T>>({
    data: [],
    loading: false,
    error: null,
    lastUpdate: null,
  });

  const dataMapRef = useRef<Map<string, T>>(new Map());
  const subscribersRef = useRef<Set<(update: RealtimeUpdate<T>) => void>>(new Set());

  // Join room if specified
  useEffect(() => {
    if (isConnected && roomId && autoJoinRoom) {
      joinRoom(roomId).catch(error => {
        console.error('Failed to join room:', error);
        setState(prev => ({ ...prev, error }));
      });

      return () => {
        leaveRoom(roomId).catch(console.error);
      };
    }
  }, [isConnected, roomId, autoJoinRoom, joinRoom, leaveRoom]);

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback((update: RealtimeUpdate<T>) => {
    if (update.entity !== entity) return;

    setState(prev => {
      const newState = { ...prev, lastUpdate: new Date() };

      switch (update.type) {
        case 'create':
          if (update.data) {
            dataMapRef.current.set(update.id, update.data);
            newState.data = Array.from(dataMapRef.current.values());
            onCreate?.(update.data);
          }
          break;

        case 'update':
          if (update.data) {
            const existing = dataMapRef.current.get(update.id);
            if (existing) {
              const updated = { ...existing, ...update.data };
              dataMapRef.current.set(update.id, updated);
              newState.data = Array.from(dataMapRef.current.values());
            }
          }
          break;

        case 'delete':
          dataMapRef.current.delete(update.id);
          newState.data = Array.from(dataMapRef.current.values());
          onDelete?.(update.id);
          break;
      }

      return newState;
    });

    // Notify custom handler
    onUpdate?.(update);

    // Notify all subscribers
    subscribersRef.current.forEach(handler => handler(update));
  }, [entity, onCreate, onDelete, onUpdate]);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    const subscriptions = [
      subscribe(WebSocketEvent.DATA_UPDATE, handleRealtimeUpdate),
      subscribe(WebSocketEvent.DATA_CREATE, (data: any) => {
        handleRealtimeUpdate({
          type: 'create',
          entity,
          id: data.id,
          data,
          timestamp: new Date(),
          userId: data.userId || '',
        });
      }),
      subscribe(WebSocketEvent.DATA_DELETE, (data: any) => {
        handleRealtimeUpdate({
          type: 'delete',
          entity,
          id: data.id,
          timestamp: new Date(),
          userId: data.userId || '',
        });
      }),
    ];

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [isConnected, entity, subscribe, handleRealtimeUpdate]);

  // Send update to server
  const sendUpdate = useCallback(
    async (type: RealtimeUpdate<T>['type'], data: Partial<T>, id?: string) => {
      if (!isConnected) {
        throw new Error('WebSocket not connected');
      }

      const updateId = id || (data as any).id || generateId();
      const update: RealtimeUpdate<T> = {
        type,
        entity,
        id: updateId,
        data: type !== 'delete' ? (data as T) : undefined,
        timestamp: new Date(),
        userId: '', // Will be set by server
      };

      // Optimistic update
      handleRealtimeUpdate({ ...update, userId: 'current-user' });

      try {
        await emit(WebSocketEvent.DATA_UPDATE, update);
      } catch (error) {
        // Revert optimistic update on error
        if (update.previousData) {
          handleRealtimeUpdate({
            type: 'update',
            entity,
            id: updateId,
            data: update.previousData,
            timestamp: new Date(),
            userId: 'current-user',
          });
        } else if (type === 'create') {
          handleRealtimeUpdate({
            type: 'delete',
            entity,
            id: updateId,
            timestamp: new Date(),
            userId: 'current-user',
          });
        }
        throw error;
      }
    },
    [isConnected, entity, emit, handleRealtimeUpdate]
  );

  // Manual refresh
  const refresh = useCallback(() => {
    if (roomId) {
      emit(WebSocketEvent.DATA_SYNC, { entity, roomId });
    }
  }, [entity, roomId, emit]);

  // Subscribe to updates
  const subscribeToUpdates = useCallback(
    (handler: (update: RealtimeUpdate<T>) => void): Subscription => {
      subscribersRef.current.add(handler);

      return {
        unsubscribe: () => {
          subscribersRef.current.delete(handler);
        },
      };
    },
    []
  );

  return {
    state,
    sendUpdate,
    refresh,
    subscribe: subscribeToUpdates,
  };
}

// Utility function to generate ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}