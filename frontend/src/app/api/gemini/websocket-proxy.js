const { WebSocketServer } = require('ws');

// Create a WebSocket proxy handler for Gemini Live API
class GeminiWebSocketProxy {
  constructor(server) {
    this.connections = new Map();
    
    this.wss = new WebSocketServer({ 
      noServer: true,
      path: '/api/gemini/ws',
    });

    // Handle upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const { pathname } = require('url').parse(request.url);
      
      if (pathname === '/api/gemini/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));

    // Heartbeat to keep connections alive
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  async handleConnection(ws, request) {
    try {
      // Extract auth token from query params
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.send(JSON.stringify({ error: 'Authentication required' }));
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify the token
      const userId = await this.verifyToken(token);
      if (!userId) {
        ws.send(JSON.stringify({ error: 'Invalid token' }));
        ws.close(1008, 'Invalid token');
        return;
      }

      ws.userId = userId;
      ws.isAlive = true;

      // Set up heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Get model from query params
      const model = url.searchParams.get('model') || 'gemini-2.0-flash-exp';
      
      // Connect to Gemini Live API
      const { WebSocket } = require('ws');
      const geminiWs = await this.connectToGemini(model, WebSocket);

      // Store the connection pair
      const connectionId = `${userId}-${Date.now()}`;
      this.connections.set(connectionId, { client: ws, gemini: geminiWs });

      // Handle messages from client
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Add authentication to outgoing messages if needed
          if (message.type === 'setup' && message.setup) {
            // Ensure the API key is included in the setup
            message.setup.apiKey = process.env.GEMINI_API_KEY;
          }

          // Forward to Gemini
          geminiWs.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error forwarding message to Gemini:', error);
          ws.send(JSON.stringify({ error: 'Failed to process message' }));
        }
      });

      // Handle messages from Gemini
      geminiWs.on('message', (data) => {
        try {
          // Forward to client
          ws.send(data);
        } catch (error) {
          console.error('Error forwarding message from Gemini:', error);
        }
      });

      // Handle Gemini connection errors
      geminiWs.on('error', (error) => {
        console.error('Gemini WebSocket error:', error);
        ws.send(JSON.stringify({ error: 'Gemini connection error' }));
        ws.close(1011, 'Gemini connection error');
      });

      // Handle Gemini connection close
      geminiWs.on('close', () => {
        ws.close(1000, 'Gemini connection closed');
        this.connections.delete(connectionId);
      });

      // Handle client disconnect
      ws.on('close', () => {
        geminiWs.close();
        this.connections.delete(connectionId);
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error('Client WebSocket error:', error);
        geminiWs.close();
        this.connections.delete(connectionId);
      });

      // Send initial success message
      ws.send(JSON.stringify({ 
        type: 'connection_established',
        userId,
        message: 'Connected to Gemini Live API proxy'
      }));

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.send(JSON.stringify({ error: 'Connection failed' }));
      ws.close(1011, 'Internal server error');
    }
  }

  async connectToGemini(model = 'gemini-2.0-flash-exp', WebSocket) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Remove 'models/' prefix if present
    const modelName = model.startsWith('models/') ? model.substring(7) : model;
    
    // Construct the correct Gemini Live API URL
    const geminiUrl = `wss://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
    
    console.log('Connecting to Gemini Live API:', geminiUrl);
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(geminiUrl, {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      ws.once('open', () => {
        console.log('Connected to Gemini Live API');
        resolve(ws);
      });

      ws.once('error', (error) => {
        console.error('Gemini WebSocket connection error:', error);
        reject(error);
      });
    });
  }

  async verifyToken(token) {
    try {
      // Decode the token
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check expiry
      if (decoded.exp < Date.now()) {
        return null;
      }

      // Verify purpose
      if (decoded.purpose !== 'gemini-live') {
        return null;
      }

      return decoded.userId;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  close() {
    // Close all connections
    this.connections.forEach(({ client, gemini }) => {
      client.close();
      gemini.close();
    });
    this.connections.clear();
    
    // Close the server
    this.wss.close();
  }
}

// Export a function to initialize the WebSocket proxy
function initializeGeminiWebSocketProxy(server) {
  return new GeminiWebSocketProxy(server);
}

module.exports = { initializeGeminiWebSocketProxy };