import { NextRequest, NextResponse } from 'next/server';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  WebSocketEvent,
  AuthPayload,
  UserPresence,
  Room,
  WebSocketMessage,
} from '@/types/websocket';

// Store server instance
let io: SocketIOServer | null = null;

// In-memory stores (in production, use Redis or similar)
const rooms: Map<string, Room> = new Map();
const userSockets: Map<string, Set<string>> = new Map();
const socketUsers: Map<string, AuthPayload> = new Map();
const userPresence: Map<string, UserPresence> = new Map();

// Initialize Socket.IO server
const initializeSocketServer = (httpServer: HTTPServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io?.on('connection', (socket) => {
    console.log('New WebSocket connection:', socket.id);

    // Handle authentication
    socket.on(WebSocketEvent.AUTH_REQUEST, async (authPayload: AuthPayload) => {
      try {
        // Validate auth token (implement your validation logic)
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
        io?.emit(WebSocketEvent.PRESENCE_UPDATE, presence);
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
        io?.to(roomId).emit(WebSocketEvent.ROOM_USERS, room.users);
        io?.to(roomId).emit(WebSocketEvent.PRESENCE_JOIN, userPresenceData);
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
            io?.to(roomId).emit(WebSocketEvent.ROOM_USERS, room.users);
            io?.to(roomId).emit(WebSocketEvent.PRESENCE_LEAVE, user.userId);
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
        io?.emit(WebSocketEvent.PRESENCE_UPDATE, updatedPresence);
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

      // Broadcast to all clients (or specific rooms)
      io?.emit(WebSocketEvent.DATA_UPDATE, message);
    });

    // Handle custom events
    socket.on(WebSocketEvent.BROADCAST, ({ channel, message }: any) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      io?.emit(WebSocketEvent.BROADCAST, {
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
              io?.emit(WebSocketEvent.PRESENCE_UPDATE, presence);
            }
          }
        }

        // Clean up socket user data
        socketUsers.delete(socket.id);

        // Remove user from all rooms
        rooms.forEach((room, roomId) => {
          if (room.users.some(u => u.userId === user.userId)) {
            room.users = room.users.filter(u => u.userId !== user.userId);
            io?.to(roomId).emit(WebSocketEvent.ROOM_USERS, room.users);
            io?.to(roomId).emit(WebSocketEvent.PRESENCE_LEAVE, user.userId);
            
            if (room.users.length === 0) {
              rooms.delete(roomId);
            }
          }
        });
      }
    });
  });

  return io;
};

// Validate auth token (implement based on your auth system)
async function validateAuthToken(token: string): Promise<boolean> {
  try {
    // For NextAuth, you might verify the JWT token
    // For Supabase, you might verify the access token
    // This is a placeholder - implement based on your auth system
    
    if (!token) return false;
    
    // Example: Verify JWT token
    // const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
    // return !!decoded;
    
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

// API Routes
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    status: 'WebSocket server endpoint',
    message: 'Use WebSocket client to connect' 
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle WebSocket-related HTTP endpoints if needed
    const body = await req.json();
    const { action, data } = body;

    switch (action) {
      case 'broadcast':
        if (io) {
          io?.emit(data.event, data.payload);
          return NextResponse.json({ success: true });
        }
        break;
        
      case 'getRooms':
        return NextResponse.json({ 
          rooms: Array.from(rooms.values()) 
        });
        
      case 'getPresence':
        return NextResponse.json({ 
          presence: Array.from(userPresence.values()) 
        });
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ error: 'WebSocket server not initialized' }, { status: 500 });
  } catch (error) {
    console.error('WebSocket API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Note: io and initializeSocketServer are internal to this module