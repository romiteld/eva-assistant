import { supabase } from '@/lib/supabase/browser';
import { redis, zohoRateLimiter } from '@/lib/services/redis-client';
import { ZohoCRMIntegration } from '@/lib/integrations/zoho-crm';

interface QueueItem {
  id: string;
  user_id: string;
  org_id: string;
  endpoint: string;
  method: string;
  payload?: any;
  priority: number;
  retry_count: number;
  max_retries: number;
  callback_id?: string;
}

/**
 * Zoho Queue Processor
 * Processes queued API requests with rate limiting
 */
export class ZohoQueueProcessor {
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private activeRequests = new Map<string, AbortController>();
  
  /**
   * Start processing the queue
   */
  start() {
    if (this.processing) return;
    
    this.processing = true;
    console.log('🚀 Starting Zoho Queue Processor');
    
    // Process queue every 300ms (200 requests/min = ~3.33 requests/sec)
    this.processInterval = setInterval(() => {
      this.processNextBatch();
    }, 300);
  }
  
  /**
   * Stop processing the queue
   */
  stop() {
    this.processing = false;
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    
    // Cancel all active requests
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
    
    console.log('🛑 Stopped Zoho Queue Processor');
  }
  
  /**
   * Process the next batch of requests
   */
  private async processNextBatch() {
    if (!this.processing) return;
    
    try {
      // Get pending requests ordered by priority and scheduled time
      const { data: requests, error } = await supabase
        .from('zoho_request_queue')
        .select('*')
        .in('status', ['pending', 'rate_limited'])
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('scheduled_for', { ascending: true })
        .limit(10);
      
      if (error) {
        console.error('Error fetching queue:', error);
        return;
      }
      
      if (!requests || requests.length === 0) {
        return; // No requests to process
      }
      
      // Process requests in parallel (up to rate limit)
      await Promise.all(
        requests.map(request => this.processRequest(request))
      );
      
    } catch (error) {
      console.error('Queue processor error:', error);
    }
  }
  
  /**
   * Process a single request
   */
  private async processRequest(item: QueueItem) {
    // Check rate limit
    if (redis && zohoRateLimiter) {
      const { success, limit, reset, remaining } = await zohoRateLimiter.limit(
        `org:${item.org_id}`
      );
      
      if (!success) {
        // Rate limited - reschedule for later
        const resetTime = new Date(reset);
        await this.updateRequestStatus(item.id, 'rate_limited', {
          scheduled_for: resetTime.toISOString(),
          error_message: `Rate limited. Resets at ${resetTime.toLocaleTimeString()}`
        });
        return;
      }
    } else {
      // Fallback: Check database rate limit
      const remaining = await this.checkDatabaseRateLimit(item.org_id, item.user_id);
      if (remaining <= 0) {
        // Rate limited - reschedule for 1 minute later
        await this.updateRequestStatus(item.id, 'rate_limited', {
          scheduled_for: new Date(Date.now() + 60000).toISOString(),
          error_message: 'Rate limited. Retrying in 1 minute.'
        });
        return;
      }
    }
    
    // Mark as processing
    await this.updateRequestStatus(item.id, 'processing', {
      started_at: new Date().toISOString()
    });
    
    // Create abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(item.id, abortController);
    
    try {
      // Execute the API call
      const zoho = new ZohoCRMIntegration(item.user_id);
      const startTime = Date.now();
      
      const response = await zoho.makeApiCall(
        item.endpoint,
        item.method as any,
        item.payload
      );
      
      const responseTime = Date.now() - startTime;
      
      // Mark as completed
      await this.updateRequestStatus(item.id, 'completed', {
        completed_at: new Date().toISOString(),
        response_data: response,
        response_status: 200
      });
      
      // Update analytics
      await this.updateAnalytics(item, true, responseTime);
      
      // Execute callback if provided
      if (item.callback_id) {
        await this.executeCallback(item.callback_id, response);
      }
      
    } catch (error: any) {
      console.error(`Error processing request ${item.id}:`, error);
      
      // Check if it's a retryable error
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && item.retry_count < item.max_retries;
      
      if (shouldRetry) {
        // Calculate backoff delay
        const delay = Math.min(
          Math.pow(2, item.retry_count) * 1000,
          300000 // Max 5 minutes
        );
        
        await this.updateRequestStatus(item.id, 'pending', {
          retry_count: item.retry_count + 1,
          scheduled_for: new Date(Date.now() + delay).toISOString(),
          error_message: error.message
        });
      } else {
        // Mark as failed
        await this.updateRequestStatus(item.id, 'failed', {
          completed_at: new Date().toISOString(),
          error_message: error.message,
          response_status: error.status || 500
        });
        
        // Execute error callback if provided
        if (item.callback_id) {
          await this.executeCallback(item.callback_id, null, error);
        }
      }
      
      // Update analytics
      await this.updateAnalytics(item, false, 0);
      
    } finally {
      // Clean up abort controller
      this.activeRequests.delete(item.id);
    }
  }
  
