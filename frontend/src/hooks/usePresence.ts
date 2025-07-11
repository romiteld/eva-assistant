import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { WebSocketEvent, UserPresence, Subscription } from '@/types/websocket';

interface UsePresenceOptions {
  roomId?: string;
  updateInterval?: number;
  includeOfflineUsers?: boolean;
}

interface PresenceState {
  users: UserPresence[];
  onlineCount: number;
  myPresence: UserPresence | null;
}

export function usePresence(options: UsePresenceOptions = {}) {
  const { 
    roomId, 
    updateInterval = 30000, // 30 seconds
    includeOfflineUsers = false 
  } = options;
  
  const { isConnected, subscribe, updatePresence, joinRoom, leaveRoom } = useWebSocket();
  const [state, setState] = useState<PresenceState>({
    users: [],
    onlineCount: 0,
    myPresence: null,
  });

  const presenceMapRef = useRef<Map<string, UserPresence>>(new Map());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Join room if specified
  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId).catch(console.error);

      return () => {
        leaveRoom(roomId).catch(console.error);
      };
    }
  }, [isConnected, roomId, joinRoom, leaveRoom]);

  // Update state from presence map
  const updateState = useCallback(() => {
    const allUsers = Array.from(presenceMapRef.current.values());
    const users = includeOfflineUsers 
      ? allUsers 
      : allUsers.filter(u => u.status !== 'offline');
    
    const onlineCount = allUsers.filter(u => u.status === 'online').length;
    
    setState(prev => ({
      ...prev,
      users: users.sort((a, b) => {
        // Sort by status (online first) then by name
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.name || a.email).localeCompare(b.name || b.email);
      }),
      onlineCount,
    }));
  }, [includeOfflineUsers]);

  // Handle presence updates
  const handlePresenceUpdate = useCallback((presence: UserPresence) => {
    presenceMapRef.current.set(presence.userId, presence);
    updateState();
  }, [updateState]);

  const handlePresenceJoin = useCallback((presence: UserPresence) => {
    presenceMapRef.current.set(presence.userId, presence);
    updateState();
  }, [updateState]);

  const handlePresenceLeave = useCallback((userId: string) => {
    const user = presenceMapRef.current.get(userId);
    if (user) {
      user.status = 'offline';
      user.lastSeen = new Date();
    }
    updateState();
  }, [updateState]);

  const handleRoomUsers = useCallback((users: UserPresence[]) => {
    presenceMapRef.current.clear();
    users.forEach(user => {
      presenceMapRef.current.set(user.userId, user);
    });
    updateState();
  }, [updateState]);

  // Subscribe to presence events
  useEffect(() => {
    if (!isConnected) return;

    const subscriptions = [
      subscribe(WebSocketEvent.PRESENCE_UPDATE, handlePresenceUpdate),
      subscribe(WebSocketEvent.PRESENCE_JOIN, handlePresenceJoin),
      subscribe(WebSocketEvent.PRESENCE_LEAVE, handlePresenceLeave),
    ];

    if (roomId) {
      subscriptions.push(
        subscribe(WebSocketEvent.ROOM_USERS, handleRoomUsers)
      );
    }

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [
    isConnected, 
    roomId, 
    subscribe, 
    handlePresenceUpdate, 
    handlePresenceJoin, 
    handlePresenceLeave,
    handleRoomUsers,
  ]);

  // Set user status
  const setStatus = useCallback((status: UserPresence['status']) => {
    updatePresence(status);
    
    // Update local state optimistically
    if (state.myPresence) {
      const updatedPresence = { ...state.myPresence, status, lastSeen: new Date() };
      setState(prev => ({ ...prev, myPresence: updatedPresence }));
      presenceMapRef.current.set(updatedPresence.userId, updatedPresence);
      updateState();
    }
  }, [updatePresence, state.myPresence, updateState]);

  // Auto-update presence periodically
  useEffect(() => {
    if (!isConnected || !updateInterval) return;

    updateIntervalRef.current = setInterval(() => {
      updatePresence('online');
    }, updateInterval);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [isConnected, updateInterval, updatePresence]);

  // Set away status on window blur
  useEffect(() => {
    const handleBlur = () => setStatus('away');
    const handleFocus = () => setStatus('online');

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [setStatus]);

  // Utility functions
  const isUserOnline = useCallback((userId: string): boolean => {
    const user = presenceMapRef.current.get(userId);
    return user?.status === 'online' || false;
  }, []);

  const getUserPresence = useCallback((userId: string): UserPresence | undefined => {
    return presenceMapRef.current.get(userId);
  }, []);

  const getOnlineUsers = useCallback((): UserPresence[] => {
    return Array.from(presenceMapRef.current.values())
      .filter(u => u.status === 'online');
  }, []);

  return {
    users: state.users,
    onlineCount: state.onlineCount,
    myPresence: state.myPresence,
    setStatus,
    isUserOnline,
    getUserPresence,
    getOnlineUsers,
  };
}