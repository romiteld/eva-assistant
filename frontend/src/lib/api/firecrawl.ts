import { 
  ScrapeOptions, 
  CrawlOptions, 
  MapOptions, 
  SearchOptions, 
  ExtractOptions,
  FirecrawlAPIResponse,
  ScrapedData,
  CrawlStatus,
  SearchResult
} from '@/types/firecrawl';

// Base API client for Firecrawl endpoints
class FirecrawlAPIClient {
  private baseUrl: string;
  private csrfToken: string | null = null;

  constructor() {
    this.baseUrl = '/api/firecrawl';
  }

  // Get CSRF token
  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;

    try {
      const response = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get CSRF token');
      }

      const data = await response.json();
      this.csrfToken = data.token;
      return this.csrfToken || '';
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      throw error;
    }
  }

  // Make authenticated request
  private async request<T>(
    endpoint: string,
    method: string = 'POST',
    body?: any
  ): Promise<FirecrawlAPIResponse<T>> {
    const csrfToken = await this.getCsrfToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  // Scrape a URL
  async scrape(url: string, options?: ScrapeOptions): Promise<ScrapedData> {
    const response = await this.request<ScrapedData>('/scrape', 'POST', {
      url,
      options,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Scrape failed');
    }

    return response.data;
  }

  // Start a crawl job
  async crawl(url: string, options?: CrawlOptions): Promise<string> {
    const response = await this.request<{ jobId: string }>('/crawl', 'POST', {
      url,
      options,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Crawl failed');
    }

    return response.data.jobId;
  }

  // Check crawl status
  async checkCrawlStatus(jobId: string): Promise<CrawlStatus> {
    const response = await this.request<CrawlStatus>(
      `/crawl?jobId=${encodeURIComponent(jobId)}`,
      'GET'
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get crawl status');
    }

    return response.data;
  }

  // Map a website
  async map(url: string, options?: MapOptions): Promise<{ urls: string[]; count: number }> {
    const response = await this.request<{ urls: string[]; count: number }>('/map', 'POST', {
      url,
      options,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Map failed');
    }

    return response.data;
  }

  // Search the web
  async search(query: string, options?: SearchOptions): Promise<{ 
    results: SearchResult[]; 
    count: number; 
    query: string 
  }> {
    const response = await this.request<{ 
      results: SearchResult[]; 
      count: number; 
      query: string 
    }>('/search', 'POST', {
      query,
      options,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Search failed');
    }

    return response.data;
  }

  // Extract structured data
  async extract(urls: string[], options?: ExtractOptions): Promise<any> {
    const response = await this.request<any>('/extract', 'POST', {
      urls,
      options,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Extract failed');
    }

    return response.data;
  }

  // Get WebSocket connection info
  async getWebSocketInfo(): Promise<any> {
    const response = await this.request<any>('/websocket', 'GET');

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get WebSocket info');
    }

    return response.data;
  }
}

// Export singleton instance
export const firecrawlAPI = new FirecrawlAPIClient();

// Helper function to handle errors
export function handleFirecrawlError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  return 'An unexpected error occurred';
}

// Helper function to retry failed requests
export async function withRetry<T>(
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
      
      // Don't retry on client errors (4xx)
      if (error instanceof Error && error.message.includes('4')) {
        throw error;
      }
      
      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
}