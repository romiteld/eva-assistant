// Secure Firecrawl Client - Uses server-side API endpoints
import { EventEmitter } from 'events';

// Real-time event emitter for streaming updates
export const firecrawlEvents = new EventEmitter();

// Types (same as before)
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

// Secure Firecrawl Client - Routes all requests through server-side API
export class SecureFirecrawlClient {
  private csrfToken: string | null = null;

  constructor() {
    this.initializeCSRFToken();
  }

  private async initializeCSRFToken() {
    try {
      const response = await fetch('/api/csrf');
      const data = await response.json();
      this.csrfToken = data.csrfToken;
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
  }

  private async makeSecureRequest(action: string, params: any) {
    if (!this.csrfToken) {
      await this.initializeCSRFToken();
    }

    const response = await fetch('/api/firecrawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': this.csrfToken || '',
      },
      body: JSON.stringify({ action, ...params }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    const result = await response.json();
    return result.data;
  }

  // Scrape a single URL
  async scrape(url: string, options?: FirecrawlScrapeOptions) {
    firecrawlEvents.emit('scrape:start', { url, options });

    try {
      const data = await this.makeSecureRequest('scrape', { url, ...options });
      firecrawlEvents.emit('scrape:complete', { url, data });
      return data;
    } catch (error) {
      firecrawlEvents.emit('scrape:error', { url, error });
      throw error;
    }
  }

  // Crawl website
  async crawl(url: string, options?: FirecrawlCrawlOptions) {
    firecrawlEvents.emit('crawl:start', { url, options });

    try {
      const data = await this.makeSecureRequest('crawl', { url, ...options });
      firecrawlEvents.emit('crawl:complete', { url, data });
      return data;
    } catch (error) {
      firecrawlEvents.emit('crawl:error', { url, error });
      throw error;
    }
  }

  // Map website URLs
  async map(url: string, options?: FirecrawlMapOptions) {
    firecrawlEvents.emit('map:start', { url, options });

    try {
      const data = await this.makeSecureRequest('map', { url, ...options });
      firecrawlEvents.emit('map:complete', { url, links: data });
      return data;
    } catch (error) {
      firecrawlEvents.emit('map:error', { url, error });
      throw error;
    }
  }

  // Search
  async search(query: string, options?: FirecrawlSearchOptions) {
    firecrawlEvents.emit('search:start', { query, options });

    try {
      const data = await this.makeSecureRequest('search', { query, ...options });
      firecrawlEvents.emit('search:complete', { query, data });
      return data;
    } catch (error) {
      firecrawlEvents.emit('search:error', { query, error });
      throw error;
    }
  }

  // Extract structured data
  async extract(urls: string[], schema: Record<string, any>, options?: {
    systemPrompt?: string;
    prompt?: string;
  }) {
    firecrawlEvents.emit('extract:start', { urls, schema });

    try {
      const data = await this.makeSecureRequest('extract', { 
        urls, 
        schema,
        ...options
      });
      firecrawlEvents.emit('extract:complete', { urls, data });
      return data;
    } catch (error) {
      firecrawlEvents.emit('extract:error', { urls, error });
      throw error;
    }
  }
}

// Export singleton instance
export const secureFirecrawl = new SecureFirecrawlClient();