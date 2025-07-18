import { createClient } from '@/lib/supabase/browser';

export type QueueName = 
  | 'email-send'
  | 'lead-enrichment'
  | 'agent-execution'
  | 'webhook-delivery'
  | 'document-processing'
  | 'notification';

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface QueueItem {
  id: string;
  queue_name: QueueName;
  user_id?: string;
  payload: any;
  priority: number;
  status: QueueStatus;
  retry_count: number;
  max_retries: number;
  scheduled_at: string;
  processed_at?: string;
  completed_at?: string;
  error_message?: string;
  result?: any;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QueueConfig {
  queue_name: QueueName;
  description: string;
  is_active: boolean;
  max_concurrency: number;
  retry_delay_ms: number;
  max_retries: number;
  retention_days: number;
  metadata?: Record<string, any>;
}

export interface QueueHealth {
  queue_name: string;
  pending_items: number;
  processing_items: number;
  failed_items: number;
  success_rate: number;
  avg_wait_time_seconds: number;
  oldest_pending_item?: string;
}

export interface AddToQueueOptions {
  priority?: number; // 1-10, higher is more important
  delay?: number; // milliseconds to delay execution
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export class QueueManager {
  private supabase;
  private processorUrl: string;

  constructor() {
    this.supabase = createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    }
    this.processorUrl = supabaseUrl.replace(/\/$/, '') + '/functions/v1/queue-processor';
  }

  // Add item to queue
  async addToQueue<T = any>(
    queueName: QueueName,
    payload: T,
    options?: AddToQueueOptions
  ): Promise<QueueItem> {
    const { data: user } = await this.supabase.auth.getUser();
    
    const response = await fetch(`${this.processorUrl}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        queue: queueName,
        payload,
        userId: user.user?.id,
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add to queue: ${response.statusText}`);
    }

    const result = await response.json();
    return result.item;
  }

  // Get queue items
  async getQueueItems(
    queueName?: QueueName,
    status?: QueueStatus,
    limit = 50
  ): Promise<QueueItem[]> {
    let query = this.supabase
      .from('queue_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (queueName) {
      query = query.eq('queue_name', queueName);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as QueueItem[];
  }

  // Get queue health metrics
  async getQueueHealth(queueName?: QueueName): Promise<QueueHealth[]> {
    const { data, error } = await this.supabase
      .rpc('get_queue_health', { p_queue_name: queueName });

    if (error) throw error;
    return data as QueueHealth[];
  }

  // Get queue configuration
  async getQueueConfig(queueName?: QueueName): Promise<QueueConfig[]> {
    let query = this.supabase
      .from('queue_config')
      .select('*');

    if (queueName) {
      query = query.eq('queue_name', queueName);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as QueueConfig[];
  }

  // Cancel a queue item
  async cancelQueueItem(itemId: string): Promise<void> {
    const { error } = await this.supabase
      .from('queue_items')
      .update({ status: 'cancelled' })
      .eq('id', itemId)
      .eq('status', 'pending'); // Only cancel pending items

    if (error) throw error;
  }

  // Retry a failed item
  async retryQueueItem(itemId: string): Promise<void> {
    const { error } = await this.supabase
      .from('queue_items')
      .update({ 
        status: 'pending',
        scheduled_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', itemId)
      .eq('status', 'failed');

    if (error) throw error;
  }

  // Process a specific queue manually
  async processQueue(queueName: QueueName): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const response = await fetch(`${this.processorUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ queueName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to process queue: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  // Subscribe to queue updates
  subscribeToQueue(
    queueName: QueueName,
    callback: (payload: any) => void
  ) {
    return this.supabase
      .channel(`queue:${queueName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_items',
          filter: `queue_name=eq.${queueName}`,
        },
        callback
      )
      .subscribe();
  }

  // Queue-specific helper methods

  // Email queue
  async queueEmail(emailData: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: any[];
  }, options?: AddToQueueOptions): Promise<QueueItem> {
    return this.addToQueue('email-send', emailData, options);
  }

  // Lead enrichment queue
  async queueLeadEnrichment(leadData: {
    leadId: string;
    source: string;
    data: any;
  }, options?: AddToQueueOptions): Promise<QueueItem> {
    return this.addToQueue('lead-enrichment', leadData, {
      priority: 7,
      ...options,
    });
  }

  // Agent execution queue
  async queueAgentExecution(agentData: {
    agentId: string;
    payload: any;
  }, options?: AddToQueueOptions): Promise<QueueItem> {
    return this.addToQueue('agent-execution', agentData, {
      priority: 8,
      ...options,
    });
  }

  // Webhook delivery queue
  async queueWebhookDelivery(webhookData: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body: any;
    retryConfig?: {
      maxRetries?: number;
      retryDelay?: number;
    };
  }, options?: AddToQueueOptions): Promise<QueueItem> {
    return this.addToQueue('webhook-delivery', webhookData, {
      maxRetries: webhookData.retryConfig?.maxRetries || 5,
      ...options,
    });
  }

  // Get dead letter queue items
  async getDeadLetterItems(queueName?: QueueName, limit = 50): Promise<any[]> {
    let query = this.supabase
      .from('queue_dead_letter')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (queueName) {
      query = query.eq('queue_name', queueName);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // Reprocess dead letter item
  async reprocessDeadLetterItem(deadLetterId: string): Promise<QueueItem> {
    // Get the dead letter item
    const { data: deadLetter, error: fetchError } = await this.supabase
      .from('queue_dead_letter')
      .select('*')
      .eq('id', deadLetterId)
      .single();

    if (fetchError) throw fetchError;

    // Add back to queue
    const newItem = await this.addToQueue(
      deadLetter.queue_name,
      deadLetter.payload,
      {
        priority: 10, // High priority for retry
        metadata: {
          reprocessedFrom: deadLetterId,
          originalItemId: deadLetter.original_item_id,
        },
      }
    );

    // Delete from dead letter queue
    const { error: deleteError } = await this.supabase
      .from('queue_dead_letter')
      .delete()
      .eq('id', deadLetterId);

    if (deleteError) throw deleteError;

    return newItem;
  }
}

// Export singleton instance
export const queueManager = new QueueManager();