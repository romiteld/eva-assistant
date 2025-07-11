// Firecrawl API Integration with Real-time Streaming
import { EventEmitter } from 'events';
import { CrawlOptions } from '@/types/firecrawl';

const FIRECRAWL_API_KEY = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY || '';
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';

// Real-time event emitter for streaming updates
export const firecrawlEvents = new EventEmitter();

// Types
export interface FirecrawlScrapeOptions {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'extract')[];
  headers?: Record<string, string>;
  includeTags?: string[];
  excludeTags?: string[];
  onlyMainContent?: boolean;
  waitFor?: number;
  timeout?: number;
  extract?: {
    schema: Record<string, any>;
    systemPrompt?: string;
    prompt?: string;
  };
}

export interface FirecrawlCrawlOptions {
  includePaths?: string[];
  excludePaths?: string[];
  maxDepth?: number;
  limit?: number;
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  ignoreSitemap?: boolean;
  scrapeOptions?: FirecrawlScrapeOptions;
}

export interface FirecrawlMapOptions {
  search?: string;
  ignoreSitemap?: boolean;
  includeSubdomains?: boolean;
  limit?: number;
}

export interface FirecrawlSearchOptions {
  limit?: number;
  scrapeOptions?: FirecrawlScrapeOptions;
}

// Stream response handler
async function* streamResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield data;
          } catch (e) {
            // Not JSON, yield as text
            yield { type: 'text', content: line };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Firecrawl Client with real-time streaming
export class FirecrawlClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || FIRECRAWL_API_KEY;
    this.baseUrl = FIRECRAWL_BASE_URL;
  }

  // Scrape a single URL with streaming
  async *scrapeStream(url: string, options?: FirecrawlScrapeOptions) {
    firecrawlEvents.emit('scrape:start', { url, options });

    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      firecrawlEvents.emit('scrape:error', { url, error });
      throw new Error(error.message || 'Scrape failed');
    }

    const data = await response.json();
    firecrawlEvents.emit('scrape:complete', { url, data });
    yield data;
  }

  // Crawl website with real-time updates
  async *crawlStream(url: string, options?: FirecrawlCrawlOptions) {
    firecrawlEvents.emit('crawl:start', { url, options });

    // Start crawl job
    const startResponse = await fetch(`${this.baseUrl}/crawl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, ...options }),
    });

    if (!startResponse.ok) {
      const error = await startResponse.json();
      firecrawlEvents.emit('crawl:error', { url, error });
      throw new Error(error.message || 'Crawl failed');
    }

    const { id: jobId } = await startResponse.json();
    firecrawlEvents.emit('crawl:jobCreated', { url, jobId });

    // Poll for results
    while (true) {
      const statusResponse = await fetch(`${this.baseUrl}/crawl/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const status = await statusResponse.json();
      
      if (status.status === 'completed') {
        firecrawlEvents.emit('crawl:complete', { url, jobId, data: status.data });
        yield* status.data;
        break;
      } else if (status.status === 'failed') {
        firecrawlEvents.emit('crawl:failed', { url, jobId, error: status.error });
        throw new Error(status.error || 'Crawl failed');
      } else {
        firecrawlEvents.emit('crawl:progress', { 
          url, 
          jobId, 
          progress: status.completed || 0,
          total: status.total || 0 
        });
        yield { type: 'progress', ...status };
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Map website URLs
  async map(url: string, options?: FirecrawlMapOptions): Promise<string[]> {
    firecrawlEvents.emit('map:start', { url, options });

    const response = await fetch(`${this.baseUrl}/map`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      firecrawlEvents.emit('map:error', { url, error });
      throw new Error(error.message || 'Map failed');
    }

    const { links } = await response.json();
    firecrawlEvents.emit('map:complete', { url, links });
    return links;
  }

  // Search with streaming results
  async *searchStream(query: string, options?: FirecrawlSearchOptions) {
    firecrawlEvents.emit('search:start', { query, options });

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      firecrawlEvents.emit('search:error', { query, error });
      throw new Error(error.message || 'Search failed');
    }

    const { data } = await response.json();
    
    for (const result of data) {
      firecrawlEvents.emit('search:result', { query, result });
      yield result;
    }
    
    firecrawlEvents.emit('search:complete', { query, count: data.length });
  }

  // Extract structured data
  async extract(urls: string[], schema: Record<string, any>, options?: {
    systemPrompt?: string;
    prompt?: string;
  }) {
    firecrawlEvents.emit('extract:start', { urls, schema });

    const response = await fetch(`${this.baseUrl}/extract`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        urls, 
        extract: { schema, ...options }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      firecrawlEvents.emit('extract:error', { urls, error });
      throw new Error(error.message || 'Extract failed');
    }

    const data = await response.json();
    firecrawlEvents.emit('extract:complete', { urls, data });
    return data;
  }
}

// Enhanced methods for WebSocket real-time updates
export class EnhancedFirecrawlClient extends FirecrawlClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private crawlJobsMap: Map<string, string> = new Map(); // Maps internal jobId to Firecrawl jobId

  constructor(apiKey?: string, wsUrl?: string) {
    super(apiKey);
    this.wsUrl = wsUrl || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
  }

  // Initialize WebSocket connection for real-time updates
  connectWebSocket() {
    try {
      this.ws = new WebSocket(`${this.wsUrl}/firecrawl`);
      
      this.ws.onopen = () => {
        console.log('Firecrawl WebSocket connected');
        firecrawlEvents.emit('ws:connected');
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
        firecrawlEvents.emit('ws:error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        firecrawlEvents.emit('ws:disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'crawl:progress':
        firecrawlEvents.emit('crawl:progress', message.data);
        break;
      case 'crawl:page_scraped':
        firecrawlEvents.emit('crawl:page_scraped', message.data);
        break;
      case 'crawl:completed':
        firecrawlEvents.emit('crawl:completed', message.data);
        break;
      case 'crawl:error':
        firecrawlEvents.emit('crawl:error', message.data);
        break;
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  // Enhanced crawl with WebSocket monitoring
  async crawlUrlAndWatch(url: string, options?: CrawlOptions, onUpdate?: (data: any) => void): Promise<string> {
    // Start crawl using the stream method
    const crawlGenerator = this.crawlStream(url, options);
    let result = { jobId: '' };
    
    // Get the first result which should contain the job ID
    for await (const data of crawlGenerator) {
      if (data.type === 'progress' && data.jobId) {
        result.jobId = data.jobId;
        break;
      }
    }
    const jobId = result.jobId;
    const internalJobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.crawlJobsMap.set(internalJobId, jobId);
    
    // Send WebSocket message to start watching
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'crawl:watch',
        jobId,
        internalJobId
      }));
    }
    
    // Set up event listeners for this specific job
    if (onUpdate) {
      const progressHandler = (data: any) => {
        if (data.jobId === jobId || data.internalJobId === internalJobId) {
          onUpdate({ type: 'progress', ...data });
        }
      };
      
      const completeHandler = (data: any) => {
        if (data.jobId === jobId || data.internalJobId === internalJobId) {
          onUpdate({ type: 'completed', ...data });
          // Clean up listeners
          firecrawlEvents.off('crawl:progress', progressHandler);
          firecrawlEvents.off('crawl:completed', completeHandler);
          firecrawlEvents.off('crawl:error', errorHandler);
        }
      };
      
      const errorHandler = (data: any) => {
        if (data.jobId === jobId || data.internalJobId === internalJobId) {
          onUpdate({ type: 'error', ...data });
          // Clean up listeners
          firecrawlEvents.off('crawl:progress', progressHandler);
          firecrawlEvents.off('crawl:completed', completeHandler);
          firecrawlEvents.off('crawl:error', errorHandler);
        }
      };
      
      firecrawlEvents.on('crawl:progress', progressHandler);
      firecrawlEvents.on('crawl:completed', completeHandler);
      firecrawlEvents.on('crawl:error', errorHandler);
    }
    
    return jobId;
  }

  // Cancel a crawl job
  cancelCrawl(jobId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'crawl:cancel',
        jobId
      }));
    }
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.crawlJobsMap.clear();
  }
}

// Export singleton instance
export const firecrawl = new FirecrawlClient();

// Export enhanced client for WebSocket support
export const enhancedFirecrawl = new EnhancedFirecrawlClient();