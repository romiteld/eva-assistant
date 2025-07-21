import { getAuthenticatedAPI } from '@/lib/services/authenticated-api';
import { getTokenManager } from '@/lib/auth/token-manager';
import { Database } from '@/types/supabase';
import { supabase } from '@/lib/supabase/browser';
import { ZohoLead, ZohoContact, ZohoDeal, ZohoWebhookPayload } from '@/types/zoho';


export class ZohoCRMIntegration {
  protected api: ReturnType<typeof getAuthenticatedAPI>;
  private supabase = supabase;
  private webhookToken: string;
  
  constructor(
    encryptionKey: string,
    webhookToken: string
  ) {
    this.api = getAuthenticatedAPI(
      encryptionKey,
      {
        zoho: {
          tokenUrl: '/api/oauth/refresh',
          clientId: process.env.ZOHO_CLIENT_ID || '',
          clientSecret: '' // Empty - handled server-side
        }
      }
    );
    this.webhookToken = webhookToken;
  }

  // Lead Management
  async createLead(userId: string, leadData: ZohoLead): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(userId, '/Leads', {
        method: 'POST',
        body: JSON.stringify({
          data: [{
            ...leadData,
            Lead_Score: leadData.Lead_Score || await this.calculateLeadScore(leadData)
          }],
          trigger: ['approval', 'workflow', 'blueprint']
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create lead: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Store in local database for quick access
      await this.syncLeadToDatabase(userId, result.data[0]);
      
      return result.data[0];
    } catch (error) {
      console.error('Error creating Zoho lead:', error);
      throw error;
    }
  }

  async bulkCreateLeads(userId: string, leads: ZohoLead[]): Promise<any> {
    try {
      // Zoho allows max 100 records per request
      const chunks = this.chunkArray(leads, 100);
      const results = [];

      for (const chunk of chunks) {
        const response = await this.api.zohoCRMAPI(userId, '/Leads', {
          method: 'POST',
          body: JSON.stringify({
            data: chunk.map(lead => ({
              ...lead,
              Lead_Score: lead.Lead_Score || this.calculateLeadScore(lead)
            })),
            trigger: ['approval', 'workflow', 'blueprint']
          })
        });

        if (!response.ok) {
          console.error('Failed to create batch of leads');
          continue;
        }

        const result = await response.json();
        results.push(...result.data);
        
        // Sync to database
        for (const lead of result.data) {
          await this.syncLeadToDatabase(userId, lead);
        }
      }

      return results;
    } catch (error) {
      console.error('Error bulk creating leads:', error);
      throw error;
    }
  }

  async getLeads(userId: string, params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string[];
    criteria?: string;
  }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.perPage) queryParams.append('per_page', params.perPage.toString());
      if (params?.sortBy) queryParams.append('sort_by', params.sortBy);
      if (params?.sortOrder) queryParams.append('sort_order', params.sortOrder);
      if (params?.fields) queryParams.append('fields', params.fields.join(','));
      if (params?.criteria) queryParams.append('criteria', params.criteria);

      const response = await this.api.zohoCRMAPI(
        userId, 
        `/Leads${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get leads: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting leads:', error);
      throw error;
    }
  }

  async updateLead(userId: string, leadId: string, updates: Partial<ZohoLead>): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(userId, '/Leads', {
        method: 'PUT',
        body: JSON.stringify({
          data: [{
            id: leadId,
            ...updates
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update lead: ${response.statusText}`);
      }

      const result = await response.json();
      await this.syncLeadToDatabase(userId, result.data[0]);
      
