import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage } from './base/types';
import { z } from 'zod';
import { QueuedZohoCRMIntegration } from '@/lib/integrations/zoho-crm-queued';
import { models, geminiHelpers } from '@/lib/gemini/client';

// Type definitions
interface ZohoDeal {
  id?: string;
  Deal_Name: string;
  Amount?: number;
  Stage: string;
  Closing_Date: string;
  Account_Name?: string;
  Contact_Name?: string;
  Probability?: number;
  Description?: string;
  Lead_Source?: string;
  Type?: string;
  Next_Step?: string;
  Owner?: string;
  Custom_Fields?: Record<string, any>;
}

interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  content: string;
  attachments?: Array<{ name: string; type: string; url: string }>;
  timestamp: Date;
  threadId?: string;
}

interface DealInfo {
  subject?: string;
  contactName?: string;
  contactEmail?: string;
  companyName?: string;
  dealType?: string;
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
  requirements?: string[];
  budget?: { amount?: number; currency?: string };
  timeline?: string;
  keywords?: string[];
}

interface SmartDefaults {
  stage: string;
  probability: number;
  estimatedAmount?: number;
  closingDate: string;
  dealType?: string;
  priority?: string;
}

interface DealTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: Partial<ZohoDeal>;
  triggers?: {
    keywords?: string[];
    sources?: string[];
    dealTypes?: string[];
  };
}

// Performance tracking interface
interface DealCreationMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  steps: Array<{
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    error?: string;
  }>;
  success: boolean;
  dealId?: string;
  source: string;
}

// Input/Output schemas
const CreateDealFromEmailSchema = z.object({
  email: z.object({
    id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    content: z.string(),
    attachments: z.array(z.object({
      name: z.string(),
      type: z.string(),
      url: z.string()
    })).optional(),
    timestamp: z.date(),
    threadId: z.string().optional()
  }),
  userId: z.string()
});

const CreateDealFromTemplateSchema = z.object({
  templateId: z.string(),
  customFields: z.record(z.any()).optional(),
  userId: z.string()
});

const QuickCreateDealSchema = z.object({
  dealName: z.string(),
  contactEmail: z.string().optional(),
  amount: z.number().optional(),
  stage: z.string().optional(),
  dealType: z.string().optional(),
  userId: z.string()
});

const DealResponseSchema = z.object({
  deal: z.object({
    id: z.string(),
    Deal_Name: z.string(),
    Stage: z.string(),
    Amount: z.number().optional(),
    Closing_Date: z.string(),
    createdAt: z.string()
  }),
  metrics: z.object({
    duration: z.number(),
    source: z.string(),
    steps: z.array(z.any())
  })
});

export class DealAutomationAgent extends Agent {
  private zoho: QueuedZohoCRMIntegration;
  private templates: Map<string, DealTemplate> = new Map();
  private metricsCache: Map<string, DealCreationMetrics> = new Map();

  constructor(config: Omit<AgentConfig, 'type'>) {
    super({
      ...config,
      type: AgentType.ORCHESTRATOR,
      name: config.name || 'Deal Automation Agent',
      description: 'Automates deal creation from emails and templates with <30 second performance'
    });

    this.initializeTemplates();
  }

  protected async onInitialize(): Promise<void> {
    // Register actions
    this.registerAction('createDealFromEmail', {
      inputSchema: CreateDealFromEmailSchema,
      outputSchema: DealResponseSchema,
      handler: this.createDealFromEmail.bind(this)
    });

    this.registerAction('createDealFromTemplate', {
      inputSchema: CreateDealFromTemplateSchema,
      outputSchema: DealResponseSchema,
      handler: this.createDealFromTemplate.bind(this)
    });

    this.registerAction('quickCreateDeal', {
      inputSchema: QuickCreateDealSchema,
      outputSchema: DealResponseSchema,
      handler: this.quickCreateDeal.bind(this)
    });

    // Initialize Zoho client - will be set when processing requests
  }

  protected async onShutdown(): Promise<void> {
    // Clean up resources
    this.metricsCache.clear();
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    // Initialize Zoho client with user ID from the request
    const userId = message.payload.userId;
    if (!this.zoho) {
      this.zoho = new QueuedZohoCRMIntegration(userId);
    }

    const handler = this.actions.get(message.action)?.handler;
    if (!handler) {
      throw new Error(`Unknown action: ${message.action}`);
    }

    return handler(message.payload);
  }

