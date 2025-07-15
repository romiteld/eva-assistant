import { ZohoCRMIntegration } from './zoho-crm';
import { getZohoQueue } from '@/lib/zoho/api-queue';
import { getZohoCache } from '@/lib/zoho/cache-manager';
import { ZohoLead, ZohoContact, ZohoDeal } from '@/types/zoho';

/**
 * Enhanced Zoho CRM Integration with Queue and Cache
 * This wrapper adds queue management and caching to all Zoho API calls
 */
export class QueuedZohoCRMIntegration extends ZohoCRMIntegration {
  private queue = getZohoQueue();
  private cache = getZohoCache();
  
  constructor(userId: string) {
    super(userId);
  }
  
  /**
   * Override makeApiCall to use queue system
   */
  async makeApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.addRequest(
        this.userId,
        endpoint,
        method,
        data,
        {
          priority: this.getPriorityForEndpoint(endpoint),
          callback: resolve,
          onError: reject,
        }
      );
    });
  }
  
  /**
   * Get leads with caching
   */
  async getLeads(params?: {
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<{ data: ZohoLead[]; info: any }> {
    const cacheKey = `/Leads?${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.getLeads(params)
    );
  }
  
  /**
   * Get contacts with caching
   */
  async getContacts(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ data: ZohoContact[]; info: any }> {
    const cacheKey = `/Contacts?${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.getContacts(params)
    );
  }
  
  /**
   * Get deals with caching
   */
  async getDeals(params?: {
    page?: number;
    per_page?: number;
    stage?: string;
  }): Promise<{ data: ZohoDeal[]; info: any }> {
    const cacheKey = `/Deals?${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.getDeals(params)
    );
  }
  
  /**
   * Create lead with cache invalidation
   */
  async createLead(leadData: Partial<ZohoLead>): Promise<any> {
    const result = await super.createLead(leadData);
    
    // Invalidate lead caches
    await this.cache.invalidateModule('Leads');
    
    return result;
  }
  
  /**
   * Create deal with cache invalidation
   */
  async createDeal(dealData: Partial<ZohoDeal>): Promise<any> {
    const result = await super.createDeal(dealData);
    
    // Invalidate deal caches
    await this.cache.invalidateModule('Deals');
    
    return result;
  }
  
  /**
   * Bulk create with optimized batching
   */
  async bulkCreate<T>(
    module: string,
    records: T[],
    options?: { triggerWorkflow?: boolean }
  ): Promise<any> {
    // Zoho allows max 100 records per bulk operation
    const chunks = this.chunkArray(records, 100);
    const results = [];
    
    for (const chunk of chunks) {
      const result = await this.makeApiCall(
        `/${module}`,
        'POST',
        {
          data: chunk,
          trigger: options?.triggerWorkflow ? ['workflow'] : []
        }
      );
      results.push(result);
    }
    
    // Invalidate module cache
    await this.cache.invalidateModule(module);
    
    return results;
  }
  
  /**
   * Smart search with caching
   */
  async searchRecords(
    module: string,
    criteria: string,
    params?: {
      page?: number;
      per_page?: number;
    }
  ): Promise<any> {
    const cacheKey = `/${module}/search?criteria=${criteria}&${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.searchRecords(module, criteria, params)
    );
  }
  
  /**
   * Get field metadata with long-term caching
   */
  async getFields(module: string): Promise<any> {
    const cacheKey = `/settings/fields?module=${module}`;
    
    // Field metadata rarely changes, use 1 hour cache
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.getFields(module)
    );
  }
  
  /**
   * Determine priority based on endpoint
   */
  private getPriorityForEndpoint(endpoint: string): number {
    // Critical operations get higher priority (lower number)
    if (endpoint.includes('/Deals') && endpoint.includes('POST')) return 1;
    if (endpoint.includes('/Leads') && endpoint.includes('POST')) return 2;
    if (endpoint.includes('webhook')) return 2;
    
    // Updates are medium priority
    if (endpoint.includes('PUT')) return 5;
    
    // Reads are lower priority
    if (endpoint.includes('GET')) return 7;
    
    // Bulk operations are lowest priority
    if (endpoint.includes('bulk')) return 9;
    
    return 5; // Default priority
  }
  
  /**
   * Helper to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Get queue status
   */
  async getQueueStatus() {
    return this.queue.getQueueStatus();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Warm up cache with common data
   */
  async warmUpCache(modules: string[] = ['Leads', 'Contacts', 'Deals']) {
    await this.cache.warmUp(this.userId, modules);
  }
  
  /**
   * Clear all caches for this user
   */
  async clearCache() {
    await this.cache.clear();
  }
}