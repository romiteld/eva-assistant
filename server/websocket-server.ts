// Real-time WebSocket Server with Socket.io
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebRTCSignalingServer } from './webrtc-signaling';
import { StreamManager } from './stream-manager';
import { CollaborationManager } from './collaboration-manager';
import { VoiceAgentManager } from './voice-agent-manager';
import { FirecrawlWatcher } from './firecrawl-watcher';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Create HTTP server
const httpServer = createServer();

// Socket.io configuration with namespaces
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e6 // 10MB for file uploads
});

// Managers for different features
const streamManager = new StreamManager(io, supabase, genAI);
const webrtcSignaling = new WebRTCSignalingServer(io);
const collaborationManager = new CollaborationManager(io, supabase);
const voiceAgentManager = new VoiceAgentManager(io, genAI);
const firecrawlWatcher = new FirecrawlWatcher(io, supabase);

// Authentication middleware
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Invalid token'));
    }

    // Attach user to socket
    socket.data.user = user;
    socket.data.userId = user.id;
    
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Main namespace for general communication
io.on('connection', async (socket: Socket) => {
  const userId = socket.data.userId;
  const sessionId = socket.id;
  
  console.log(`User ${userId} connected with session ${sessionId}`);

  // Log connection
  await supabase.from('websocket_connections').insert({
    user_id: userId,
    session_id: sessionId,
    connected_at: new Date().toISOString(),
    status: 'connected',
    metadata: {
      transport: socket.conn.transport.name,
      address: socket.handshake.address
    }
  });

  // Join user-specific room
  socket.join(`user:${userId}`);

  // Handle disconnection
  socket.on('disconnect', async (reason) => {
    console.log(`User ${userId} disconnected: ${reason}`);
    
    await supabase
      .from('websocket_connections')
      .update({
        status: 'disconnected',
        disconnected_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    // Clean up managers
    streamManager.handleDisconnect(socket);
    webrtcSignaling.handleDisconnect(socket);
    collaborationManager.handleDisconnect(socket);
    voiceAgentManager.handleDisconnect(socket);
  });

  // Heartbeat for connection monitoring
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// AI Streaming namespace
const aiNamespace = io.of('/ai-stream');
aiNamespace.on('connection', (socket: Socket) => {
  streamManager.handleConnection(socket);
});

// WebRTC namespace for video/screen sharing
const rtcNamespace = io.of('/webrtc');
rtcNamespace.on('connection', (socket: Socket) => {
  webrtcSignaling.handleConnection(socket);
});

// Collaboration namespace
const collabNamespace = io.of('/collaboration');
collabNamespace.on('connection', (socket: Socket) => {
  collaborationManager.handleConnection(socket);
});

// Voice agent namespace
const voiceNamespace = io.of('/voice');
voiceNamespace.on('connection', (socket: Socket) => {
  voiceAgentManager.handleConnection(socket);
});

// Firecrawl monitoring namespace
const firecrawlNamespace = io.of('/firecrawl');
firecrawlNamespace.on('connection', (socket: Socket) => {
  firecrawlWatcher.handleConnection(socket);
});

// Error handling
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err.req, err.code, err.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  
  // Close all connections
  await io.close();
  
  // Cleanup managers
  await streamManager.cleanup();
  await voiceAgentManager.cleanup();
  await firecrawlWatcher.cleanup();
  
  process.exit(0);
});

// Start server
const PORT = process.env.WEBSOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Export for testing
export { io, httpServer };