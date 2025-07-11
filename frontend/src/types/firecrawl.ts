// Firecrawl configuration
export interface FirecrawlConfig {
  apiKey: string;
  baseUrl?: string;
}

// Error types
export class FirecrawlError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FirecrawlError';
  }
}

// Job types
export type JobType = 'scrape' | 'crawl' | 'map' | 'search' | 'extract';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CrawlJob {
  id: string;
  status: JobStatus;
  url: string;
  type: JobType;
  options?: any;
  result?: any;
  error?: string;
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

// Scraped data types
export interface ScrapedData {
  id: string;
  url: string;
  title?: string;
  content: string;
  markdown: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Options types
export interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'screenshot' | 'links')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  timeout?: number;
  headers?: Record<string, string>;
  includeImages?: boolean;
  screenshot?: {
    fullPage?: boolean;
  };
}

export interface CrawlOptions {
  limit?: number;
  maxDepth?: number;
  allowedDomains?: string[];
  excludePaths?: string[];
  includePaths?: string[];
  scrapeOptions?: ScrapeOptions;
  webhook?: string;
  ignoreQueryParameters?: boolean;
  deduplicateSimilarURLs?: boolean;
}

export interface MapOptions {
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
  ignoreSitemap?: boolean;
  sitemapOnly?: boolean;
}

export interface SearchOptions {
  limit?: number;
  scrapeOptions?: ScrapeOptions;
  lang?: string;
  country?: string;
  location?: string;
  tbs?: string; // Time-based search
}

export interface ExtractOptions {
  schema?: Record<string, any>;
  prompt?: string;
  systemPrompt?: string;
  allowExternalLinks?: boolean;
  enableWebSearch?: boolean;
  includeSubdomains?: boolean;
}

// Response types
export interface CrawlStatus {
  status: 'scraping' | 'completed' | 'failed';
  completed: number;
  total: number;
  creditsUsed: number;
  expiresAt: string;
  data?: any[];
  error?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  image?: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  markdown?: string;
  html?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'crawl:progress' | 'crawl:page_scraped' | 'crawl:completed' | 'crawl:error' | 'crawl:watch' | 'crawl:cancel';
  data?: any;
  jobId?: string;
  internalJobId?: string;
}

// API request/response types
export interface FirecrawlAPIRequest {
  action: JobType;
  url?: string;
  urls?: string[];
  query?: string;
  options?: ScrapeOptions | CrawlOptions | MapOptions | SearchOptions | ExtractOptions;
}

export interface FirecrawlAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Rate limiting types
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: number;
}

// Cache types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}