      return result.data[0];
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  }

  async convertLead(userId: string, leadId: string, conversionData: {
    assign_to?: string;
    deal?: Partial<ZohoDeal>;
    notify_lead_owner?: boolean;
    notify_new_owner?: boolean;
  }): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(userId, `/Leads/${leadId}/actions/convert`, {
        method: 'POST',
        body: JSON.stringify({
          data: [conversionData]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert lead: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error converting lead:', error);
      throw error;
    }
  }

  // Contact Management
  async createContact(userId: string, contactData: ZohoContact): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(userId, '/Contacts', {
        method: 'POST',
        body: JSON.stringify({
          data: [contactData]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create contact: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data[0];
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  // Deal Management
  async createDeal(userId: string, dealData: ZohoDeal): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(userId, '/Deals', {
        method: 'POST',
        body: JSON.stringify({
          data: [{
            ...dealData,
            Probability: dealData.Probability || this.calculateDealProbability(dealData.Stage || 'Qualification')
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create deal: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Track deal in analytics
      await this.trackDealCreation(userId, result.data[0]);
      
      return result.data[0];
    } catch (error) {
      console.error('Error creating deal:', error);
      throw error;
    }
  }

  async updateDealStage(userId: string, dealId: string, newStage: string): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(userId, '/Deals', {
        method: 'PUT',
        body: JSON.stringify({
          data: [{
            id: dealId,
            Stage: newStage,
            Probability: this.calculateDealProbability(newStage)
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update deal stage: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Track stage change
      await this.trackStageChange(userId, dealId, newStage);
      
      return result.data[0];
    } catch (error) {
      console.error('Error updating deal stage:', error);
      throw error;
    }
  }

  // Webhook handling
  async handleWebhook(payload: ZohoWebhookPayload, token: string): Promise<void> {
    // Verify webhook token
    if (token !== this.webhookToken) {
      throw new Error('Invalid webhook token');
    }

    console.log(`Received Zoho webhook: ${payload.module} - ${payload.operation}`);

    try {
      switch (payload.module) {
        case 'Leads':
          await this.handleLeadWebhook(payload);
          break;
        case 'Contacts':
          await this.handleContactWebhook(payload);
          break;
        case 'Deals':
          await this.handleDealWebhook(payload);
          break;
        default:
          console.log(`Unhandled module: ${payload.module}`);
      }

      // Log webhook event
      await this.supabase
        .from('webhook_events')
        .insert({
          source: 'zoho_crm',
          event_type: `${payload.module.toLowerCase()}.${payload.operation}`,
          payload: payload,
          processed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  private async handleLeadWebhook(payload: ZohoWebhookPayload): Promise<void> {
    switch (payload.operation) {
      case 'insert':
        // New lead created - trigger lead scoring and assignment
        for (const leadId of payload.ids) {
          await this.processNewLead(leadId);
        }
        break;
      
      case 'update':
        // Lead updated - check for status changes
        for (const leadId of payload.ids) {
          await this.processLeadUpdate(leadId, payload.data);
        }
        break;
      
      case 'delete':
        // Lead deleted - cleanup local records
        for (const leadId of payload.ids) {
          await this.cleanupDeletedLead(leadId);
        }
        break;
    }
  }

  private async handleContactWebhook(payload: ZohoWebhookPayload): Promise<void> {
    // Handle contact-related webhooks
    console.log('Processing contact webhook:', payload);
  }

  private async handleDealWebhook(payload: ZohoWebhookPayload): Promise<void> {
    switch (payload.operation) {
      case 'update':
        // Check for stage changes
        if (payload.data?.Stage) {
          for (const dealId of payload.ids) {
            await this.processDealStageChange(dealId, payload.data.Stage);
          }
        }
        break;
    }
  }

  // Advanced features
  async searchRecords(userId: string, module: string, searchCriteria: {
    word?: string;
    email?: string;
    phone?: string;
    criteria?: string;
  }): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (searchCriteria.word) params.append('word', searchCriteria.word);
      if (searchCriteria.email) params.append('email', searchCriteria.email);
      if (searchCriteria.phone) params.append('phone', searchCriteria.phone);
      if (searchCriteria.criteria) params.append('criteria', searchCriteria.criteria);

      const response = await this.api.zohoCRMAPI(
        userId,
        `/${module}/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error searching records:', error);
      throw error;
    }
  }

  async getBlueprintTransition(userId: string, module: string, recordId: string): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(
        userId,
        `/${module}/${recordId}/actions/blueprint`
      );

      if (!response.ok) {
        throw new Error(`Failed to get blueprint: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting blueprint:', error);
      throw error;
    }
  }

  // Analytics and Reporting
  async getAnalytics(userId: string, module: string, analyticsType: string): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(
        userId,
        `/${module}/actions/analytics?type=${analyticsType}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  // Helper methods
  private async calculateLeadScore(lead: ZohoLead): Promise<number> {
    let score = 50; // Base score

    // Score based on completeness
    if (lead.Email) score += 10;
    if (lead.Phone) score += 10;
    if (lead.Company) score += 10;
    if (lead.Title) score += 5;
    if (lead.LinkedIn) score += 15;
    
    // Score based on quality indicators
    if (lead.Annual_Revenue && lead.Annual_Revenue > 1000000) score += 20;
    if (lead.Industry) score += 5;
    if (lead.Website) score += 10;

    return Math.min(score, 100);
  }

  private calculateDealProbability(stage: string): number {
    const stageProbabilities: Record<string, number> = {
      'Qualification': 10,
      'Needs Analysis': 20,
      'Value Proposition': 40,
      'Proposal/Quote': 60,
      'Negotiation': 80,
      'Closed Won': 100,
      'Closed Lost': 0
    };

    return stageProbabilities[stage] || 50;
  }

  private async syncLeadToDatabase(userId: string, lead: any): Promise<void> {
    try {
      await this.supabase
        .from('zoho_leads_cache')
        .upsert({
          zoho_id: lead.id,
          user_id: userId,
          data: lead,
          last_synced: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error syncing lead to database:', error);
    }
  }

  private async processNewLead(leadId: string): Promise<void> {
    // Implement lead processing logic
    console.log(`Processing new lead: ${leadId}`);
    
    // Trigger AI lead scoring
    // Assign to appropriate sales rep
    // Send welcome email
  }

  private async processLeadUpdate(leadId: string, changes: any): Promise<void> {
    console.log(`Processing lead update: ${leadId}`, changes);
    
    // Check for important changes
    if (changes.Lead_Status === 'Qualified') {
      // Trigger qualified lead workflow
    }
  }

  private async cleanupDeletedLead(leadId: string): Promise<void> {
    await this.supabase
      .from('zoho_leads_cache')
      .delete()
      .eq('zoho_id', leadId);
  }

  private async trackDealCreation(userId: string, deal: any): Promise<void> {
    await this.supabase
      .from('sales_analytics')
      .insert({
        user_id: userId,
        event_type: 'deal_created',
        deal_id: deal.id,
        amount: deal.Amount,
        stage: deal.Stage,
        metadata: deal
      });
  }

  private async trackStageChange(userId: string, dealId: string, newStage: string): Promise<void> {
    await this.supabase
      .from('sales_analytics')
      .insert({
        user_id: userId,
        event_type: 'stage_changed',
        deal_id: dealId,
        metadata: { new_stage: newStage }
      });
  }

  private async processDealStageChange(dealId: string, newStage: string): Promise<void> {
    console.log(`Deal ${dealId} moved to stage: ${newStage}`);
    
    if (newStage === 'Closed Won') {
      // Trigger celebration workflow
      // Update revenue forecasts
      // Notify team
    }
  }

  protected chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Bulk operations
  async bulkUpdateRecords(userId: string, module: string, updates: Array<{
    id: string;
    data: any;
  }>): Promise<any> {
    try {
      const chunks = this.chunkArray(updates, 100);
      const results = [];

      for (const chunk of chunks) {
        const response = await this.api.zohoCRMAPI(userId, `/${module}`, {
          method: 'PUT',
          body: JSON.stringify({
            data: chunk.map(update => ({
              id: update.id,
              ...update.data
            }))
          })
        });

        if (!response.ok) {
          console.error('Failed to update batch');
          continue;
        }

        const result = await response.json();
        results.push(...result.data);
      }

      return results;
    } catch (error) {
      console.error('Error bulk updating records:', error);
      throw error;
    }
  }

  // Custom fields and layouts
  async getModuleFields(userId: string, module: string): Promise<any> {
    try {
      const response = await this.api.zohoCRMAPI(
        userId,
        `/settings/fields?module=${module}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get fields: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting module fields:', error);
      throw error;
    }
  }
}