interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private config: RateLimitConfig) {}
  
  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this key
    const timestamps = this.requests.get(key) || [];
    
    // Filter out old requests outside the window
    const recentRequests = timestamps.filter(time => time > windowStart);
    
    // Check if we've exceeded the limit
    if (recentRequests.length >= this.config.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.1) {
      this.cleanup();
    }
    
    return true;
  }
  
  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    for (const [key, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(time => time > windowStart);
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
}

// Create rate limiters for different endpoints
export const authRateLimiter = new RateLimiter({
  maxRequests: 10, // 10 requests
  windowMs: 60 * 1000 // per minute
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 30, // 30 requests
  windowMs: 60 * 1000 // per minute
});