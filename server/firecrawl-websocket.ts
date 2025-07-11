import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { createClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '@mendable/firecrawl-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

// Types
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated: boolean;
  watchedJobs: Set<string>;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Job monitoring
const activeJobs = new Map<string, {
  jobId: string;
  internalJobId: string;
  url: string;
  watchers: Set<AuthenticatedWebSocket>;
  interval?: NodeJS.Timeout;
}>();

export class FirecrawlWebSocketServer {
  private wss: WebSocketServer;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.wss = new WebSocketServer({ 
      port,
      path: '/firecrawl',
      verifyClient: this.verifyClient.bind(this)
    });

    this.setupWebSocketServer();
  }

  private async verifyClient(
    info: { origin: string; req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void
  ) {
    // In production, verify the origin
    const allowedOrigins = [
      'http://localhost:3000',
      'https://eva-assistant.vercel.app',
      process.env.NEXT_PUBLIC_APP_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(info.origin)) {
      callback(true);
    } else {
      callback(false, 403, 'Forbidden');
    }
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      console.log('New WebSocket connection');
      
      ws.isAuthenticated = false;
      ws.watchedJobs = new Set();

      // Set up ping/pong for connection health
      ws.on('pong', () => {
        // Connection is alive
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Failed to handle message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.cleanupConnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.cleanupConnection(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Firecrawl WebSocket server',
        requiresAuth: true
      }));
    });

    // Heartbeat interval
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          return ws.terminate();
        }
        
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log(`Firecrawl WebSocket server running on port ${this.port}`);
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    // Handle authentication
    if (message.type === 'auth') {
      await this.handleAuth(ws, message.token);
      return;
    }

    // Require authentication for all other messages
    if (!ws.isAuthenticated) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Authentication required'
      }));
      return;
    }

    switch (message.type) {
      case 'crawl:watch':
        await this.handleCrawlWatch(ws, message);
        break;
      
      case 'crawl:cancel':
        await this.handleCrawlCancel(ws, message);
        break;
      
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        }));
    }
  }

  private async handleAuth(ws: AuthenticatedWebSocket, token: string) {
    try {
      // Verify the token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        ws.send(JSON.stringify({
          type: 'auth:error',
          message: 'Invalid authentication token'
        }));
        return;
      }

      ws.userId = user.id;
      ws.isAuthenticated = true;

      ws.send(JSON.stringify({
        type: 'auth:success',
        userId: user.id
      }));
    } catch (error) {
      console.error('Authentication error:', error);
      ws.send(JSON.stringify({
        type: 'auth:error',
        message: 'Authentication failed'
      }));
    }
  }

  private async handleCrawlWatch(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { jobId, internalJobId, url } = message;

    if (!jobId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Job ID is required'
      }));
      return;
    }

    // Check if job is already being monitored
    let job = activeJobs.get(jobId);
    
    if (!job) {
      // Create new job monitor
      job = {
        jobId,
        internalJobId: internalJobId || jobId,
        url: url || '',
        watchers: new Set([ws])
      };
      
      activeJobs.set(jobId, job);
      
      // Start monitoring
      this.startJobMonitoring(jobId);
    } else {
      // Add this connection to watchers
      job.watchers.add(ws);
    }

    ws.watchedJobs.add(jobId);

    ws.send(JSON.stringify({
      type: 'crawl:watching',
      jobId,
      internalJobId
    }));
  }

  private async handleCrawlCancel(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { jobId } = message;

    if (!jobId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Job ID is required'
      }));
      return;
    }

    // Cancel the job with Firecrawl
    try {
      // Note: Firecrawl SDK doesn't expose cancel method yet
      // This would be the API call to cancel
      console.log(`Cancelling job: ${jobId}`);
      
      // Notify all watchers
      const job = activeJobs.get(jobId);
      if (job) {
        this.broadcastToWatchers(jobId, {
          type: 'crawl:cancelled',
          jobId
        });
        
        // Clean up
        this.cleanupJob(jobId);
      }

      ws.send(JSON.stringify({
        type: 'crawl:cancel:success',
        jobId
      }));
    } catch (error) {
      console.error('Failed to cancel job:', error);
      ws.send(JSON.stringify({
        type: 'crawl:cancel:error',
        jobId,
        error: error instanceof Error ? error.message : 'Failed to cancel job'
      }));
    }
  }

  private async startJobMonitoring(jobId: string) {
    const job = activeJobs.get(jobId);
    if (!job) return;

    const checkStatus = async () => {
      try {
        const status = await firecrawl.checkCrawlStatus(jobId);
        
        // Broadcast progress to all watchers
        this.broadcastToWatchers(jobId, {
          type: 'crawl:progress',
          jobId,
          internalJobId: job.internalJobId,
          status: status.status,
          progress: status.current || 0,
          total: status.total || 0,
          creditsUsed: status.creditsUsed || 0
        });

        // Handle completion
        if (status.status === 'completed') {
          this.broadcastToWatchers(jobId, {
            type: 'crawl:completed',
            jobId,
            internalJobId: job.internalJobId,
            data: status.data,
            totalPages: status.total,
            creditsUsed: status.creditsUsed
          });
          
          // Store results in Supabase
          if (status.data && status.data.length > 0) {
            await this.storeCrawlResults(jobId, status.data);
          }
          
          // Clean up
          this.cleanupJob(jobId);
        } else if (status.status === 'failed') {
          this.broadcastToWatchers(jobId, {
            type: 'crawl:error',
            jobId,
            internalJobId: job.internalJobId,
            error: status.error || 'Crawl failed'
          });
          
          // Clean up
          this.cleanupJob(jobId);
        }
      } catch (error) {
        console.error(`Error checking status for job ${jobId}:`, error);
        this.broadcastToWatchers(jobId, {
          type: 'crawl:error',
          jobId,
          internalJobId: job.internalJobId,
          error: error instanceof Error ? error.message : 'Status check failed'
        });
        
        // Clean up on error
        this.cleanupJob(jobId);
      }
    };

    // Check immediately
    checkStatus();
    
    // Then check every 2 seconds
    job.interval = setInterval(checkStatus, 2000);
  }

  private broadcastToWatchers(jobId: string, message: any) {
    const job = activeJobs.get(jobId);
    if (!job) return;

    const messageStr = JSON.stringify(message);
    
    job.watchers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  private cleanupJob(jobId: string) {
    const job = activeJobs.get(jobId);
    if (!job) return;

    // Clear interval
    if (job.interval) {
      clearInterval(job.interval);
    }

    // Remove job from all watchers
    job.watchers.forEach((ws) => {
      ws.watchedJobs.delete(jobId);
    });

    // Remove job from active jobs
    activeJobs.delete(jobId);
  }

  private cleanupConnection(ws: AuthenticatedWebSocket) {
    // Remove this connection from all watched jobs
    ws.watchedJobs.forEach((jobId) => {
      const job = activeJobs.get(jobId);
      if (job) {
        job.watchers.delete(ws);
        
        // If no more watchers, clean up the job
        if (job.watchers.size === 0) {
          this.cleanupJob(jobId);
        }
      }
    });
  }

  private async storeCrawlResults(jobId: string, documents: any[]) {
    try {
      // Store crawl results in Supabase
      const records = documents.map(doc => ({
        job_id: jobId,
        url: doc.url,
        title: doc.metadata?.title,
        content: doc.html || doc.content,
        markdown: doc.markdown,
        metadata: doc.metadata,
        scraped_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('firecrawl_crawl_results')
        .insert(records);

      if (error) {
        console.error('Failed to store crawl results:', error);
      }
    } catch (error) {
      console.error('Error storing crawl results:', error);
    }
  }

  public close() {
    // Clean up all jobs
    activeJobs.forEach((job, jobId) => {
      this.cleanupJob(jobId);
    });

    // Close WebSocket server
    this.wss.close();
  }
}

// Export function to create server
export function createFirecrawlWebSocketServer(port?: number) {
  return new FirecrawlWebSocketServer(port);
}

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.WS_PORT || '3001', 10);
  createFirecrawlWebSocketServer(port);
}