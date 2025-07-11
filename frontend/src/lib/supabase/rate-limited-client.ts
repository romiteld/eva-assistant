import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './browser';
import { authRateLimiter, apiRateLimiter } from '@/lib/utils/rate-limiter';

class RateLimitedSupabaseClient {
  private client: SupabaseClient;
  private authCache: { user: any; timestamp: number } | null = null;
  private CACHE_DURATION = 10000; // 10 seconds

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  get auth() {
    const originalAuth = this.client.auth;
    
    return {
      ...originalAuth,
      getUser: async () => {
        // Check cache first
        if (this.authCache && Date.now() - this.authCache.timestamp < this.CACHE_DURATION) {
          return { data: { user: this.authCache.user }, error: null };
        }

        // Check rate limit
        const canProceed = await authRateLimiter.checkLimit('getUser');
        if (!canProceed) {
          return {
            data: { user: null },
            error: new Error('Rate limit exceeded. Please wait before making another request.')
          };
        }

        // Make actual request
        const result = await originalAuth.getUser();
        
        // Cache successful result
        if (!result.error && result.data.user) {
          this.authCache = {
            user: result.data.user,
            timestamp: Date.now()
          };
        }

        return result;
      },
      
      getSession: async () => {
        // Check rate limit
        const canProceed = await authRateLimiter.checkLimit('getSession');
        if (!canProceed) {
          return {
            data: { session: null },
            error: new Error('Rate limit exceeded. Please wait before making another request.')
          };
        }

        return originalAuth.getSession();
      },
      
      // Pass through other methods
      signOut: originalAuth.signOut.bind(originalAuth),
      signIn: originalAuth.signIn.bind(originalAuth),
      signUp: originalAuth.signUp.bind(originalAuth),
      refreshSession: originalAuth.refreshSession.bind(originalAuth),
      onAuthStateChange: originalAuth.onAuthStateChange.bind(originalAuth)
    };
  }

  // Proxy other Supabase client methods
  get from() {
    return new Proxy(this.client.from.bind(this.client), {
      apply: async (target, thisArg, args) => {
        // Check rate limit for database queries
        const canProceed = await apiRateLimiter.checkLimit('db-query');
        if (!canProceed) {
          throw new Error('Rate limit exceeded for database queries. Please wait.');
        }
        return target(...args);
      }
    });
  }

  // Clear caches on sign out
  clearCache() {
    this.authCache = null;
  }
}

// Create rate-limited client
export const rateLimitedSupabase = new RateLimitedSupabaseClient(supabase);

// Listen for auth changes to clear cache
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    rateLimitedSupabase.clearCache();
  }
});