  /**
   * Update request status in database
   */
  private async updateRequestStatus(
    id: string,
    status: string,
    updates: Record<string, any> = {}
  ) {
    const { error } = await supabase
      .from('zoho_request_queue')
      .update({
        status,
        ...updates
      })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating request status:', error);
    }
  }
  
  /**
   * Check database rate limit (fallback when Redis unavailable)
   */
  private async checkDatabaseRateLimit(
    orgId: string,
    userId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('update_zoho_rate_limit', {
      p_org_id: orgId,
      p_user_id: userId,
      p_tokens_used: 1
    });
    
    if (error) {
      console.error('Error checking rate limit:', error);
      return 0;
    }
    
    return data || 0;
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // HTTP status codes that are retryable
    const retryableStatuses = [408, 429, 502, 503, 504];
    if (error.status && retryableStatuses.includes(error.status)) {
      return true;
    }
    
    // Zoho-specific retryable errors
    if (error.message && (
      error.message.includes('RATE_LIMIT') ||
      error.message.includes('TEMPORARILY_UNAVAILABLE') ||
      error.message.includes('SERVER_ERROR')
    )) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Update analytics
   */
  private async updateAnalytics(
    item: QueueItem,
    success: boolean,
    responseTime: number
  ) {
    const hour = new Date().getHours();
    
    const { error } = await supabase
      .from('zoho_queue_analytics')
      .upsert({
        user_id: item.user_id,
        org_id: item.org_id,
        date: new Date().toISOString().split('T')[0],
        hour,
        endpoint: item.endpoint,
        method: item.method,
        total_requests: 1,
        successful_requests: success ? 1 : 0,
        failed_requests: success ? 0 : 1,
        rate_limited_requests: 0,
        avg_response_time_ms: responseTime
      }, {
        onConflict: 'user_id,org_id,date,hour,endpoint,method',
        // Increment counts instead of replacing
        count: 'total_requests,successful_requests,failed_requests',
        // Average the response time
        avg: 'avg_response_time_ms'
      });
    
    if (error) {
      console.error('Error updating analytics:', error);
    }
  }
  
  /**
   * Execute callback
   */
  private async executeCallback(
    callbackId: string,
    data: any,
    error?: any
  ) {
    // In a real implementation, this would notify the waiting process
    // For now, we'll store the result in a temporary table or Redis
    if (redis) {
      await redis.setex(
        `callback:${callbackId}`,
        300, // 5 minutes TTL
        JSON.stringify({ data, error })
      );
    }
  }
  
  /**
   * Get queue statistics
   */
  async getStatistics() {
    const { data, error } = await supabase
      .from('zoho_request_queue')
      .select('status, count(*)')
      .group('status');
    
    if (error) {
      console.error('Error getting queue statistics:', error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Clear completed requests older than specified days
   */
  async cleanup(daysOld: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { error } = await supabase
      .from('zoho_request_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', cutoffDate.toISOString());
    
    if (error) {
      console.error('Error cleaning up queue:', error);
    }
  }
}

// Export singleton instance
export const queueProcessor = new ZohoQueueProcessor();