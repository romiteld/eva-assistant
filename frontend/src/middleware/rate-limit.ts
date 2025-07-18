import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Default rate limit configurations for different endpoint types
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later',
  },
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many requests, please slow down',
  },
  upload: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 uploads per 5 minutes
    message: 'Upload limit exceeded, please try again later',
  },
  webhook: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 webhook calls per minute
    message: 'Webhook rate limit exceeded',
  },
  ai: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 AI requests per minute (increased for screen share)
    message: 'AI request limit exceeded, please try again later',
  },
};

// Create separate caches for different rate limit types
const rateLimiters = new Map<string, LRUCache<string, number[]>>();

function getRateLimiter(type: string): LRUCache<string, number[]> {
  if (!rateLimiters.has(type)) {
    rateLimiters.set(type, new LRUCache<string, number[]>({
      max: 10000, // Store up to 10k unique IPs
      ttl: 24 * 60 * 60 * 1000, // 24 hour TTL
    }));
  }
  return rateLimiters.get(type)!;
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Use the first available IP
  const ip = forwardedFor?.split(',')[0].trim() || realIp || cfConnectingIp || 'unknown';
  
  // For authenticated requests, include user ID in identifier
  const authHeader = request.headers.get('authorization');
  const userId = authHeader ? Buffer.from(authHeader).toString('base64').slice(0, 16) : '';
  
  return userId ? `${ip}:${userId}` : ip;
}

export async function rateLimit(
  request: NextRequest,
  type: keyof typeof RATE_LIMIT_CONFIGS = 'api'
): Promise<NextResponse | null> {
  const config = RATE_LIMIT_CONFIGS[type];
  const limiter = getRateLimiter(type);
  const identifier = getClientIdentifier(request);
  const now = Date.now();
  
  // Get existing timestamps for this identifier
  let timestamps = limiter.get(identifier) || [];
  
  // Remove timestamps outside the current window
  timestamps = timestamps.filter(timestamp => now - timestamp < config.windowMs);
  
  // Check if limit is exceeded
  if (timestamps.length >= config.max) {
    const retryAfter = Math.ceil((timestamps[0] + config.windowMs - now) / 1000);
    
    return NextResponse.json(
      {
        error: config.message || 'Rate limit exceeded',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(timestamps[0] + config.windowMs).toISOString(),
        },
      }
    );
  }
  
  // Add current timestamp
  timestamps.push(now);
  limiter.set(identifier, timestamps);
  
  // Return null to indicate request can proceed
  return null;
}

// Middleware wrapper for rate limiting
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  type: keyof typeof RATE_LIMIT_CONFIGS = 'api'
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await rateLimit(request, type);
    if (rateLimitResponse) return rateLimitResponse;
    
    const response = await handler(request);
    
    // Add rate limit headers to successful responses
    const config = RATE_LIMIT_CONFIGS[type];
    const limiter = getRateLimiter(type);
    const identifier = getClientIdentifier(request);
    const timestamps = limiter.get(identifier) || [];
    const remaining = Math.max(0, config.max - timestamps.length);
    
    response.headers.set('X-RateLimit-Limit', config.max.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    
    if (timestamps.length > 0) {
      response.headers.set(
        'X-RateLimit-Reset',
        new Date(timestamps[0] + config.windowMs).toISOString()
      );
    }
    
    return response;
  };
}

// Per-route rate limit configuration
export function getRateLimitType(pathname: string): keyof typeof RATE_LIMIT_CONFIGS {
  if (pathname.includes('/auth')) return 'auth';
  if (pathname.includes('/upload')) return 'upload';
  if (pathname.includes('/webhook')) return 'webhook';
  if (pathname.includes('/ai') || pathname.includes('/chat')) return 'ai';
  return 'api';
}