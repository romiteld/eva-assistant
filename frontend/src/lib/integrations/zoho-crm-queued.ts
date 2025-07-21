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
  
  constructor(encryptionKey: string, webhookToken: string) {
    super(encryptionKey, webhookToken);
  }
  
  /**
   * Override makeApiCall to use queue system
   */
  async makeApiCall(
    userId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.addRequest(
        userId,
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
  async getLeads(userId: string, params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string[];
    criteria?: string;
  }): Promise<{ data: ZohoLead[]; info: any }> {
    const cacheKey = `/Leads?${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.getLeads(userId, params)
    );
  }
  
  /**
   * Get contacts with caching
   */
  async getContacts(userId: string, params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string[];
    criteria?: string;
  }): Promise<{ data: ZohoContact[]; info: any }> {
    const cacheKey = `/Contacts?${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => this.getContactsBase(userId, params)
    );
  }

  private async getContactsBase(userId: string, params?: any): Promise<{ data: ZohoContact[]; info: any }> {
    // This method doesn't exist in base class, implement basic functionality
    const response = await this.api.zohoCRMAPI(userId, '/Contacts');
    return response.json();
  }
  
  /**
   * Get deals with caching
   */
  async getDeals(userId: string, params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string[];
    criteria?: string;
  }): Promise<{ data: ZohoDeal[]; info: any }> {
    const cacheKey = `/Deals?${JSON.stringify(params || {})}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => this.getDealsBase(userId, params)
    );
  }

  private async getDealsBase(userId: string, params?: any): Promise<{ data: ZohoDeal[]; info: any }> {
    // This method doesn't exist in base class, implement basic functionality
    const response = await this.api.zohoCRMAPI(userId, '/Deals');
    return response.json();
  }
  
  /**
   * Create lead with cache invalidation
   */
  async createLead(userId: string, leadData: ZohoLead): Promise<any> {
    const result = await super.createLead(userId, leadData);
    
    // Invalidate lead caches
    await this.cache.invalidateModule('Leads');
    
    return result;
  }
  
  /**
   * Create deal with cache invalidation
   */
  async createDeal(userId: string, dealData: ZohoDeal): Promise<any> {
    const result = await super.createDeal(userId, dealData);
    
    // Invalidate deal caches
    await this.cache.invalidateModule('Deals');
    
    return result;
  }
  
  /**
   * Bulk create with optimized batching
   */
  async bulkCreate<T>(
    userId: string,
    module: string,
    records: T[],
    options?: { triggerWorkflow?: boolean }
  ): Promise<any> {
    // Zoho allows max 100 records per bulk operation
    const chunks = this.chunkArray(records, 100);
    const results = [];
    
    for (const chunk of chunks) {
      const result = await this.makeApiCall(
        userId,
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
    userId: string,
    module: string,
    searchCriteria: {
      word?: string;
      email?: string;
      phone?: string;
      criteria?: string;
    }
  ): Promise<any> {
    const cacheKey = `/${module}/search?${JSON.stringify(searchCriteria)}`;
    
    return this.cache.getWithRevalidation(
      cacheKey,
      () => super.searchRecords(userId, module, searchCriteria)
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
      () => this.getModuleFields('default-user', module)
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
  async warmUpCache(userId: string, modules: string[] = ['Leads', 'Contacts', 'Deals']) {
    await this.cache.warmUp(userId, modules);
  }
  
  /**
   * Clear all caches for this user
   */
  async clearCache() {
    await this.cache.clear();
  }
}