  /**
   * Create deal from email with AI extraction
   */
  async createDealFromEmail(params: z.infer<typeof CreateDealFromEmailSchema>): Promise<any> {
    const metrics: DealCreationMetrics = {
      startTime: Date.now(),
      steps: [],
      success: false,
      source: 'email'
    };

    try {
      // Step 1: Extract deal information using AI
      const extractStep = { name: 'extract_deal_info', startTime: Date.now(), success: false };
      const dealInfo = await this.extractDealInfo(params.email);
      extractStep.endTime = Date.now();
      extractStep.duration = extractStep.endTime - extractStep.startTime;
      extractStep.success = true;
      metrics.steps.push(extractStep);

      // Step 2: Get smart defaults based on patterns
      const defaultsStep = { name: 'get_smart_defaults', startTime: Date.now(), success: false };
      const defaults = await this.getSmartDefaults(dealInfo, params.userId);
      defaultsStep.endTime = Date.now();
      defaultsStep.duration = defaultsStep.endTime - defaultsStep.startTime;
      defaultsStep.success = true;
      metrics.steps.push(defaultsStep);

      // Step 3: Find or create contact
      const contactStep = { name: 'find_or_create_contact', startTime: Date.now(), success: false };
      const contactId = await this.findOrCreateContact(dealInfo, params.userId);
      contactStep.endTime = Date.now();
      contactStep.duration = contactStep.endTime - contactStep.startTime;
      contactStep.success = true;
      metrics.steps.push(contactStep);

      // Step 4: Create deal with minimal fields
      const createStep = { name: 'create_deal', startTime: Date.now(), success: false };
      const deal = await this.zoho.createDeal({
        Deal_Name: dealInfo.subject || `Deal - ${dealInfo.contactName || dealInfo.companyName}`,
        Stage: defaults.stage,
        Amount: defaults.estimatedAmount,
        Closing_Date: defaults.closingDate,
        Contact_Name: contactId,
        Probability: defaults.probability,
        Type: defaults.dealType,
        Lead_Source: 'Email',
        Description: this.formatDealDescription(dealInfo, params.email),
        Next_Step: this.suggestNextAction(dealInfo, defaults),
        Custom_Fields: this.mapCustomFields(dealInfo)
      });
      createStep.endTime = Date.now();
      createStep.duration = createStep.endTime - createStep.startTime;
      createStep.success = true;
      metrics.steps.push(createStep);

      // Step 5: Auto-link related records
      const linkStep = { name: 'link_related_records', startTime: Date.now(), success: false };
      await this.linkRelatedRecords(deal.id, params.email, params.userId);
      linkStep.endTime = Date.now();
      linkStep.duration = linkStep.endTime - linkStep.startTime;
      linkStep.success = true;
      metrics.steps.push(linkStep);

      // Complete metrics
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;
      metrics.dealId = deal.id;

      // Store metrics for analysis
      this.metricsCache.set(deal.id, metrics);

      // Emit performance event
      this.emit('deal-created', {
        dealId: deal.id,
        duration: metrics.duration,
        source: 'email'
      });

      return {
        deal: {
          id: deal.id,
          Deal_Name: deal.Deal_Name,
          Stage: deal.Stage,
          Amount: deal.Amount,
          Closing_Date: deal.Closing_Date,
          createdAt: new Date().toISOString()
        },
        metrics: {
          duration: metrics.duration,
          source: metrics.source,
          steps: metrics.steps
        }
      };
    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.steps.push({
        name: 'error',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Create deal from template
   */
  async createDealFromTemplate(params: z.infer<typeof CreateDealFromTemplateSchema>): Promise<any> {
    const template = this.templates.get(params.templateId);
    if (!template) {
      throw new Error(`Template not found: ${params.templateId}`);
    }

    const metrics: DealCreationMetrics = {
      startTime: Date.now(),
      steps: [],
      success: false,
      source: 'template'
    };

    try {
      const createStep = { name: 'create_from_template', startTime: Date.now(), success: false };
      
      const dealData = {
        ...template.fields,
        ...params.customFields,
        Closing_Date: template.fields.Closing_Date || this.calculateClosingDate(30)
      };

      const deal = await this.zoho.createDeal(dealData);
      
      createStep.endTime = Date.now();
      createStep.duration = createStep.endTime - createStep.startTime;
      createStep.success = true;
      metrics.steps.push(createStep);

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;
      metrics.dealId = deal.id;

      return {
        deal: {
          id: deal.id,
          Deal_Name: deal.Deal_Name,
          Stage: deal.Stage,
          Amount: deal.Amount,
          Closing_Date: deal.Closing_Date,
          createdAt: new Date().toISOString()
        },
        metrics: {
          duration: metrics.duration,
          source: metrics.source,
          steps: metrics.steps
        }
      };
    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      throw error;
    }
  }

  /**
   * Quick deal creation with minimal inputs
   */
  async quickCreateDeal(params: z.infer<typeof QuickCreateDealSchema>): Promise<any> {
    const metrics: DealCreationMetrics = {
      startTime: Date.now(),
      steps: [],
      success: false,
      source: 'quick'
    };

    try {
      const dealData: Partial<ZohoDeal> = {
        Deal_Name: params.dealName,
        Stage: params.stage || 'Qualification',
        Amount: params.amount,
        Type: params.dealType,
        Closing_Date: this.calculateClosingDate(30),
        Probability: this.calculateProbabilityForStage(params.stage || 'Qualification')
      };

      if (params.contactEmail) {
        const contact = await this.findContactByEmail(params.contactEmail, params.userId);
        if (contact) {
          dealData.Contact_Name = contact.id;
        }
      }

      const createStep = { name: 'quick_create', startTime: Date.now(), success: false };
      const deal = await this.zoho.createDeal(dealData);
      createStep.endTime = Date.now();
      createStep.duration = createStep.endTime - createStep.startTime;
      createStep.success = true;
      metrics.steps.push(createStep);

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;
      metrics.dealId = deal.id;

      return {
        deal: {
          id: deal.id,
          Deal_Name: deal.Deal_Name,
          Stage: deal.Stage,
          Amount: deal.Amount,
          Closing_Date: deal.Closing_Date,
          createdAt: new Date().toISOString()
        },
        metrics: {
          duration: metrics.duration,
          source: metrics.source,
          steps: metrics.steps
        }
      };
    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      throw error;
    }
  }

  /**
   * Extract deal information from email using AI
   */
  private async extractDealInfo(email: Email): Promise<DealInfo> {
    const prompt = `Extract deal information from this email:

From: ${email.from}
Subject: ${email.subject}
Content: ${email.content}

Extract the following information:
- Contact name and company
- Deal type (placement, contract, consulting, etc.)
- Urgency indicators (urgent, asap, immediate, priority)
- Key requirements or specifications
- Budget or compensation information
- Timeline or start date
- Any other relevant deal information

Return as JSON with these fields:
{
  "contactName": "string",
  "contactEmail": "string",
  "companyName": "string",
  "dealType": "string",
  "urgency": "low|medium|high|urgent",
  "requirements": ["string"],
  "budget": { "amount": number, "currency": "string" },
  "timeline": "string",
  "keywords": ["string"]
}`;

    try {
      const result = await geminiHelpers.generateStructuredData(prompt, {
        contactName: "string",
        contactEmail: "string",
        companyName: "string",
        dealType: "string",
        urgency: "low|medium|high|urgent",
        requirements: ["string"],
        budget: { amount: "number", currency: "string" },
        timeline: "string",
        keywords: ["string"]
      });
      
      return result;
    } catch (error) {
      console.error('AI extraction failed, using basic extraction:', error);
      return this.basicEmailExtraction(email);
    }
  }

  /**
   * Basic email extraction fallback
   */
  private basicEmailExtraction(email: Email): DealInfo {
    const urgencyPatterns = /urgent|asap|immediately|priority|rush/i;
    const budgetPattern = /\$[\d,]+|budget|salary|rate|compensation/i;
    const typePatterns = {
      placement: /placement|hire|hiring|position|role|candidate/i,
      contract: /contract|contractor|freelance|consultant/i,
      temp: /temp|temporary|short-term|interim/i
    };

    const urgency = urgencyPatterns.test(email.content) ? 'high' : 'medium';
    const dealType = Object.entries(typePatterns).find(([_, pattern]) => 
      pattern.test(email.content)
    )?.[0] || 'placement';

    const budgetMatch = email.content.match(/\$?([\d,]+)/);
    const budget = budgetMatch ? {
      amount: parseInt(budgetMatch[1].replace(/,/g, '')),
      currency: 'USD'
    } : undefined;

    return {
      subject: email.subject,
      contactEmail: email.from,
      dealType,
      urgency,
      budget,
      requirements: [],
      keywords: email.subject.toLowerCase().split(' ')
    };
  }

  /**
   * Get smart defaults based on deal patterns
   */
  private async getSmartDefaults(dealInfo: DealInfo, userId: string): Promise<SmartDefaults> {
    const stageMap = {
      urgent: 'Value Proposition',
      high: 'Needs Analysis',
      medium: 'Qualification',
      low: 'Qualification'
    };

    const typeAmounts = {
      placement: 25000,
      contract: 15000,
      temp: 8000,
      consulting: 20000
    };

    const closingDays = {
      urgent: 7,
      high: 14,
      medium: 30,
      low: 45
    };

    return {
      stage: stageMap[dealInfo.urgency || 'medium'],
      probability: this.calculateProbabilityForStage(stageMap[dealInfo.urgency || 'medium']),
      estimatedAmount: dealInfo.budget?.amount || typeAmounts[dealInfo.dealType || 'placement'],
      closingDate: this.calculateClosingDate(closingDays[dealInfo.urgency || 'medium']),
      dealType: dealInfo.dealType,
      priority: dealInfo.urgency === 'urgent' ? 'High' : 'Normal'
    };
  }

  /**
   * Find or create contact
   */
  private async findOrCreateContact(dealInfo: DealInfo, userId: string): Promise<string | undefined> {
    if (!dealInfo.contactEmail) return undefined;

    try {
      // Search for existing contact
      const searchResult = await this.zoho.searchRecords(
        'Contacts',
        `(Email:equals:${dealInfo.contactEmail})`,
        { page: 1, per_page: 1 }
      );

      if (searchResult.data && searchResult.data.length > 0) {
        return searchResult.data[0].id;
      }

      // Create new contact
      const nameParts = dealInfo.contactName?.split(' ') || ['Unknown', 'Contact'];
      const contact = await this.zoho.createContact({
        First_Name: nameParts[0],
        Last_Name: nameParts.slice(1).join(' ') || nameParts[0],
        Email: dealInfo.contactEmail,
        Account_Name: dealInfo.companyName
      });

      return contact.id;
    } catch (error) {
      console.error('Error finding/creating contact:', error);
      return undefined;
    }
  }

  /**
   * Link related records
   */
  private async linkRelatedRecords(dealId: string, email: Email, userId: string): Promise<void> {
    try {
      // Create activity for email
      await this.zoho.makeApiCall('/Activities', 'POST', {
        data: [{
          Subject: `Email: ${email.subject}`,
          Activity_Type: 'Emails',
          Related_To: dealId,
          Description: email.content,
          Status: 'Completed'
        }]
      });

      // Link attachments if any
      if (email.attachments && email.attachments.length > 0) {
        for (const attachment of email.attachments) {
          await this.zoho.makeApiCall(`/Deals/${dealId}/Attachments`, 'POST', {
            attachment_url: attachment.url
          });
        }
      }
    } catch (error) {
      console.error('Error linking related records:', error);
    }
  }

  /**
   * Format deal description
   */
  private formatDealDescription(dealInfo: DealInfo, email: Email): string {
    return `Deal created from email
    
Source Email:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.timestamp.toISOString()}

Extracted Information:
- Deal Type: ${dealInfo.dealType || 'Not specified'}
- Urgency: ${dealInfo.urgency || 'Normal'}
- Requirements: ${dealInfo.requirements?.join(', ') || 'None specified'}
- Timeline: ${dealInfo.timeline || 'Not specified'}
- Budget: ${dealInfo.budget ? `$${dealInfo.budget.amount} ${dealInfo.budget.currency}` : 'Not specified'}

Original Email Content:
${email.content}`;
  }

  /**
   * Suggest next action
   */
  private suggestNextAction(dealInfo: DealInfo, defaults: SmartDefaults): string {
    if (dealInfo.urgency === 'urgent') {
      return 'Schedule immediate call with client';
    }
    
    if (!dealInfo.requirements || dealInfo.requirements.length === 0) {
      return 'Gather detailed requirements from client';
    }
    
    if (!dealInfo.budget) {
      return 'Discuss budget and compensation expectations';
    }
    
    return 'Send initial candidate profiles';
  }

  /**
   * Map custom fields
   */
  private mapCustomFields(dealInfo: DealInfo): Record<string, any> {
    return {
      Urgency_Level: dealInfo.urgency,
      Keywords: dealInfo.keywords?.join(', '),
      Has_Budget: !!dealInfo.budget,
      Requirements_Count: dealInfo.requirements?.length || 0
    };
  }

  /**
   * Find contact by email
   */
  private async findContactByEmail(email: string, userId: string): Promise<any> {
    try {
      const result = await this.zoho.searchRecords(
        'Contacts',
        `(Email:equals:${email})`,
        { page: 1, per_page: 1 }
      );
      return result.data?.[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate closing date
   */
  private calculateClosingDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate probability for stage
   */
  private calculateProbabilityForStage(stage: string): number {
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

  /**
   * Initialize deal templates
   */
  private initializeTemplates(): void {
    const templates: DealTemplate[] = [
      {
        id: 'direct-placement',
        name: 'Direct Placement',
        description: 'Permanent placement opportunity',
        icon: 'UserCheck',
        fields: {
          Stage: 'Qualification',
          Type: 'Direct Placement',
          Probability: 30,
          Amount: 25000
        },
        triggers: {
          keywords: ['permanent', 'full-time', 'hire', 'placement'],
          dealTypes: ['placement']
        }
      },
      {
        id: 'contract-role',
        name: 'Contract Role',
        description: 'Contract or consulting opportunity',
        icon: 'FileText',
        fields: {
          Stage: 'Needs Analysis',
          Type: 'Contract',
          Probability: 40,
          Amount: 15000
        },
        triggers: {
          keywords: ['contract', 'consultant', 'freelance', 'hourly'],
          dealTypes: ['contract', 'consulting']
        }
      },
      {
        id: 'executive-search',
        name: 'Executive Search',
        description: 'C-level or senior executive placement',
        icon: 'Briefcase',
        fields: {
          Stage: 'Qualification',
          Type: 'Executive Search',
          Probability: 25,
          Amount: 50000
        },
        triggers: {
          keywords: ['executive', 'ceo', 'cfo', 'cto', 'vp', 'director'],
          dealTypes: ['executive']
        }
      },
      {
        id: 'temp-staffing',
        name: 'Temporary Staffing',
        description: 'Short-term or temporary placement',
        icon: 'Clock',
        fields: {
          Stage: 'Value Proposition',
          Type: 'Temporary',
          Probability: 50,
          Amount: 8000
        },
        triggers: {
          keywords: ['temp', 'temporary', 'short-term', 'interim'],
          dealTypes: ['temp', 'temporary']
        }
      },
      {
        id: 'urgent-need',
        name: 'Urgent Requirement',
        description: 'High-priority placement need',
        icon: 'AlertCircle',
        fields: {
          Stage: 'Value Proposition',
          Type: 'Urgent Placement',
          Probability: 60,
          Next_Step: 'Immediate candidate sourcing'
        },
        triggers: {
          keywords: ['urgent', 'asap', 'immediate', 'priority', 'rush']
        }
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageDuration: number;
    successRate: number;
    totalDeals: number;
    bySource: Record<string, { count: number; avgDuration: number }>;
  } {
    const metrics = Array.from(this.metricsCache.values());
    
    if (metrics.length === 0) {
      return {
        averageDuration: 0,
        successRate: 0,
        totalDeals: 0,
        bySource: {}
      };
    }

    const successful = metrics.filter(m => m.success);
    const bySource = metrics.reduce((acc, m) => {
      if (!acc[m.source]) {
        acc[m.source] = { count: 0, totalDuration: 0 };
      }
      acc[m.source].count++;
      acc[m.source].totalDuration += m.duration || 0;
      return acc;
    }, {} as Record<string, { count: number; totalDuration: number }>);

    const sourceMetrics = Object.entries(bySource).reduce((acc, [source, data]) => {
      acc[source] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count
      };
      return acc;
    }, {} as Record<string, { count: number; avgDuration: number }>);

    return {
      averageDuration: successful.reduce((sum, m) => sum + (m.duration || 0), 0) / successful.length,
      successRate: (successful.length / metrics.length) * 100,
      totalDeals: metrics.length,
      bySource: sourceMetrics
    };
  }

  /**
   * Clear old metrics (keep last 100)
   */
  private cleanupMetrics(): void {
    if (this.metricsCache.size > 100) {
      const entries = Array.from(this.metricsCache.entries());
      const toRemove = entries.slice(0, entries.length - 100);
      toRemove.forEach(([key]) => this.metricsCache.delete(key));
    }
  }
}