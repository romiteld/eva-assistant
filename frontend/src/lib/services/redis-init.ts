import { checkRedisConnection } from './redis-client';
import { supabase } from '@/lib/supabase/browser';

/**
 * Initialize Redis connection and verify setup
 */
export async function initializeRedis(): Promise<{
  connected: boolean;
  fallbackMode: boolean;
  error?: string;
}> {
  try {
    // Check if Redis credentials are configured
    const hasCredentials = 
      process.env.KV_REST_API_URL && 
      process.env.KV_REST_API_TOKEN;
    
    if (!hasCredentials) {
      console.warn('Redis credentials not configured. Using in-memory fallback.');
      return {
        connected: false,
        fallbackMode: true,
        error: 'Missing Redis credentials',
      };
    }
    
    // Test Redis connection
    const isConnected = await checkRedisConnection();
    
    if (!isConnected) {
      console.warn('Redis connection failed. Using in-memory fallback.');
      return {
        connected: false,
        fallbackMode: true,
        error: 'Redis connection failed',
      };
    }
    
    console.log('✅ Redis connected successfully');
    
    // Initialize rate limit states for existing users
    await initializeRateLimitStates();
    
    return {
      connected: true,
      fallbackMode: false,
    };
    
  } catch (error) {
    console.error('Redis initialization error:', error);
    return {
      connected: false,
      fallbackMode: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Initialize rate limit states for existing Zoho users
 */
async function initializeRateLimitStates() {
  try {
    // Get all users with Zoho credentials
    const { data: users, error } = await supabase
      .from('users')
      .select('id, zoho_org_id')
      .not('zoho_org_id', 'is', null);
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    // Initialize rate limit state for each org
    for (const user of users || []) {
      if (user.zoho_org_id) {
        // Check if rate limit state exists
        const { data: existing } = await supabase
          .from('zoho_rate_limit_state')
          .select('id')
          .eq('org_id', user.zoho_org_id)
          .eq('user_id', user.id)
          .single();
        
        if (!existing) {
          // Create initial rate limit state
          await supabase
            .from('zoho_rate_limit_state')
            .insert({
              org_id: user.zoho_org_id,
              user_id: user.id,
              tokens_remaining: 200,
              window_start: new Date().toISOString(),
              last_refill: new Date().toISOString(),
            });
        }
      }
    }
    
    console.log('✅ Rate limit states initialized');
  } catch (error) {
    console.error('Error initializing rate limit states:', error);
  }
}

/**
 * Get Redis setup instructions for the user
 */
export function getRedisSetupInstructions(): string {
  return `
# Redis Setup Instructions

To enable the Zoho API Queue System, you need to set up Redis:

## Option 1: Upstash Redis (Recommended for Production)

1. Create a free account at https://upstash.com
2. Create a new Redis database
3. Copy your credentials and add to your .env.local:

\`\`\`
KV_REST_API_URL=your-redis-url
KV_REST_API_TOKEN=your-redis-token
\`\`\`

## Option 2: Local Redis (Development Only)

The system will automatically fall back to an in-memory queue if Redis is not available.
This is suitable for development but not recommended for production.

## Benefits of Redis Queue System:

- ✅ Respects Zoho API rate limits (200 calls/minute)
- ✅ Automatic retry with exponential backoff
- ✅ Request prioritization
- ✅ Caching to reduce API calls by 60-80%
- ✅ Batch processing for bulk operations
- ✅ Real-time queue monitoring

Without Redis, the system will still work but with limited functionality.
`;
}