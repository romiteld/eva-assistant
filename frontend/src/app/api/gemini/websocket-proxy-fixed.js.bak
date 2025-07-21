// Fixed WebSocket proxy for Gemini Live API
const WebSocket = require('ws');

class GeminiWebSocketProxy {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/api/gemini/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.connections = new Map();
    this.wss.on('connection', this.handleConnection.bind(this));

    // Heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log('[GeminiProxy] WebSocket proxy initialized');
  }

  async verifyClient(info, cb) {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        cb(false, 401, 'Unauthorized');
        return;
      }

      // Basic token validation (you should verify with your auth system)
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      if (decoded.exp < Date.now()) {
        cb(false, 401, 'Token expired');
        return;
      }

      cb(true);
    } catch (error) {
      console.error('[GeminiProxy] Verification error:', error);
      cb(false, 500, 'Internal server error');
    }
  }

  async handleConnection(ws, request) {
    console.log('[GeminiProxy] New client connection');
    
    try {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      const model = url.searchParams.get('model') || 'gemini-2.0-flash-exp';
      
      // Decode user info from token
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      ws.userId = decoded.userId;

      // Connect to Gemini Live API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        ws.send(JSON.stringify({ error: 'Server configuration error' }));
        ws.close(1011, 'Server configuration error');
        return;
      }

      // Use the correct Gemini Live API endpoint
      // Remove 'models/' prefix if present
      const modelName = model.startsWith('models/') ? model.substring(7) : model;
      const geminiUrl = `wss://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?alt=sse&key=${apiKey}`;
      console.log(`[GeminiProxy] Connecting to Gemini: ${modelName}`);
      
      const geminiWs = new WebSocket(geminiUrl, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const connectionId = `${ws.userId}-${Date.now()}`;
      this.connections.set(connectionId, { client: ws, gemini: geminiWs });

      // Handle Gemini connection
      geminiWs.on('open', () => {
        console.log('[GeminiProxy] Connected to Gemini Live API');
        ws.send(JSON.stringify({ 
          type: 'connection_established',
          message: 'Connected to Gemini Live API'
        }));
      });

      // Relay messages from client to Gemini
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[GeminiProxy] Client message type:', message.type || message.setup ? 'setup' : 'unknown');
          
          if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify(message));
          } else {
            console.error('[GeminiProxy] Gemini WebSocket not open, state:', geminiWs.readyState);
            ws.send(JSON.stringify({ error: 'Gemini connection not ready' }));
          }
        } catch (error) {
          console.error('[GeminiProxy] Error parsing client message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      // Relay messages from Gemini to client
      geminiWs.on('message', (data) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString());
          }
        } catch (error) {
          console.error('[GeminiProxy] Error forwarding Gemini message:', error);
        }
      });

      // Handle Gemini errors
      geminiWs.on('error', (error) => {
        console.error('[GeminiProxy] Gemini WebSocket error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            error: 'Gemini connection error',
            details: error.message 
          }));
          ws.close(1011, 'Gemini connection error');
        }
      });

      // Handle Gemini close
      geminiWs.on('close', (code, reason) => {
        console.log(`[GeminiProxy] Gemini closed: ${code} - ${reason}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Gemini connection closed');
        }
        this.connections.delete(connectionId);
      });

      // Handle client close
      ws.on('close', (code, reason) => {
        console.log(`[GeminiProxy] Client closed: ${code} - ${reason}`);
        if (geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.close();
        }
        this.connections.delete(connectionId);
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error('[GeminiProxy] Client WebSocket error:', error);
        if (geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.close();
        }
        this.connections.delete(connectionId);
      });

    } catch (error) {
      console.error('[GeminiProxy] Connection error:', error);
      ws.send(JSON.stringify({ error: 'Connection failed' }));
      ws.close(1011, 'Internal server error');
    }
  }

  close() {
    clearInterval(this.heartbeatInterval);
    
    // Close all connections
    this.connections.forEach(({ client, gemini }) => {
      if (client.readyState === WebSocket.OPEN) client.close();
      if (gemini.readyState === WebSocket.OPEN) gemini.close();
    });
    this.connections.clear();
    
    // Close the server
    this.wss.close(() => {
      console.log('[GeminiProxy] WebSocket proxy closed');
    });
  }
}

// Export initialization function
function initializeGeminiWebSocketProxy(server) {
  return new GeminiWebSocketProxy(server);
}

module.exports = { initializeGeminiWebSocketProxy };
