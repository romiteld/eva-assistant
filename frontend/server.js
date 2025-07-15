const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();


// WebSocket event types
const WebSocketEvent = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTH_REQUEST: 'auth:request',
  AUTH_SUCCESS: 'auth:success',
  AUTH_ERROR: 'auth:error',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_USERS: 'room:users',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  DATA_UPDATE: 'data:update',
  DATA_CREATE: 'data:create',
  DATA_DELETE: 'data:delete',
  DATA_SYNC: 'data:sync',
  BROADCAST: 'broadcast',
  PING: 'ping',
  PONG: 'pong',
};

// In-memory stores
const rooms = new Map();
const userSockets = new Map();
const socketUsers = new Map();
const userPresence = new Map();

app.prepare().then(() => {
  // Initialize Gemini WebSocket proxy
  let geminiProxy;
  
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // Handle WebSocket upgrade requests for Gemini
    if (pathname === '/api/gemini/ws' && req.headers.upgrade === 'websocket') {
      // The WebSocket proxy will handle this
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Handle upgrade requests separately to avoid Next.js interference
  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = parse(request.url, true);
    const { pathname } = parsedUrl;

    // Skip if it's a Gemini WebSocket request - handled by the proxy
    if (pathname === '/api/gemini/ws' && geminiProxy) {
      return;
    }

    // Handle other WebSocket upgrades here if needed
    // For now, just close the socket for unhandled upgrades
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  // Initialize Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IO event handlers
  io.on('connection', (socket) => {
    console.log('New WebSocket connection:', socket.id);

    // Handle authentication
    socket.on(WebSocketEvent.AUTH_REQUEST, async (authPayload) => {
      try {
        // Validate auth token (implement your validation)
        if (!authPayload.token) {
          socket.emit(WebSocketEvent.AUTH_ERROR, { message: 'No token provided' });
          return;
        }

        // Store user info
        socketUsers.set(socket.id, authPayload);
        
        // Track user sockets
        if (!userSockets.has(authPayload.userId)) {
          userSockets.set(authPayload.userId, new Set());
        }
        userSockets.get(authPayload.userId).add(socket.id);

        // Update user presence
        const presence = {
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
    socket.on(WebSocketEvent.ROOM_JOIN, async ({ roomId }) => {
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

        const room = rooms.get(roomId);
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

    socket.on(WebSocketEvent.ROOM_LEAVE, async ({ roomId }) => {
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
    socket.on(WebSocketEvent.PRESENCE_UPDATE, (presence) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      const currentPresence = userPresence.get(user.userId);
      if (currentPresence) {
        const updatedPresence = {
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
    socket.on(WebSocketEvent.DATA_UPDATE, (data) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      const message = {
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
    socket.on(WebSocketEvent.BROADCAST, ({ channel, message }) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      io.emit(WebSocketEvent.BROADCAST, {
        channel,
        message,
        senderId: user.userId,
        timestamp: new Date(),
      });
    });

    // Handle ping/pong
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

  // Initialize Gemini WebSocket proxy after server creation
  try {
    const { initializeGeminiWebSocketProxy } = require('./src/app/api/gemini/websocket-proxy.js');
    geminiProxy = initializeGeminiWebSocketProxy(server);
    console.log('> Gemini WebSocket proxy initialized at /api/gemini/ws');
  } catch (error) {
    console.error('Failed to initialize Gemini WebSocket proxy:', error);
    console.log('> Gemini WebSocket will be handled by Next.js API routes');
  }

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('> WebSocket server initialized');
    if (geminiProxy) {
      console.log('> Gemini WebSocket proxy ready');
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    if (geminiProxy) {
      geminiProxy.close();
    }
    server.close(() => {
      console.log('HTTP server closed');
    });
  });
});

// Helper function to generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}