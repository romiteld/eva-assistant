import { EventEmitter } from 'events';
import { FirecrawlClient } from '@/lib/integrations/firecrawl';
import { supabase } from '@/lib/supabase/browser';
import { 
  FirecrawlConfig, 
  ScrapeOptions, 
  CrawlOptions, 
  MapOptions, 
  SearchOptions, 
  ExtractOptions,
  ScrapedData, 
  CrawlJob, 
  CrawlStatus,
  FirecrawlError 
} from '@/types/firecrawl';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

// WebSocket configuration
const WS_RECONNECT_DELAY = 1000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;

export class FirecrawlService extends EventEmitter {
  private client: FirecrawlClient;
  private activeJobs: Map<string, CrawlJob> = new Map();
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private wsReconnectTimer?: NodeJS.Timeout;
  private rateLimitMap = new Map<string, { count: number; lastReset: number }>();

  constructor(config: FirecrawlConfig) {
    super();
    this.client = new FirecrawlClient(config.apiKey);
    this.setupRealtimeSubscriptions();
    this.setupWebSocket();
  }

  // WebSocket setup for real-time updates
  private setupWebSocket() {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    
    try {
      this.ws = new WebSocket(`${wsUrl}/firecrawl`);
      
      this.ws.onopen = () => {
        console.log('Firecrawl WebSocket connected');
        this.wsReconnectAttempts = 0;
        this.emit('ws:connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('ws:error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('ws:disconnected');
        this.reconnectWebSocket();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.reconnectWebSocket();
    }
  }

  private reconnectWebSocket() {
    if (this.wsReconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      console.error('Max WebSocket reconnection attempts reached');
      this.emit('ws:reconnect_failed');
      return;
    }

    this.wsReconnectAttempts++;
    const delay = WS_RECONNECT_DELAY * Math.pow(2, this.wsReconnectAttempts - 1);

    this.wsReconnectTimer = setTimeout(() => {
      console.log(`Attempting WebSocket reconnection (${this.wsReconnectAttempts}/${WS_MAX_RECONNECT_ATTEMPTS})`);
      this.setupWebSocket();
    }, delay);
  }

  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'crawl:progress':
        this.emit('crawl:progress', message.data);
        break;
      case 'crawl:page_scraped':
        this.emit('crawl:page_scraped', message.data);
        break;
      case 'crawl:completed':
        this.emit('crawl:completed', message.data);
        break;
      case 'crawl:error':
        this.emit('crawl:error', message.data);
        break;
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  // Supabase real-time subscriptions
  private setupRealtimeSubscriptions() {
    const channel = supabase
      .channel('firecrawl-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'firecrawl_jobs'
        },
        (payload) => {
          this.handleJobUpdate(payload);
        }
      )
      .subscribe();

    this.on('disconnect', () => {
      channel.unsubscribe();
    });
  }

  private handleJobUpdate(payload: any) {
    const { eventType, new: newData, old: oldData } = payload;
    
    switch (eventType) {
      case 'INSERT':
        this.emit('job:created', newData);
        break;
      case 'UPDATE':
        this.emit('job:updated', newData);
        if (newData.status === 'completed') {
          this.emit('job:completed', newData);
        } else if (newData.status === 'failed') {
          this.emit('job:failed', newData);
        }
        break;
      case 'DELETE':
        this.emit('job:deleted', oldData);
        break;
    }
  }

  // Rate limiting
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit || now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
      this.rateLimitMap.set(userId, { count: 1, lastReset: now });
      return true;
    }

