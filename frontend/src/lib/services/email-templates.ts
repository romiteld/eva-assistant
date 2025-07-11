import { createClient } from '@/lib/supabase/browser';
import { graphHelpers } from '@/lib/microsoft/graph-client';
import { Database } from '@/types/supabase';

export type TemplateCategory = 
  | 'recruiting'
  | 'follow_up'
  | 'scheduling'
  | 'welcome'
  | 'rejection'
  | 'offer'
  | 'referral'
  | 'networking'
  | 'custom';

export interface EmailTemplateVariable {
  name: string;
  label: string;
  defaultValue: string;
}

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  variables: EmailTemplateVariable[];
  tags: string[];
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateUsage {
  id: string;
  template_id: string;
  user_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  variables_used: Record<string, string>;
  sent_at: string;
  status: 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked';
  metadata: Record<string, any>;
}

export interface CreateEmailTemplateInput {
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  variables?: EmailTemplateVariable[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateEmailTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  category?: TemplateCategory;
  variables?: EmailTemplateVariable[];
  tags?: string[];
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface SendEmailFromTemplateInput {
  templateId: string;
  recipient: {
    email: string;
    name?: string;
  };
  variables: Record<string, string>;
  cc?: string[];
  bcc?: string[];
}

export class EmailTemplateService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // Create a new email template
  async createTemplate(template: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('email_templates')
      .insert({
        user_id: user.user.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        variables: template.variables || [],
        tags: template.tags || [],
        metadata: template.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  }

  // Get all templates for the current user
  async getTemplates(filters?: {
    category?: TemplateCategory;
    tags?: string[];
    isActive?: boolean;
  }): Promise<EmailTemplate[]> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    let query = this.supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.user.id)
      .order('updated_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as EmailTemplate[];
  }

  // Get a single template by ID
  async getTemplate(templateId: string): Promise<EmailTemplate> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', user.user.id)
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  }

  // Update an existing template
  async updateTemplate(templateId: string, updates: UpdateEmailTemplateInput): Promise<EmailTemplate> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('email_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('user_id', user.user.id)
      .select()
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  }

  // Delete a template
  async deleteTemplate(templateId: string): Promise<void> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', user.user.id);

    if (error) throw error;
  }

  // Render template with variables
  renderTemplate(template: EmailTemplate, variables: Record<string, string>): {
    subject: string;
    body: string;
  } {
    let subject = template.subject;
    let body = template.body;

    // Replace all variables in subject and body
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value || '');
      body = body.replace(new RegExp(placeholder, 'g'), value || '');
    });

    // Replace any remaining placeholders with default values
    template.variables.forEach((variable) => {
      const placeholder = `{{${variable.name}}}`;
      if (!variables[variable.name]) {
        subject = subject.replace(new RegExp(placeholder, 'g'), variable.defaultValue || '');
        body = body.replace(new RegExp(placeholder, 'g'), variable.defaultValue || '');
      }
    });

    return { subject, body };
  }

  // Send email using template
  async sendEmailFromTemplate(input: SendEmailFromTemplateInput): Promise<void> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    // Get the template
    const template = await this.getTemplate(input.templateId);

    // Render the template with variables
    const { subject, body } = this.renderTemplate(template, input.variables);

    // Prepare the email message
    const message = {
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: input.recipient.email,
            name: input.recipient.name,
          },
        },
      ],
      ccRecipients: input.cc?.map(email => ({
        emailAddress: { address: email },
      })) || [],
      bccRecipients: input.bcc?.map(email => ({
        emailAddress: { address: email },
      })) || [],
    };

    try {
      // Send email via Microsoft Graph
      await graphHelpers.sendEmail(user.user.id, message);

      // Record usage
      await this.supabase
        .from('email_template_usage')
        .insert({
          template_id: input.templateId,
          user_id: user.user.id,
          recipient_email: input.recipient.email,
          recipient_name: input.recipient.name || null,
          subject,
          body,
          variables_used: input.variables,
          status: 'sent',
        });
    } catch (error) {
      // Record failed attempt
      await this.supabase
        .from('email_template_usage')
        .insert({
          template_id: input.templateId,
          user_id: user.user.id,
          recipient_email: input.recipient.email,
          recipient_name: input.recipient.name || null,
          subject,
          body,
          variables_used: input.variables,
          status: 'failed',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        });

      throw error;
    }
  }

  // Get template usage history
  async getTemplateUsageHistory(templateId?: string, limit = 50): Promise<EmailTemplateUsage[]> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    let query = this.supabase
      .from('email_template_usage')
      .select('*')
      .eq('user_id', user.user.id)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (templateId) {
      query = query.eq('template_id', templateId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as EmailTemplateUsage[];
  }

  // Get template statistics
  async getTemplateStatistics(templateId: string): Promise<{
    totalSent: number;
    successRate: number;
    lastUsed: string | null;
    mostUsedVariables: Record<string, number>;
  }> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data: usage, error } = await this.supabase
      .from('email_template_usage')
      .select('*')
      .eq('template_id', templateId)
      .eq('user_id', user.user.id);

    if (error) throw error;

    if (!usage || usage.length === 0) {
      return {
        totalSent: 0,
        successRate: 0,
        lastUsed: null,
        mostUsedVariables: {},
      };
    }

    const totalSent = usage.length;
    const successfulSent = usage.filter(u => u.status === 'sent').length;
    const successRate = (successfulSent / totalSent) * 100;
    const lastUsed = usage[0].sent_at;

    // Calculate most used variable values
    const variableUsage: Record<string, Record<string, number>> = {};
    usage.forEach(u => {
      Object.entries(u.variables_used as Record<string, string>).forEach(([key, value]) => {
        if (!variableUsage[key]) variableUsage[key] = {};
        variableUsage[key][value] = (variableUsage[key][value] || 0) + 1;
      });
    });

    const mostUsedVariables: Record<string, number> = {};
    Object.entries(variableUsage).forEach(([key, values]) => {
      const mostUsed = Object.entries(values).sort((a, b) => b[1] - a[1])[0];
      if (mostUsed) {
        mostUsedVariables[key] = mostUsed[1];
      }
    });

    return {
      totalSent,
      successRate,
      lastUsed,
      mostUsedVariables,
    };
  }

  // Duplicate a template
  async duplicateTemplate(templateId: string, newName: string): Promise<EmailTemplate> {
    const template = await this.getTemplate(templateId);
    
    const newTemplate = await this.createTemplate({
      name: newName,
      subject: template.subject,
      body: template.body,
      category: template.category,
      variables: template.variables,
      tags: [...template.tags, 'duplicated'],
      metadata: {
        ...template.metadata,
        duplicatedFrom: templateId,
        duplicatedAt: new Date().toISOString(),
      },
    });

    return newTemplate;
  }
}

// Export singleton instance
export const emailTemplateService = new EmailTemplateService();