import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import {
  WebSocketEvent,
  ConnectionState,
  WebSocketOptions,
  AuthPayload,
  UserPresence,
  WebSocketMessage,
  RealtimeUpdate,
} from '@/types/websocket';

class WebSocketService extends EventEmitter {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private options: Required<WebSocketOptions>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private rooms: Set<string> = new Set();
  private eventHandlers: Map<string, Set<Function>> = new Map();

  constructor(options: WebSocketOptions = {}) {
    super();
    
    this.options = {
      url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3000',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      auth: undefined,
      ...options,
    } as Required<WebSocketOptions>;

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  // Connection Management
  connect(): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      this.socket = io(this.options.url, {
        reconnection: this.options.reconnection,
        reconnectionAttempts: this.options.reconnectionAttempts,
        reconnectionDelay: this.options.reconnectionDelay,
        reconnectionDelayMax: this.options.reconnectionDelayMax,
        timeout: this.options.timeout,
        transports: this.options.transports,
        auth: this.options.auth,
      });

      this.setupEventListeners();
      this.setupPingPong();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.emit(WebSocketEvent.ERROR, error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.cleanupPingPong();
      this.socket.disconnect();
      this.socket = null;
      this.rooms.clear();
      this.setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  // Authentication
  async authenticate(authPayload: AuthPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.socket.emit(WebSocketEvent.AUTH_REQUEST, authPayload);

      this.socket.once(WebSocketEvent.AUTH_SUCCESS, () => {
        clearTimeout(timeout);
        this.options.auth = authPayload;
        resolve();
      });

      this.socket.once(WebSocketEvent.AUTH_ERROR, (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message || 'Authentication failed'));
      });
    });
  }

  // Room Management
  async joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 5000);

      this.socket.emit(WebSocketEvent.ROOM_JOIN, { roomId });

      this.socket.once(`${WebSocketEvent.ROOM_JOIN}:${roomId}:success`, () => {
        clearTimeout(timeout);
        this.rooms.add(roomId);
        resolve();
      });

      this.socket.once(`${WebSocketEvent.ROOM_JOIN}:${roomId}:error`, (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message || 'Failed to join room'));
      });
    });
  }

  async leaveRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(WebSocketEvent.ROOM_LEAVE, { roomId });
      this.rooms.delete(roomId);
      resolve();
    });
  }

  // Event Emission
  emitEvent(event: string, data?: any): void {
    if (!this.socket) {
      console.warn('Cannot emit event: socket not connected');
      return;
    }

    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      event,
      data,
      timestamp: new Date(),
      userId: this.options.auth?.userId,
    };

    this.socket.emit(event, message);
  }

  // Event Subscription
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    const eventName = String(event);
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    
    this.eventHandlers.get(eventName)!.add(listener);
    
    if (this.socket) {
      this.socket.on(eventName, listener);
    }
    super.on(event, listener);
    return this;
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    const eventName = String(event);
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(listener);
      if (this.socket) {
        this.socket.off(eventName, listener);
      }
    }
    super.off(event, listener);
    return this;
  }

  once(event: string | symbol, listener: (...args: any[]) => void): this {
    const wrappedHandler = (...args: any[]) => {
      listener(...args);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
    return this;
  }

  // Presence Management
  updatePresence(status: UserPresence['status'], metadata?: Record<string, any>): void {
    if (!this.socket || !this.options.auth) {
      return;
    }

    const presence: Partial<UserPresence> = {
      userId: this.options.auth.userId,
      email: this.options.auth.email,
      status,
      lastSeen: new Date(),
      metadata,
    };

    this.socket.emit(WebSocketEvent.PRESENCE_UPDATE, presence);
  }

  // Utility Methods
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getRooms(): string[] {
    return Array.from(this.rooms);
  }

  // Public getter for socket
  getSocket(): Socket | null {
    return this.socket;
  }

  // Private Methods
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on(WebSocketEvent.CONNECT, () => {
      console.log('WebSocket connected');
      this.setConnectionState(ConnectionState.CONNECTED);
      this.emit(WebSocketEvent.CONNECT);
      
      // Rejoin rooms after reconnection
      this.rooms.forEach(roomId => {
        this.joinRoom(roomId).catch(console.error);
      });
      
      // Re-attach saved event handlers
      this.eventHandlers.forEach((handlers, event) => {
        handlers.forEach(handler => {
          this.socket!.on(event, handler as any);
        });
      });
    });

    this.socket.on(WebSocketEvent.DISCONNECT, (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.emit(WebSocketEvent.DISCONNECT, reason);
    });

    this.socket.on(WebSocketEvent.RECONNECT, (attemptNumber: any) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.emit(WebSocketEvent.RECONNECT, attemptNumber);
    });

    this.socket.on(WebSocketEvent.RECONNECT_ATTEMPT, (attemptNumber: any) => {
      console.log('WebSocket reconnection attempt', attemptNumber);
      this.setConnectionState(ConnectionState.RECONNECTING);
      this.emit(WebSocketEvent.RECONNECT_ATTEMPT, attemptNumber);
    });

    this.socket.on(WebSocketEvent.RECONNECT_ERROR, (error: any) => {
      console.error('WebSocket reconnection error:', error);
      this.emit(WebSocketEvent.RECONNECT_ERROR, error);
    });

    this.socket.on(WebSocketEvent.RECONNECT_FAILED, () => {
      console.error('WebSocket reconnection failed');
      this.setConnectionState(ConnectionState.ERROR);
      this.emit(WebSocketEvent.RECONNECT_FAILED);
    });

    this.socket.on(WebSocketEvent.ERROR, (error: any) => {
      console.error('WebSocket error:', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.emit(WebSocketEvent.ERROR, error);
    });

    // Handle pong responses
    this.socket.on(WebSocketEvent.PONG, () => {
      this.emit('pong');
    });
  }

  private setupPingPong(): void {
    this.cleanupPingPong();
    
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit(WebSocketEvent.PING);
      }
    }, 30000);
  }

  private cleanupPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.emit('connectionStateChange', state);
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.eventHandlers.clear();
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const getWebSocketService = (options?: WebSocketOptions): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(options);
  }
  return webSocketService;
};

export const destroyWebSocketService = (): void => {
  if (webSocketService) {
    webSocketService.destroy();
    webSocketService = null;
  }
};

export default WebSocketService;