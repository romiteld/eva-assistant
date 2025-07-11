import { Server as HTTPServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { parse } from 'url';
import next from 'next';
import {
  WebSocketEvent,
  AuthPayload,
  UserPresence,
  Room,
  WebSocketMessage,
} from '@/types/websocket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Socket.IO server instance
let io: SocketIOServer | null = null;

// In-memory stores (consider Redis for production)
const rooms: Map<string, Room> = new Map();
const userSockets: Map<string, Set<string>> = new Map();
const socketUsers: Map<string, AuthPayload> = new Map();
const userPresence: Map<string, UserPresence> = new Map();

// Initialize Socket.IO with HTTP server
export function initializeSocketIOServer(server: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    path: '/api/socket/io',
  });

  setupSocketHandlers(io);
  
  console.log('Socket.IO server initialized');
  return io;
}

// Set up socket event handlers
function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log('New WebSocket connection:', socket.id);

    // Handle authentication
    socket.on(WebSocketEvent.AUTH_REQUEST, async (authPayload: AuthPayload) => {
      try {
        // Validate auth token
        const isValid = await validateAuthToken(authPayload.token);
        
        if (!isValid) {
          socket.emit(WebSocketEvent.AUTH_ERROR, { message: 'Invalid authentication token' });
          return;
        }

        // Store user info
        socketUsers.set(socket.id, authPayload);
        
        // Track user sockets
        if (!userSockets.has(authPayload.userId)) {
          userSockets.set(authPayload.userId, new Set());
        }
        userSockets.get(authPayload.userId)!.add(socket.id);

        // Update user presence
        const presence: UserPresence = {
          userId: authPayload.userId,
          email: authPayload.email,
          name: authPayload.metadata?.name,
          status: 'online',
          lastSeen: new Date(),
          metadata: authPayload.metadata,
        };
        userPresence.set(authPayload.userId, presence);

        socket.emit(WebSocketEvent.AUTH_SUCCESS, { userId: authPayload.userId });
        
        // Broadcast presence update
        io.emit(WebSocketEvent.PRESENCE_UPDATE, presence);
      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit(WebSocketEvent.AUTH_ERROR, { message: 'Authentication failed' });
      }
    });

    // Handle room management
    socket.on(WebSocketEvent.ROOM_JOIN, async ({ roomId }: { roomId: string }) => {
      try {
        const user = socketUsers.get(socket.id);
        if (!user) {
          socket.emit(`${WebSocketEvent.ROOM_JOIN}:${roomId}:error`, { 
            message: 'Not authenticated' 
          });
          return;
        }

        // Join socket.io room
        await socket.join(roomId);

        // Update room data
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            name: roomId,
            users: [],
          });
        }

        const room = rooms.get(roomId)!;
        const userPresenceData = userPresence.get(user.userId);
        
        if (userPresenceData && !room.users.some(u => u.userId === user.userId)) {
          room.users.push(userPresenceData);
        }

        socket.emit(`${WebSocketEvent.ROOM_JOIN}:${roomId}:success`);
        
        // Notify room members
        io.to(roomId).emit(WebSocketEvent.ROOM_USERS, room.users);
        io.to(roomId).emit(WebSocketEvent.PRESENCE_JOIN, userPresenceData);
      } catch (error) {
        console.error('Room join error:', error);
        socket.emit(`${WebSocketEvent.ROOM_JOIN}:${roomId}:error`, { 
          message: 'Failed to join room' 
        });
      }
    });

    socket.on(WebSocketEvent.ROOM_LEAVE, async ({ roomId }: { roomId: string }) => {
      try {
        const user = socketUsers.get(socket.id);
        if (!user) return;

        // Leave socket.io room
        await socket.leave(roomId);

        // Update room data
        const room = rooms.get(roomId);
        if (room) {
          room.users = room.users.filter(u => u.userId !== user.userId);
          
          if (room.users.length === 0) {
            rooms.delete(roomId);
          } else {
            io.to(roomId).emit(WebSocketEvent.ROOM_USERS, room.users);
            io.to(roomId).emit(WebSocketEvent.PRESENCE_LEAVE, user.userId);
          }
        }
      } catch (error) {
        console.error('Room leave error:', error);
      }
    });

    // Handle presence updates
    socket.on(WebSocketEvent.PRESENCE_UPDATE, (presence: Partial<UserPresence>) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      const currentPresence = userPresence.get(user.userId);
      if (currentPresence) {
        const updatedPresence: UserPresence = {
          ...currentPresence,
          ...presence,
          lastSeen: new Date(),
        };
        userPresence.set(user.userId, updatedPresence);

        // Broadcast to all connected clients
        io.emit(WebSocketEvent.PRESENCE_UPDATE, updatedPresence);
      }
    });

    // Handle data events
    socket.on(WebSocketEvent.DATA_UPDATE, (data: any) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      const message: WebSocketMessage = {
        id: generateId(),
        event: WebSocketEvent.DATA_UPDATE,
        data,
        timestamp: new Date(),
        userId: user.userId,
      };

      // Broadcast to all clients or specific rooms
      if (data.roomId) {
        io.to(data.roomId).emit(WebSocketEvent.DATA_UPDATE, message);
      } else {
        io.emit(WebSocketEvent.DATA_UPDATE, message);
      }
    });

    // Handle custom events
    socket.on(WebSocketEvent.BROADCAST, ({ channel, message }: any) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      io.emit(WebSocketEvent.BROADCAST, {
        channel,
        message,
        senderId: user.userId,
        timestamp: new Date(),
      });
    });

    // Handle ping/pong for connection health
    socket.on(WebSocketEvent.PING, () => {
      socket.emit(WebSocketEvent.PONG);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected:', socket.id);
      
      const user = socketUsers.get(socket.id);
      if (user) {
        // Remove socket from user's socket list
        const sockets = userSockets.get(user.userId);
        if (sockets) {
          sockets.delete(socket.id);
          
          // If user has no more sockets, update presence to offline
          if (sockets.size === 0) {
            userSockets.delete(user.userId);
            
            const presence = userPresence.get(user.userId);
            if (presence) {
              presence.status = 'offline';
              presence.lastSeen = new Date();
              io.emit(WebSocketEvent.PRESENCE_UPDATE, presence);
            }
          }
        }

        // Clean up socket user data
        socketUsers.delete(socket.id);

        // Remove user from all rooms
        rooms.forEach((room, roomId) => {
          if (room.users.some(u => u.userId === user.userId)) {
            room.users = room.users.filter(u => u.userId !== user.userId);
            io.to(roomId).emit(WebSocketEvent.ROOM_USERS, room.users);
            io.to(roomId).emit(WebSocketEvent.PRESENCE_LEAVE, user.userId);
            
            if (room.users.length === 0) {
              rooms.delete(roomId);
            }
          }
        });
      }
    });
  });
}

// Validate auth token
async function validateAuthToken(token: string): Promise<boolean> {
  try {
    if (!token) return false;
    
    // Implement your token validation logic here
    // For example, verify JWT token or validate with your auth provider
    
    return true; // Placeholder
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get Socket.IO instance
export function getIO(): SocketIOServer | null {
  return io;
}

// Broadcast message to all clients
export function broadcast(event: string, data: any) {
  if (io) {
    io.emit(event, data);
  }
}

// Broadcast message to specific room
export function broadcastToRoom(roomId: string, event: string, data: any) {
  if (io) {
    io.to(roomId).emit(event, data);
  }
}

// Get room information
export function getRoomInfo(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

// Get all rooms
export function getAllRooms(): Room[] {
  return Array.from(rooms.values());
}

// Get user presence
export function getUserPresence(userId: string): UserPresence | undefined {
  return userPresence.get(userId);
}

// Get all online users
export function getOnlineUsers(): UserPresence[] {
  return Array.from(userPresence.values()).filter(u => u.status === 'online');
}