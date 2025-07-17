import { zohoCache } from '@/lib/services/redis-client';
import { LRUCache } from 'lru-cache';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: boolean;
  maxSize?: number;
}

// Cache configurations for different Zoho endpoints
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Relatively static data - longer TTL
  '/settings/fields': { ttl: 3600 }, // 1 hour
  '/settings/layouts': { ttl: 3600 },
  '/settings/modules': { ttl: 3600 },
  '/settings/related_lists': { ttl: 3600 },
  '/org': { ttl: 3600 },
  
  // Semi-static data - medium TTL
  '/users': { ttl: 900 }, // 15 minutes
  '/settings/territories': { ttl: 900 },
  '/settings/roles': { ttl: 900 },
  
  // Dynamic data - short TTL
  '/Leads': { ttl: 300, staleWhileRevalidate: true }, // 5 minutes
  '/Contacts': { ttl: 300, staleWhileRevalidate: true },
  '/Accounts': { ttl: 300, staleWhileRevalidate: true },
  '/Deals': { ttl: 120, staleWhileRevalidate: true }, // 2 minutes - more dynamic
  '/Tasks': { ttl: 60 }, // 1 minute - very dynamic
  '/Calls': { ttl: 60 },
  '/Events': { ttl: 60 },
  
  // Real-time data - minimal caching
  '/Deals/*/actions': { ttl: 30 }, // 30 seconds
  '/Leads/*/actions': { ttl: 30 },
  '/settings/pipeline': { ttl: 30 },
};

export class ZohoCacheManager {
  // In-memory LRU cache as first layer
  private memoryCache: LRUCache<string, CacheEntry>;
  private cacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
  };
  
  constructor() {
    this.memoryCache = new LRUCache<string, CacheEntry>({
      max: 1000, // Maximum 1000 items in memory
      ttl: 1000 * 60 * 5, // 5 minutes default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: () => {
        this.cacheStats.evictions++;
      },
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached && !this.isExpired(memCached)) {
      this.cacheStats.hits++;
      memCached.hits++;
      return memCached.data as T;
    }
    
    // Check Redis cache
    try {
      const redisCached = await zohoCache.get<CacheEntry<T>>(key);
      if (redisCached && !this.isExpired(redisCached)) {
        this.cacheStats.hits++;
        // Populate memory cache
        this.memoryCache.set(key, redisCached);
        return redisCached.data;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }
    
    this.cacheStats.misses++;
    return null;
  }
  
  async set<T>(key: string, data: T, customTtl?: number): Promise<void> {
    const config = this.getConfigForKey(key);
    const ttl = customTtl || config.ttl;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
      hits: 0,
    };
    
    // Set in memory cache
    this.memoryCache.set(key, entry);
    
    // Set in Redis cache
    try {
      await zohoCache.set(key, entry, ttl);
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
    
    this.cacheStats.writes++;
  }
  
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    try {
      await zohoCache.delete(key);
    } catch (error) {
      console.error('Redis cache delete error:', error);
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate memory cache entries matching pattern
    const keysToDelete: string[] = [];
    for (const [key] of this.memoryCache) {
      if (this.matchesPattern(key, pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.memoryCache.delete(key));
    
    // Note: Pattern deletion in Redis requires additional implementation
    // For Upstash, we might need to maintain a key index
    console.warn('Pattern deletion in Redis not fully implemented');
  }
  
  async invalidateModule(module: string): Promise<void> {
    await this.invalidatePattern(`/${module}/*`);
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }
  
  private getConfigForKey(key: string): CacheConfig {
    // Find matching config by pattern
    for (const [pattern, config] of Object.entries(CACHE_CONFIGS)) {
      if (this.matchesPattern(key, pattern)) {
        return config;
      }
    }
    
    // Default config
    return { ttl: 300 }; // 5 minutes default
  }
  
  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
  
  // Get cache statistics
  getStats() {
    return {
      ...this.cacheStats,
      memorySize: this.memoryCache.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
    };
  }
  
  // Clear all caches
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // Note: Clearing all Redis keys would require pattern scanning
    console.log('Cache cleared');
  }
  
  // Warm up cache with frequently accessed data
  async warmUp(userId: string, modules: string[] = ['Leads', 'Contacts', 'Deals']): Promise<void> {
    // Cache warm-up started for modules
    
    // This would typically fetch and cache common queries
    // Implementation depends on specific use cases
    for (const moduleName of modules) {
      const key = `/${moduleName}?page=1&per_page=20&sort_by=Modified_Time&sort_order=desc`;
      // The actual fetching would be done by the Zoho client
      // This is just a placeholder for the warm-up logic
    }
  }
  
  // Stale-while-revalidate implementation
  async getWithRevalidation<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    const config = this.getConfigForKey(key);
    
    if (cached) {
      // If stale-while-revalidate is enabled, return cached data and update in background
      if (config.staleWhileRevalidate) {
        // Return stale data immediately
        if (this.isStale(key)) {
          // Revalidate in background
          fetcher().then(fresh => {
            this.set(key, fresh);
          }).catch(error => {
            console.error('Background revalidation failed:', error);
          });
        }
        return cached;
      }
      
      // Normal cache hit
      return cached;
    }
    
    // Cache miss - fetch and cache
    const fresh = await fetcher();
    await this.set(key, fresh);
    return fresh;
  }
  
  private isStale(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return true;
    
    const age = Date.now() - entry.timestamp;
    const halfLife = entry.ttl / 2;
    
    // Consider stale if past half of TTL
    return age > halfLife;
  }
}

// Singleton instance
let cacheInstance: ZohoCacheManager | null = null;

export function getZohoCache(): ZohoCacheManager {
  if (!cacheInstance) {
    cacheInstance = new ZohoCacheManager();
  }
  return cacheInstance;
}

// Export cache invalidation helpers
export const cacheInvalidators = {
  // Invalidate when a lead is created/updated
  invalidateLead: async (leadId: string) => {
    const cache = getZohoCache();
    await cache.invalidatePattern(`/Leads/${leadId}*`);
    await cache.invalidatePattern('/Leads?*'); // List views
  },
  
  // Invalidate when a deal is created/updated
  invalidateDeal: async (dealId: string) => {
    const cache = getZohoCache();
    await cache.invalidatePattern(`/Deals/${dealId}*`);
    await cache.invalidatePattern('/Deals?*'); // List views
    await cache.invalidatePattern('/settings/pipeline*'); // Pipeline might change
  },
  
  // Invalidate when a contact is created/updated
  invalidateContact: async (contactId: string) => {
    const cache = getZohoCache();
    await cache.invalidatePattern(`/Contacts/${contactId}*`);
    await cache.invalidatePattern('/Contacts?*'); // List views
  },
  
  // Invalidate all data for a module
  invalidateModule: async (module: string) => {
    const cache = getZohoCache();
    await cache.invalidateModule(module);
  },
};