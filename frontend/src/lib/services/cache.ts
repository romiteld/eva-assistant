import { LRUCache } from 'lru-cache';

export interface CacheConfig {
  max?: number; // Maximum number of items
  ttl?: number; // Time to live in milliseconds
  updateAgeOnGet?: boolean; // Reset TTL on get
  allowStale?: boolean; // Return stale items while fetching
  namespace?: string; // Cache namespace
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  metadata?: Record<string, any>;
}

export class CacheService<T = any> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private namespace: string;
  private pendingFetches: Map<string, Promise<T>>;

  constructor(config: CacheConfig = {}) {
    this.namespace = config.namespace || 'default';
    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: config.max || 1000,
      ttl: config.ttl || 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: config.updateAgeOnGet ?? true,
      allowStale: config.allowStale ?? true,
    });
    this.pendingFetches = new Map();
  }

  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  public get(key: string): T | undefined {
    const fullKey = this.getKey(key);
    const entry = this.cache.get(fullKey);
    return entry?.value;
  }

  public set(
    key: string, 
    value: T, 
    options?: { 
      ttl?: number; 
      etag?: string; 
      metadata?: Record<string, any> 
    }
  ): void {
    const fullKey = this.getKey(key);
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: options?.ttl || this.cache.ttl,
      etag: options?.etag,
      metadata: options?.metadata,
    };
    this.cache.set(fullKey, entry);
  }

  public has(key: string): boolean {
    const fullKey = this.getKey(key);
    return this.cache.has(fullKey);
  }

  public delete(key: string): boolean {
    const fullKey = this.getKey(key);
    return this.cache.delete(fullKey);
  }

  public clear(): void {
    this.cache.clear();
  }

  public getEntry(key: string): CacheEntry<T> | undefined {
    const fullKey = this.getKey(key);
    return this.cache.get(fullKey);
  }

  public isStale(key: string): boolean {
    const entry = this.getEntry(key);
    if (!entry) return true;
    
    const age = Date.now() - entry.timestamp;
    return age > entry.ttl;
  }

  // Get with automatic fetching if not in cache
  public async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    options?: { 
      ttl?: number; 
      force?: boolean;
      staleWhileRevalidate?: boolean;
    }
  ): Promise<T> {
    const fullKey = this.getKey(key);

    // If not forcing and we have a valid cached value, return it
    if (!options?.force && this.has(key) && !this.isStale(key)) {
      return this.get(key)!;
    }

    // If stale-while-revalidate is enabled and we have a stale value
    if (options?.staleWhileRevalidate && this.has(key)) {
      // Return stale value immediately
      const staleValue = this.get(key)!;
      
      // Revalidate in the background if not already fetching
      if (!this.pendingFetches.has(fullKey)) {
        this.pendingFetches.set(fullKey, 
          fetcher()
            .then(value => {
              this.set(key, value, { ttl: options.ttl });
              this.pendingFetches.delete(fullKey);
              return value;
            })
            .catch(error => {
              this.pendingFetches.delete(fullKey);
              throw error;
            })
        );
      }
      
      return staleValue;
    }

    // Check if we're already fetching this key
    const pendingFetch = this.pendingFetches.get(fullKey);
    if (pendingFetch) {
      return pendingFetch;
    }

    // Fetch new value
    const fetchPromise = fetcher()
      .then(value => {
        this.set(key, value, { ttl: options?.ttl });
        this.pendingFetches.delete(fullKey);
        return value;
      })
      .catch(error => {
        this.pendingFetches.delete(fullKey);
        throw error;
      });

    this.pendingFetches.set(fullKey, fetchPromise);
    return fetchPromise;
  }

  // Batch get multiple keys
  public getMany(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  // Batch set multiple key-value pairs
  public setMany(entries: Array<[string, T, CacheEntry<T>?]>): void {
    for (const [key, value, options] of entries) {
      this.set(key, value, options);
    }
  }

  // Get cache statistics
  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    keys: string[];
  } {
    const keys = Array.from(this.cache.keys()).map(key => 
      key.replace(`${this.namespace}:`, '')
    );
    
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this.cache.calculatedSize || 0,
      keys,
    };
  }

  // Prune stale entries
  public prune(): number {
    let pruned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        pruned++;
      }
    }
    
    return pruned;
  }
}

// Pre-configured cache instances for different use cases
export const caches = {
  // Firecrawl scrape results cache - 5 minutes TTL
  firecrawlScrape: new CacheService({
    namespace: 'firecrawl:scrape',
    max: 1000,
    ttl: 5 * 60 * 1000,
  }),

  // Firecrawl map results cache - 30 minutes TTL
  firecrawlMap: new CacheService({
    namespace: 'firecrawl:map',
    max: 500,
    ttl: 30 * 60 * 1000,
  }),

  // Search results cache - 10 minutes TTL
  searchResults: new CacheService({
    namespace: 'search',
    max: 500,
    ttl: 10 * 60 * 1000,
  }),

  // API responses cache - 1 minute TTL
  apiResponses: new CacheService({
    namespace: 'api',
    max: 2000,
    ttl: 60 * 1000,
  }),

  // User data cache - 5 minutes TTL
  userData: new CacheService({
    namespace: 'user',
    max: 100,
    ttl: 5 * 60 * 1000,
  }),
};

// Helper function to create cache key from object
export function createCacheKey(obj: Record<string, any>): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc: Record<string, any>, key: string) => {
      if (obj[key] !== undefined && obj[key] !== null) {
        acc[key] = obj[key];
      }
      return acc;
    }, {} as Record<string, any>);
  
  return JSON.stringify(sorted);
}

// Helper function for conditional caching
export function shouldCache(response: any): boolean {
  // Don't cache error responses
  if (response.error || response.status >= 400) {
    return false;
  }
  
  // Don't cache empty responses
  if (!response.data || 
      (Array.isArray(response.data) && response.data.length === 0)) {
    return false;
  }
  
  return true;
}