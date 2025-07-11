import { AgentType } from '../agents/base/types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{
    id: string;
    agent: AgentType;
    action: string;
    input: any;
    dependencies?: string[];
    condition?: {
      type: 'always' | 'on_success' | 'on_failure' | 'custom';
      expression?: string;
    };
  }>;
  requiredContext?: string[];
}

export class WorkflowTemplates {
  private static templates: Map<string, WorkflowTemplate> = new Map();

  static {
    // Initialize built-in templates
    this.registerTemplate({
      id: 'web-research',
      name: 'Web Research and Analysis',
      description: 'Research a topic online and generate comprehensive insights',
      category: 'research',
      steps: [
        {
          id: 'search',
          agent: AgentType.SCRAPING,
          action: 'search_web',
          input: {
            query: '{{topic}}',
            limit: 10,
          },
        },
        {
          id: 'scrape',
          agent: AgentType.SCRAPING,
          action: 'batch_scrape',
          input: {
            urls: '{{search.urls}}',
            onlyMainContent: true,
          },
          dependencies: ['search'],
        },
        {
          id: 'analyze',
          agent: AgentType.ANALYSIS,
          action: 'analyze_text',
          input: {
            text: '{{scrape.content}}',
            analysisType: 'comprehensive',
          },
          dependencies: ['scrape'],
        },
        {
          id: 'insights',
          agent: AgentType.ANALYSIS,
          action: 'generate_insights',
          input: {
            data: '{{analyze.results}}',
            context: 'Web research on {{topic}}',
          },
          dependencies: ['analyze'],
        },
      ],
      requiredContext: ['topic'],
    });

    this.registerTemplate({
      id: 'email-campaign',
      name: 'Email Campaign',
      description: 'Create and send an email campaign with analytics',
      category: 'marketing',
      steps: [
        {
          id: 'generate_content',
          agent: AgentType.CONTENT,
          action: 'generate_content',
          input: {
            topic: '{{campaign_topic}}',
            platform: 'email',
            tone: '{{tone}}',
          },
        },
        {
          id: 'personalize',
          agent: AgentType.ANALYSIS,
          action: 'analyze_text',
          input: {
            text: '{{generate_content.content}}',
            context: 'Personalize for {{audience}}',
          },
          dependencies: ['generate_content'],
        },
        {
          id: 'send_emails',
          agent: AgentType.COMMUNICATION,
          action: 'send_email',
          input: {
            to: '{{recipients}}',
            subject: '{{subject}}',
            body: '{{personalize.output}}',
          },
          dependencies: ['personalize'],
        },
        {
          id: 'track_analytics',
          agent: AgentType.CONTENT,
          action: 'get_analytics',
          input: {
            platform: 'email',
            metrics: ['opens', 'clicks', 'conversions'],
            startDate: '{{send_emails.timestamp}}',
            endDate: '{{now}}',
          },
          dependencies: ['send_emails'],
          condition: {
            type: 'custom',
            expression: 'state.delay > 3600000', // Wait 1 hour
          },
        },
      ],
      requiredContext: ['campaign_topic', 'tone', 'audience', 'recipients', 'subject'],
    });

    this.registerTemplate({
      id: 'meeting-scheduler',
      name: 'Smart Meeting Scheduler',
      description: 'Schedule a meeting with multiple participants and send invites',
      category: 'productivity',
      steps: [
        {
          id: 'find_slots',
          agent: AgentType.CALENDAR,
          action: 'find_free_slots',
          input: {
            participants: '{{participants}}',
            duration: '{{duration}}',
            startDate: '{{start_date}}',
            endDate: '{{end_date}}',
          },
        },
        {
          id: 'schedule_meeting',
          agent: AgentType.CALENDAR,
          action: 'schedule_meeting',
          input: {
            title: '{{meeting_title}}',
            participants: '{{participants}}',
            duration: '{{duration}}',
            preferredTimes: '{{find_slots.slots}}',
            agenda: '{{agenda}}',
          },
          dependencies: ['find_slots'],
        },
        {
          id: 'send_invites',
          agent: AgentType.COMMUNICATION,
          action: 'send_email',
          input: {
            to: '{{participants}}',
            subject: 'Meeting Invitation: {{meeting_title}}',
            body: 'You are invited to {{meeting_title}} at {{schedule_meeting.scheduledTime}}',
          },
          dependencies: ['schedule_meeting'],
        },
      ],
      requiredContext: ['participants', 'duration', 'meeting_title', 'agenda', 'start_date', 'end_date'],
    });

    this.registerTemplate({
      id: 'social-media-post',
      name: 'Multi-Platform Social Media Post',
      description: 'Create and publish content across multiple social media platforms',
      category: 'marketing',
      steps: [
        {
          id: 'generate_base_content',
          agent: AgentType.CONTENT,
          action: 'generate_content',
          input: {
            topic: '{{topic}}',
            platform: 'blog',
            tone: '{{tone}}',
            includeHashtags: true,
          },
        },
        {
          id: 'adapt_twitter',
          agent: AgentType.CONTENT,
          action: 'generate_content',
          input: {
            topic: '{{generate_base_content.content}}',
            platform: 'twitter',
            length: 'short',
          },
          dependencies: ['generate_base_content'],
        },
        {
          id: 'adapt_linkedin',
          agent: AgentType.CONTENT,
          action: 'generate_content',
          input: {
            topic: '{{generate_base_content.content}}',
            platform: 'linkedin',
            tone: 'professional',
          },
          dependencies: ['generate_base_content'],
        },
        {
          id: 'post_twitter',
          agent: AgentType.CONTENT,
          action: 'create_post',
          input: {
            platform: 'twitter',
            content: '{{adapt_twitter.content}}',
            hashtags: '{{adapt_twitter.hashtags}}',
          },
          dependencies: ['adapt_twitter'],
        },
        {
          id: 'post_linkedin',
          agent: AgentType.CONTENT,
          action: 'create_post',
          input: {
            platform: 'linkedin',
            content: '{{adapt_linkedin.content}}',
            hashtags: '{{adapt_linkedin.hashtags}}',
          },
          dependencies: ['adapt_linkedin'],
        },
      ],
      requiredContext: ['topic', 'tone'],
    });

    this.registerTemplate({
      id: 'data-backup-analysis',
      name: 'Database Backup and Analysis',
      description: 'Backup database and analyze data trends',
      category: 'data',
      steps: [
        {
          id: 'backup',
          agent: AgentType.DATA,
          action: 'backup_data',
          input: {
            tables: '{{tables}}',
            format: 'json',
            compress: true,
          },
        },
        {
          id: 'analyze_users',
          agent: AgentType.DATA,
          action: 'analyze_data',
          input: {
            table: 'users',
            analysisType: 'trends',
            timeColumn: 'created_at',
          },
          condition: {
            type: 'custom',
            expression: 'state.tables.includes("users")',
          },
        },
        {
          id: 'generate_report',
          agent: AgentType.ANALYSIS,
          action: 'generate_insights',
          input: {
            data: {
              backup: '{{backup.summary}}',
              analysis: '{{analyze_users.results}}',
            },
            focusAreas: ['growth', 'engagement', 'retention'],
          },
          dependencies: ['backup', 'analyze_users'],
        },
        {
          id: 'send_report',
          agent: AgentType.COMMUNICATION,
          action: 'send_email',
          input: {
            to: '{{admin_email}}',
            subject: 'Database Backup and Analysis Report',
            body: '{{generate_report.summary}}',
          },
          dependencies: ['generate_report'],
        },
      ],
      requiredContext: ['tables', 'admin_email'],
    });

    this.registerTemplate({
      id: 'competitive-analysis',
      name: 'Competitive Analysis',
      description: 'Analyze competitors and generate insights',
      category: 'research',
      steps: [
        {
          id: 'map_competitor_sites',
          agent: AgentType.SCRAPING,
          action: 'map_website',
          input: {
            url: '{{competitor_url}}',
            limit: 50,
          },
        },
        {
          id: 'scrape_key_pages',
          agent: AgentType.SCRAPING,
          action: 'batch_scrape',
          input: {
            urls: '{{map_competitor_sites.urls}}',
            onlyMainContent: true,
          },
          dependencies: ['map_competitor_sites'],
        },
        {
          id: 'extract_products',
          agent: AgentType.SCRAPING,
          action: 'extract_data',
          input: {
            urls: '{{scrape_key_pages.productPages}}',
            prompt: 'Extract product names, prices, and features',
            schema: {
              product: 'string',
              price: 'number',
              features: 'array',
            },
          },
          dependencies: ['scrape_key_pages'],
        },
        {
          id: 'analyze_sentiment',
          agent: AgentType.ANALYSIS,
          action: 'sentiment_analysis',
          input: {
            text: '{{scrape_key_pages.reviews}}',
            granularity: 'aspect',
          },
          dependencies: ['scrape_key_pages'],
        },
        {
          id: 'compare_analysis',
          agent: AgentType.ANALYSIS,
          action: 'generate_insights',
          input: {
            data: {
              products: '{{extract_products.data}}',
              sentiment: '{{analyze_sentiment.results}}',
              ourProducts: '{{our_products}}',
            },
            focusAreas: ['pricing', 'features', 'customer_satisfaction'],
          },
          dependencies: ['extract_products', 'analyze_sentiment'],
        },
      ],
      requiredContext: ['competitor_url', 'our_products'],
    });
  }

  static registerTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  static getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  static getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  static getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  static createWorkflowFromTemplate(
    templateId: string,
    context: Record<string, any>
  ): any {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required context
    if (template.requiredContext) {
      for (const required of template.requiredContext) {
        if (!(required in context)) {
          throw new Error(`Missing required context: ${required}`);
        }
      }
    }

    // Process template with context
    const processedSteps = template.steps.map(step => ({
      ...step,
      input: this.processTemplateInput(step.input, context),
    }));

    return {
      name: template.name,
      steps: processedSteps,
      context,
    };
  }

  private static processTemplateInput(input: any, context: Record<string, any>): any {
    if (typeof input === 'string') {
      return input.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return context[key] !== undefined ? context[key] : match;
      });
    } else if (typeof input === 'object' && input !== null) {
      const processed: any = Array.isArray(input) ? [] : {};
      for (const [key, value] of Object.entries(input)) {
        processed[key] = this.processTemplateInput(value, context);
      }
      return processed;
    }
    return input;
  }
}