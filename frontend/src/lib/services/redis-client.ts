import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Redis configuration
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (!redisUrl || !redisToken) {
  console.warn('Redis credentials not found. Queue system will use in-memory fallback.');
}

// Create Redis client
export const redis = redisUrl && redisToken 
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

// Create rate limiter for Zoho API (200 requests per minute with buffer)
export const zohoRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit:zoho',
    })
  : null;

// Create general API rate limiter (for other integrations)
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(100, '1 m', 100),
      analytics: true,
      prefix: '@upstash/ratelimit:api',
    })
  : null;

// Queue operations
export class RedisQueue {
  private queueName: string;
  
  constructor(queueName: string) {
    this.queueName = `queue:${queueName}`;
  }
  
  async push(data: any, priority: number = 5): Promise<void> {
    if (!redis) {
      console.warn('Redis not available. Using in-memory queue.');
      return;
    }
    
    const item = {
      id: crypto.randomUUID(),
      data,
      priority,
      timestamp: Date.now(),
      attempts: 0,
    };
    
    // Use sorted set for priority queue
    await redis.zadd(this.queueName, {
      score: priority,
      member: JSON.stringify(item),
    });
  }
  
  async pop(): Promise<any | null> {
    if (!redis) return null;
    
    // Get highest priority item (lowest score)
    const items = await redis.zrange(this.queueName, 0, 0);
    if (items.length === 0) return null;
    
    const item = items[0];
    await redis.zrem(this.queueName, item);
    
    return JSON.parse(item as string);
  }
  
  async size(): Promise<number> {
    if (!redis) return 0;
    return await redis.zcard(this.queueName);
  }
  
  async clear(): Promise<void> {
    if (!redis) return;
    await redis.del(this.queueName);
  }
}

// Cache operations with TTL
export class RedisCache {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = `cache:${prefix}`;
  }
  
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    
    const data = await redis.get(`${this.prefix}:${key}`);
    if (!data) return null;
    
    return JSON.parse(data as string) as T;
  }
  
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    if (!redis) return;
    
    await redis.setex(
      `${this.prefix}:${key}`,
      ttlSeconds,
      JSON.stringify(value)
    );
  }
  
  async delete(key: string): Promise<void> {
    if (!redis) return;
    await redis.del(`${this.prefix}:${key}`);
  }
  
  async deletePattern(pattern: string): Promise<void> {
    if (!redis) return;
    
    // Note: Upstash doesn't support KEYS command, so we need to track keys separately
    // For production, consider using Redis SCAN or maintaining a key index
    console.warn('Pattern deletion not fully supported in Upstash. Consider key indexing.');
  }
}

// In-memory fallback for development/testing
class InMemoryQueue {
  private queue: Array<{ data: any; priority: number }> = [];
  
  async push(data: any, priority: number = 5): Promise<void> {
    this.queue.push({ data, priority });
    this.queue.sort((a, b) => a.priority - b.priority);
  }
  
  async pop(): Promise<any | null> {
    const item = this.queue.shift();
    return item ? item.data : null;
  }
  
  async size(): Promise<number> {
    return this.queue.length;
  }
  
  async clear(): Promise<void> {
    this.queue = [];
  }
}

// Export fallback queue for when Redis is not available
export const fallbackQueue = new InMemoryQueue();

// Helper to check Redis connection
export async function checkRedisConnection(): Promise<boolean> {
  if (!redis) return false;
  
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

// Export queue instances for different purposes
export const zohoApiQueue = new RedisQueue('zoho-api');
export const emailProcessingQueue = new RedisQueue('email-processing');
export const webhookQueue = new RedisQueue('webhooks');

// Export cache instances
export const zohoCache = new RedisCache('zoho');
export const userCache = new RedisCache('user');
export const systemCache = new RedisCache('system');