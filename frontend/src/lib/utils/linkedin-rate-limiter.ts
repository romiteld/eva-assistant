import { supabase } from '@/lib/supabase/browser';

interface RateLimitConfig {
  dailyAppLimit: number;      // 500,000 requests per day
  dailyMemberLimit: number;   // 100 requests per day per member
  throttleLimit: number;      // 3 calls per second per member
  windowSize: number;         // Time window in milliseconds
}

export class LinkedInRateLimiter {
  private config: RateLimitConfig = {
    dailyAppLimit: 500000,
    dailyMemberLimit: 100,
    throttleLimit: 3,
    windowSize: 1000 // 1 second
  };

  private requestQueue: Map<string, number[]> = new Map();
  private dailyCounters: Map<string, { count: number; date: string }> = new Map();

  constructor(customConfig?: Partial<RateLimitConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    
    // Load counters from storage
    this.loadCounters();
  }

  /**
   * Check if a request can be made for a specific user
   */
  async canMakeRequest(userId: string): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    // Check daily member limit
    const memberKey = `member:${userId}`;
    const today = new Date().toISOString().split('T')[0];
    
    const memberDaily = this.dailyCounters.get(memberKey);
    if (memberDaily && memberDaily.date === today && memberDaily.count >= this.config.dailyMemberLimit) {
      return {
        allowed: false,
        reason: 'Daily member limit exceeded',
        retryAfter: this.getMillisecondsUntilNextDay()
      };
    }

    // Check throttle limit (per second)
    const now = Date.now();
    const userRequests = this.requestQueue.get(userId) || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < this.config.windowSize);
    
    if (recentRequests.length >= this.config.throttleLimit) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = this.config.windowSize - (now - oldestRequest);
      return {
        allowed: false,
        reason: 'Throttle limit exceeded',
        retryAfter
      };
    }

    // Check daily app limit
    const appDaily = this.dailyCounters.get('app:global');
    if (appDaily && appDaily.date === today && appDaily.count >= this.config.dailyAppLimit) {
      return {
        allowed: false,
        reason: 'Daily application limit exceeded',
        retryAfter: this.getMillisecondsUntilNextDay()
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request for rate limiting
   */
  recordRequest(userId: string): void {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Update throttle queue
    const userRequests = this.requestQueue.get(userId) || [];
    userRequests.push(now);
    
    // Clean up old requests
    const cleanedRequests = userRequests.filter(timestamp => now - timestamp < this.config.windowSize);
    this.requestQueue.set(userId, cleanedRequests);

    // Update daily counters
    const memberKey = `member:${userId}`;
    const memberDaily = this.dailyCounters.get(memberKey) || { count: 0, date: today };
    
    if (memberDaily.date !== today) {
      memberDaily.count = 1;
      memberDaily.date = today;
    } else {
      memberDaily.count++;
    }
    this.dailyCounters.set(memberKey, memberDaily);

    // Update app-wide counter
    const appDaily = this.dailyCounters.get('app:global') || { count: 0, date: today };
    if (appDaily.date !== today) {
      appDaily.count = 1;
      appDaily.date = today;
    } else {
      appDaily.count++;
    }
    this.dailyCounters.set('app:global', appDaily);

    // Persist counters
    this.saveCounters();
  }

  /**
   * Execute a request with rate limiting
   */
  async executeWithRateLimit<T>(
    userId: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const canRequest = await this.canMakeRequest(userId);
    
    if (!canRequest.allowed) {
      if (canRequest.retryAfter) {
        // Wait and retry for throttle limits
        if (canRequest.retryAfter < 5000) { // Only auto-retry for short waits
          await this.delay(canRequest.retryAfter);
          return this.executeWithRateLimit(userId, requestFn);
        }
      }
      
      throw new Error(`Rate limit exceeded: ${canRequest.reason}. Retry after ${canRequest.retryAfter}ms`);
    }

    try {
      const result = await requestFn();
      this.recordRequest(userId);
      return result;
    } catch (error) {
      // Don't count failed requests against rate limit
      throw error;
    }
  }

  /**
   * Get current usage statistics
   */
  async getUsageStats(userId: string): Promise<{
    daily: { used: number; limit: number; percentage: number };
    throttle: { current: number; limit: number };
    appDaily: { used: number; limit: number; percentage: number };
  }> {
    const today = new Date().toISOString().split('T')[0];
    const memberKey = `member:${userId}`;
    
    const memberDaily = this.dailyCounters.get(memberKey) || { count: 0, date: today };
    const appDaily = this.dailyCounters.get('app:global') || { count: 0, date: today };
    
    const now = Date.now();
    const userRequests = this.requestQueue.get(userId) || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < this.config.windowSize);
    
    return {
      daily: {
        used: memberDaily.date === today ? memberDaily.count : 0,
        limit: this.config.dailyMemberLimit,
        percentage: Math.round(((memberDaily.date === today ? memberDaily.count : 0) / this.config.dailyMemberLimit) * 100)
      },
      throttle: {
        current: recentRequests.length,
        limit: this.config.throttleLimit
      },
      appDaily: {
        used: appDaily.date === today ? appDaily.count : 0,
        limit: this.config.dailyAppLimit,
        percentage: Math.round(((appDaily.date === today ? appDaily.count : 0) / this.config.dailyAppLimit) * 100)
      }
    };
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  resetUserLimits(userId: string): void {
    const memberKey = `member:${userId}`;
    this.dailyCounters.delete(memberKey);
    this.requestQueue.delete(userId);
    this.saveCounters();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getMillisecondsUntilNextDay(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }

  private async loadCounters(): Promise<void> {
    try {
      // Load from database or local storage
      const { data } = await supabase
        .from('api_usage')
        .select('*')
        .eq('endpoint', 'linkedin')
        .gte('created_at', new Date().toISOString().split('T')[0]);
      
      if (data) {
        // Reconstruct counters from database
        data.forEach(record => {
          const key = record.user_id ? `member:${record.user_id}` : 'app:global';
          const existing = this.dailyCounters.get(key);
          if (existing) {
            existing.count++;
          } else {
            this.dailyCounters.set(key, {
              count: 1,
              date: new Date().toISOString().split('T')[0]
            });
          }
        });
      }
    } catch (error) {
      console.error('Error loading rate limit counters:', error);
    }
  }

  private async saveCounters(): Promise<void> {
    try {
      // Save to database for persistence
      // This is a simplified version - in production, you'd want batch updates
      const today = new Date().toISOString().split('T')[0];
      
      for (const [key, value] of this.dailyCounters.entries()) {
        if (value.date === today && key.startsWith('member:')) {
          const userId = key.replace('member:', '');
          await supabase
            .from('api_usage')
            .insert({
              user_id: userId,
              endpoint: 'linkedin',
              method: 'GET',
              status_code: 200,
              response_time_ms: 0,
              tokens_used: 0,
              cost: 0
            });
        }
      }
    } catch (error) {
      console.error('Error saving rate limit counters:', error);
    }
  }
}

// Singleton instance
let rateLimiterInstance: LinkedInRateLimiter | null = null;

export function getLinkedInRateLimiter(): LinkedInRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new LinkedInRateLimiter();
  }
  return rateLimiterInstance;
}