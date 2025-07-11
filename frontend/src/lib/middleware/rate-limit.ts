import { NextRequest } from 'next/server';
import { LRUCache } from 'lru-cache';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  identifier?: (req: NextRequest) => string; // Custom identifier function
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyPrefix?: string; // Prefix for rate limit keys
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// Create a global cache for rate limiting
const rateLimitCache = new LRUCache<string, RateLimitInfo>({
  max: 10000, // Maximum number of keys to store
  ttl: 60 * 60 * 1000, // 1 hour TTL
});

export class RateLimiter {
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      max: config.max,
      identifier: config.identifier || this.defaultIdentifier,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyPrefix: config.keyPrefix || 'rl',
    };
  }

  private defaultIdentifier(req: NextRequest): string {
    // Try to get user ID from various sources
    const userId = req.headers.get('x-user-id');
    if (userId) return userId;

    // Fall back to IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return ip;
  }

  public async checkLimit(req: NextRequest): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const identifier = this.config.identifier(req);
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();

    let info = rateLimitCache.get(key);

    if (!info || now > info.resetTime) {
      // Create new rate limit window
      info = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
    }

    const allowed = info.count < this.config.max;
    const remaining = Math.max(0, this.config.max - info.count - 1);

    if (allowed) {
      // Increment counter
      info.count++;
      rateLimitCache.set(key, info);
    }

    return {
      allowed,
      limit: this.config.max,
      remaining,
      resetTime: info.resetTime,
    };
  }

  public async recordResult(req: NextRequest, success: boolean) {
    if (
      (success && this.config.skipSuccessfulRequests) ||
      (!success && this.config.skipFailedRequests)
    ) {
      // Decrement the counter
      const identifier = this.config.identifier(req);
      const key = `${this.config.keyPrefix}:${identifier}`;
      const info = rateLimitCache.get(key);
      
      if (info && info.count > 0) {
        info.count--;
        rateLimitCache.set(key, info);
      }
    }
  }

  public reset(identifier: string) {
    const key = `${this.config.keyPrefix}:${identifier}`;
    rateLimitCache.delete(key);
  }

  public resetAll() {
    rateLimitCache.clear();
  }
}

// Pre-configured rate limiters for different use cases
export const rateLimiters = {
  // Standard API rate limit: 100 requests per minute
  standard: new RateLimiter({
    windowMs: 60 * 1000,
    max: 100,
  }),

  // Strict rate limit for expensive operations: 10 requests per minute
  strict: new RateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'rl:strict',
  }),

  // Firecrawl-specific rate limit: 10 requests per minute
  firecrawl: new RateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'rl:firecrawl',
  }),

  // Search rate limit: 20 requests per minute
  search: new RateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    keyPrefix: 'rl:search',
  }),

  // Upload rate limit: 5 requests per minute
  upload: new RateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    keyPrefix: 'rl:upload',
  }),
};

// Helper function to create rate limit headers
export function createRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetTime: number;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
    'X-RateLimit-Reset-After': Math.max(0, result.resetTime - Date.now()).toString(),
  };
}

// Middleware helper for rate limiting
export async function withRateLimit(
  req: NextRequest,
  rateLimiter: RateLimiter,
  handler: () => Promise<Response>
): Promise<Response> {
  const result = await rateLimiter.checkLimit(req);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please retry after ${new Date(result.resetTime).toISOString()}`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...createRateLimitHeaders(result),
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const response = await handler();
    
    // Add rate limit headers to successful responses
    const headers = new Headers(response.headers);
    Object.entries(createRateLimitHeaders(result)).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    // Record the error result
    await rateLimiter.recordResult(req, false);
    throw error;
  }
}