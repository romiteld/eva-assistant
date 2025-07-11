import { Socket } from 'socket.io-client';

// WebSocket Event Types
export enum WebSocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT_ERROR = 'reconnect_error',
  RECONNECT_FAILED = 'reconnect_failed',
  ERROR = 'error',
  
  // Authentication events
  AUTH_REQUEST = 'auth:request',
  AUTH_SUCCESS = 'auth:success',
  AUTH_ERROR = 'auth:error',
  
  // Room events
  ROOM_JOIN = 'room:join',
  ROOM_LEAVE = 'room:leave',
  ROOM_USERS = 'room:users',
  
  // Presence events
  PRESENCE_UPDATE = 'presence:update',
  PRESENCE_JOIN = 'presence:join',
  PRESENCE_LEAVE = 'presence:leave',
  
  // Real-time data events
  DATA_UPDATE = 'data:update',
  DATA_CREATE = 'data:create',
  DATA_DELETE = 'data:delete',
  DATA_SYNC = 'data:sync',
  
  // Custom events
  NOTIFICATION = 'notification',
  BROADCAST = 'broadcast',
  PING = 'ping',
  PONG = 'pong',
}

// WebSocket Connection State
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// User Presence Status
export interface UserPresence {
  userId: string;
  email: string;
  name?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, any>;
}

// Room Information
export interface Room {
  id: string;
  name: string;
  users: UserPresence[];
  metadata?: Record<string, any>;
}

// WebSocket Message Types
export interface WebSocketMessage<T = any> {
  id: string;
  event: WebSocketEvent | string;
  data: T;
  timestamp: Date;
  userId?: string;
  roomId?: string;
}

// Authentication Payload
export interface AuthPayload {
  token: string;
  userId: string;
  email: string;
  metadata?: Record<string, any>;
}

// WebSocket Client Options
export interface WebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
  auth?: AuthPayload;
  transports?: ('websocket' | 'polling')[];
}

// WebSocket Context Value
export interface WebSocketContextValue {
  socket: Socket | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler?: (data: any) => void) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  updatePresence: (status: UserPresence['status']) => void;
}

// Event Handler Types
export type WebSocketEventHandler<T = any> = (data: T) => void;
export type WebSocketErrorHandler = (error: Error) => void;

// Subscription Types
export interface Subscription {
  unsubscribe: () => void;
}

// Real-time Update Types
export interface RealtimeUpdate<T = any> {
  type: 'create' | 'update' | 'delete';
  entity: string;
  id: string;
  data?: T;
  previousData?: T;
  timestamp: Date;
  userId: string;
}

// Broadcast Message Types
export interface BroadcastMessage {
  channel: string;
  message: any;
  senderId: string;
  timestamp: Date;
}