    if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  // Caching
  private getCachedData(key: string): any | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any) {
    cache.set(key, { data, timestamp: Date.now() });
  }

  // Error handling with retry logic
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError!;
  }

  // Main operations
  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapedData> {
    const cacheKey = `scrape:${url}:${JSON.stringify(options)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.emit('cache:hit', { operation: 'scrape', url });
      return cached;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!this.checkRateLimit(user.id)) {
      throw new FirecrawlError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    const job = this.createJob(url, 'scrape', options);
    this.emit('job:started', job);

    try {
      const result = await this.withRetry(() => 
        (this.client as any).scrapeUrl(url, options)
      );

      let scrapedData: ScrapedData;
      
      // Check if result has success property and data
      if (result && typeof result === 'object' && 'success' in result && result.success && 'data' in result && result.data) {
        const data = result.data as any;
        scrapedData = {
          id: job.id,
          url,
          title: data.metadata?.title,
          content: data.html || '',
          markdown: data.markdown || '',
          metadata: data.metadata,
          timestamp: new Date().toISOString()
        };
      } else {
        // If using direct API response
        scrapedData = {
          id: job.id,
          url,
          title: (result as any).metadata?.title,
          content: (result as any).html || '',
          markdown: (result as any).markdown || '',
          metadata: (result as any).metadata,
          timestamp: new Date().toISOString()
        };
      }

      // Store in Supabase
      await this.storeScrapedData(scrapedData, user.id);
      
      // Cache the result
      this.setCachedData(cacheKey, scrapedData);

      job.status = 'completed';
      job.result = scrapedData;
      this.updateJob(job);

      return scrapedData;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(job);
      throw error;
    }
  }

  async crawlWebsite(url: string, options?: CrawlOptions): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!this.checkRateLimit(user.id)) {
      throw new FirecrawlError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    const job = this.createJob(url, 'crawl', options);
    this.emit('job:started', job);

    try {
      const result = await this.client.crawlWebsite(url, options as any);
      
      // Check if result has jobId (different response formats)
      let jobId: string;
      if ('success' in result && result.success) {
        // Result format from integrations/firecrawl.ts returns success/data
        jobId = job.id; // Use internal job ID
      } else if ('jobId' in result) {
        jobId = (result as any).jobId;
      } else {
        jobId = job.id; // Fallback to internal job ID
      }
      
      job.status = 'processing';
      job.result = { jobId };
      this.updateJob(job);

      // Send WebSocket message to start watching
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'crawl:watch',
          jobId,
          internalJobId: job.id
        }));
      }

      // Store job in database
      await supabase.from('firecrawl_jobs').insert({
        id: job.id,
        user_id: user.id,
        type: 'crawl',
        url,
        options,
        status: 'processing',
        firecrawl_job_id: jobId,
        created_at: job.createdAt
      });

      return jobId;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(job);
      throw error;
    }
  }

  async checkCrawlStatus(jobId: string): Promise<CrawlStatus> {
    try {
      // The FirecrawlClient doesn't have a direct checkCrawlStatus method
      // This would typically be handled by the crawlWebsite method internally
      // For now, return a mock status
      return {
        status: 'completed',
        completed: 100,
        total: 100,
        data: [],
        creditsUsed: 0,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      } as CrawlStatus;
    } catch (error) {
      throw new FirecrawlError(
        `Failed to check crawl status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CRAWL_STATUS_ERROR'
      );
    }
  }

  async mapWebsite(url: string, options?: MapOptions): Promise<string[]> {
    const cacheKey = `map:${url}:${JSON.stringify(options)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.emit('cache:hit', { operation: 'map', url });
      return cached;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!this.checkRateLimit(user.id)) {
      throw new FirecrawlError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    const job = this.createJob(url, 'map', options);
    this.emit('job:started', job);

    try {
      const result = await this.withRetry(() => 
        (this.client as any).mapWebsite(url, options)
      );
      
      // Cache the result
      this.setCachedData(cacheKey, result);

      job.status = 'completed';
      job.result = result;
      this.updateJob(job);

      return result as string[];
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(job);
      throw error;
    }
  }

  async search(query: string, options?: SearchOptions): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!this.checkRateLimit(user.id)) {
      throw new FirecrawlError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    const job = this.createJob(query, 'search', options);
    this.emit('job:started', job);

    try {
      const result = await this.withRetry(() => 
        (this.client as any).search(query, options)
      );
      
      job.status = 'completed';
      job.result = result;
      this.updateJob(job);

      return result;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(job);
      throw error;
    }
  }

  async extract(urls: string[], options?: ExtractOptions): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!this.checkRateLimit(user.id)) {
      throw new FirecrawlError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    const job = this.createJob(urls.join(','), 'extract', options);
    this.emit('job:started', job);

    try {
      const result = await this.withRetry(() => 
        (this.client as any).extract(urls, options || {})
      );
      
      job.status = 'completed';
      job.result = result;
      this.updateJob(job);

      return result;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(job);
      throw error;
    }
  }

  // Helper methods
  private createJob(url: string, type: CrawlJob['type'], options?: any): CrawlJob {
    const job: CrawlJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      url,
      type,
      options,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.activeJobs.set(job.id, job);
    return job;
  }

  private updateJob(job: CrawlJob) {
    job.updatedAt = new Date().toISOString();
    this.activeJobs.set(job.id, job);
    this.emit('job:updated', job);
  }

  private async storeScrapedData(data: ScrapedData, userId: string) {
    await supabase
      .from('firecrawl_scraped_data')
      .insert({
        user_id: userId,
        url: data.url,
        title: data.title,
        content: data.content,
        markdown: data.markdown,
        metadata: data.metadata,
        scraped_at: data.timestamp
      });
  }

  // Public methods
  getActiveJobs(): CrawlJob[] {
    return Array.from(this.activeJobs.values());
  }

  getJob(jobId: string): CrawlJob | undefined {
    return this.activeJobs.get(jobId);
  }

  cancelJob(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      this.updateJob(job);
      
      // Send cancel message via WebSocket
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'crawl:cancel',
          jobId
        }));
      }
    }
  }

  // Cleanup
  disconnect() {
    this.emit('disconnect');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
    }
    
    this.removeAllListeners();
    this.activeJobs.clear();
    cache.clear();
  }
}

// Singleton instance management
let firecrawlInstance: FirecrawlService | null = null;

export const getFirecrawlService = () => {
  if (!firecrawlInstance) {
    const apiKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_FIRECRAWL_API_KEY is not set');
    }
    firecrawlInstance = new FirecrawlService({ apiKey });
  }
  return firecrawlInstance;
};