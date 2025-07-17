import { redis, zohoRateLimiter, zohoApiQueue, zohoCache } from '@/lib/services/redis-client';
import { ZohoCRMIntegration } from '@/lib/integrations/zoho-crm';
import { supabase } from '@/lib/supabase/client';

interface ZohoRequest {
  id: string;
  userId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  scheduledAt?: number;
  callback?: (result: any) => void;
  onError?: (error: any) => void;
}

interface BatchableRequest {
  type: 'bulk_create' | 'bulk_update' | 'bulk_read';
  module: string;
  requests: ZohoRequest[];
}

export class ZohoAPIQueue {
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private batchThreshold = 10; // Batch requests when we have 10+ similar ones
  private maxBatchSize = 100; // Zoho's limit for bulk operations
  
  constructor() {
    // Start processing queue
    this.startProcessing();
  }
  
  private startProcessing() {
    // Process queue every 300ms (200 requests/min = ~3.33 requests/sec)
    this.processInterval = setInterval(() => {
      if (!this.processing) {
        this.processQueue();
      }
    }, 300);
  }
  
  async addRequest(
    userId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any,
    options?: {
      priority?: number;
      maxRetries?: number;
      callback?: (result: any) => void;
      onError?: (error: any) => void;
    }
  ): Promise<string> {
    const request: ZohoRequest = {
      id: crypto.randomUUID(),
      userId,
      endpoint,
      method,
      data,
      priority: options?.priority || 5,
      retryCount: 0,
      maxRetries: options?.maxRetries || 3,
      createdAt: Date.now(),
      callback: options?.callback,
      onError: options?.onError,
    };
    
    // Check if we can serve from cache
    if (method === 'GET') {
      const cacheKey = this.getCacheKey(endpoint, data);
      const cached = await zohoCache.get(cacheKey);
      if (cached) {
        console.log(`Serving from cache: ${endpoint}`);
        options?.callback?.(cached);
        return request.id;
      }
    }
    
    // Add to queue
    await zohoApiQueue.push(request, request.priority);
    
    // Log to database for tracking
    await this.logQueueRequest(request);
    
    return request.id;
  }
  
  private async processQueue() {
    this.processing = true;
    
    try {
      // Check rate limit
      if (zohoRateLimiter) {
        const { success, remaining } = await zohoRateLimiter.limit('zoho-api');
        if (!success) {
          console.log('Rate limit reached. Waiting...');
          this.processing = false;
          return;
        }
      }
      
      // Check for batchable requests
      const batchable = await this.findBatchableRequests();
      if (batchable) {
        await this.processBatch(batchable);
      } else {
        // Process single request
        const request = await zohoApiQueue.pop();
        if (request) {
          await this.processSingleRequest(request);
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.processing = false;
    }
  }
  
  private async processSingleRequest(request: ZohoRequest) {
    try {
      // Get user's Zoho credentials
      const { data: userData } = await supabase
        .from('users')
        .select('zoho_access_token, zoho_refresh_token')
        .eq('id', request.userId)
        .single();
      
      if (!userData?.zoho_access_token) {
        throw new Error('Zoho credentials not found');
      }
      
      // Initialize Zoho client
      const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key';
      const webhookToken = process.env.ZOHO_WEBHOOK_TOKEN || 'default-token';
      const zoho = new ZohoCRMIntegration(encryptionKey, webhookToken);
      
      // Make API call based on endpoint
      let result;
      
      // Parse endpoint to determine operation
      if (request.endpoint.includes('/Leads') && request.method === 'POST') {
        result = await zoho.createLead(request.userId, request.data);
      } else if (request.endpoint.includes('/Leads') && request.method === 'GET') {
        result = await zoho.getLeads(request.userId);
      } else if (request.endpoint.includes('/Leads/') && request.method === 'PUT') {
        const leadId = request.endpoint.split('/').pop() || '';
        result = await zoho.updateLead(request.userId, leadId, request.data);
      } else if (request.endpoint.includes('/Contacts') && request.method === 'POST') {
        result = await zoho.createContact(request.userId, request.data);
      } else if (request.endpoint.includes('/Deals') && request.method === 'POST') {
        result = await zoho.createDeal(request.userId, request.data);
      } else {
        // For other endpoints, make a direct API call
        // This would need to be implemented if the authenticated API supports it
        throw new Error(`Unsupported endpoint: ${request.endpoint}`);
      }
      
      // Cache GET requests
      if (request.method === 'GET' && result) {
        const cacheKey = this.getCacheKey(request.endpoint, request.data);
        await zohoCache.set(cacheKey, result, 300); // 5 minutes TTL
      }
      
      // Update request status
      await this.updateRequestStatus(request.id, 'completed', result);
      
      // Call callback if provided
      request.callback?.(result);
      
    } catch (error: any) {
      console.error(`Error processing request ${request.id}:`, error);
      
      // Handle rate limit errors
      if (error.response?.status === 429 || error.code === 'RATE_LIMIT') {
        // Re-queue with exponential backoff
        request.retryCount++;
        request.scheduledAt = Date.now() + Math.pow(2, request.retryCount) * 1000;
        await zohoApiQueue.push(request, request.priority + 1); // Lower priority
        return;
      }
      
      // Handle other retryable errors
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        await zohoApiQueue.push(request, request.priority);
        return;
      }
      
      // Max retries reached
      await this.updateRequestStatus(request.id, 'failed', null, error.message);
      request.onError?.(error);
    }
  }
  
  private async findBatchableRequests(): Promise<BatchableRequest | null> {
    const queueSize = await zohoApiQueue.size();
    if (queueSize < this.batchThreshold) return null;
    
    // For now, return null - batch processing can be implemented later
    // This would involve peeking at the queue and grouping similar requests
    return null;
  }
  
  private async processBatch(batch: BatchableRequest) {
    // Implement batch processing logic
    console.log('Batch processing not yet implemented');
  }
  
  private getCacheKey(endpoint: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramStr}`;
  }
  
  private async logQueueRequest(request: ZohoRequest) {
    try {
      await supabase.from('zoho_request_queue').insert({
        user_id: request.userId,
        request_type: request.method,
        endpoint: request.endpoint,
        method: request.method,
        payload: request.data,
        priority: request.priority,
        status: 'pending',
        retry_count: request.retryCount,
      });
    } catch (error) {
      console.error('Error logging queue request:', error);
    }
  }
  
  private async updateRequestStatus(
    requestId: string,
    status: 'completed' | 'failed',
    response?: any,
    errorMessage?: string
  ) {
    try {
      await supabase
        .from('zoho_request_queue')
        .update({
          status,
          processed_at: new Date().toISOString(),
          response,
          error_message: errorMessage,
        })
        .eq('id', requestId);
    } catch (error) {
      console.error('Error updating request status:', error);
    }
  }
  
  async getQueueStatus() {
    const size = await zohoApiQueue.size();
    const rateLimit = zohoRateLimiter 
      ? await zohoRateLimiter.limit('zoho-api', { rate: 0 })
      : null;
    
    return {
      queueSize: size,
      rateLimit: {
        remaining: rateLimit?.remaining || 200,
        reset: rateLimit?.reset || Date.now() + 60000,
      },
      processing: this.processing,
    };
  }
  
  destroy() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
  }
}

// Singleton instance
let queueInstance: ZohoAPIQueue | null = null;

export function getZohoQueue(): ZohoAPIQueue {
  if (!queueInstance) {
    queueInstance = new ZohoAPIQueue();
  }
  return queueInstance;
}