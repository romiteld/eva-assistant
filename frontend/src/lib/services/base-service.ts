import { supabase } from '@/lib/supabase/browser';
import { User } from '@supabase/supabase-js';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export abstract class BaseService {
  protected cache = new Map<string, CacheEntry<any>>();
  protected user: User | null = null;
  protected retryCount = 3;
  protected retryDelay = 1000;
  protected defaultCacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    this.user = session?.user ?? null;

    supabase.auth.onAuthStateChange((event, session) => {
      this.user = session?.user ?? null;
      if (event === 'SIGNED_OUT') {
        this.clearCache();
      }
    });
  }

  protected async ensureAuthenticated(): Promise<User> {
    if (!this.user) {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          throw new Error('User not authenticated');
        }
        
        this.user = refreshData.session.user;
      } else {
        this.user = session.user;
      }
    }
    
    return this.user;
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    retries = this.retryCount
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // If it's an auth error, try to refresh the session
        if (error.message?.includes('not authenticated') || error.status === 401) {
          try {
            await supabase.auth.refreshSession();
            // Retry immediately after refresh
            continue;
          } catch (refreshError) {
            // If refresh fails, throw the original error
            throw error;
          }
        }
        
        // For other errors, wait before retrying
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }

  protected getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  protected setCachedData<T>(key: string, data: T, ttl = this.defaultCacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  protected clearCache(): void {
    this.cache.clear();
  }

  protected async makeAuthenticatedRequest<T>(
    request: () => Promise<T>,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    // Check cache first if key provided
    if (cacheKey) {
      const cached = this.getCachedData<T>(cacheKey);
      if (cached) return cached;
    }

    // Ensure authenticated before making request
    await this.ensureAuthenticated();

    // Make request with retry logic
    const result = await this.withRetry(request);

    // Cache result if key provided
    if (cacheKey && result) {
      this.setCachedData(cacheKey, result, cacheTTL);
    }

    return result;
  }
}