import { Email, ParsedEmail } from '@/types/email';
import { ZohoClient } from '@/lib/integrations/zoho';
import { EmailDealParser } from '@/lib/email/deal-parser';
import { supabase } from '@/lib/supabase/browser';

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'attachments' | 'domain';
  operator: 'contains' | 'not_contains' | 'equals' | 'domain_in' | 'has' | 'matches_regex';
  value: string | string[] | RegExp;
  caseSensitive?: boolean;
}

export interface RuleAction {
  type: 'create_deal' | 'update_deal' | 'create_contact' | 'update_contact' | 
        'parse_resume' | 'match_to_jobs' | 'notify' | 'send_reply' | 
        'add_tag' | 'assign_to' | 'create_task' | 'log_activity';
  template?: string;
  params?: Record<string, any>;
  destination?: string;
  users?: string[];
  notify?: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  priority: number; // Higher number = higher priority
  conditions: RuleCondition[];
  conditionLogic?: 'AND' | 'OR'; // Default: AND
  actions: RuleAction[];
  stopOnMatch?: boolean; // Stop processing other rules if this matches
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    matches: number;
    lastMatch?: Date;
    avgProcessingTime?: number;
  };
}

export interface EmailProcessingResult {
  matched: boolean;
  rules: string[];
  actions: {
    type: string;
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
  }[];
  totalDuration: number;
  errors: string[];
}

export class EmailAutomationRules {
  private rules: AutomationRule[] = [];
  private zoho: ZohoClient;
  private dealParser: EmailDealParser;
  private userId: string;

  // Pre-built rules for common scenarios
  private defaultRules: AutomationRule[] = [
    {
      id: 'client-inquiry',
      name: 'Client Inquiry to Deal',
      description: 'Automatically create deals from client inquiries',
      active: true,
      priority: 10,
      conditions: [
        { 
          field: 'subject', 
          operator: 'matches_regex', 
          value: /position|role|hiring|recruitment|staffing|candidate/i 
        },
        {
          field: 'body',
          operator: 'contains',
          value: ['looking for', 'need', 'require', 'seeking']
        }
      ],
      conditionLogic: 'AND',
      actions: [
        { type: 'create_deal', template: 'client_inquiry' },
        { type: 'notify', users: ['account_manager'] },
        { type: 'send_reply', template: 'acknowledge_inquiry' },
        { type: 'create_task', params: { title: 'Follow up on inquiry', dueIn: 24 } }
      ],
      stopOnMatch: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'candidate-application',
      name: 'Candidate Application Processing',
      description: 'Process candidate applications with resume parsing',
      active: true,
      priority: 8,
      conditions: [
        { field: 'attachments', operator: 'has', value: ['resume', 'cv', 'pdf', 'doc', 'docx'] },
        { 
          field: 'body', 
          operator: 'matches_regex', 
          value: /interested|apply|application|position/i 
        }
      ],
      actions: [
        { type: 'create_contact', params: { category: 'candidate' } },
        { type: 'parse_resume', destination: 'contact_fields' },
        { type: 'match_to_jobs', notify: true },
        { type: 'send_reply', template: 'application_received' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'urgent-request',
      name: 'Urgent Request Handler',
      description: 'Prioritize and escalate urgent requests',
      active: true,
      priority: 15,
      conditions: [
        {
          field: 'subject',
          operator: 'matches_regex',
          value: /urgent|asap|critical|emergency|immediate/i
        }
      ],
      conditionLogic: 'OR',
      actions: [
        { type: 'create_deal', params: { priority: 'high', stage: 'Hot Lead' } },
        { type: 'notify', users: ['manager', 'assigned_recruiter'] },
        { type: 'send_reply', template: 'urgent_acknowledgment' },
        { type: 'create_task', params: { priority: 'high', dueIn: 2 } }
      ],
      stopOnMatch: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'follow-up',
      name: 'Follow-up Email Handler',
      description: 'Update existing deals from follow-up emails',
      active: true,
      priority: 5,
      conditions: [
        {
          field: 'subject',
          operator: 'matches_regex',
          value: /re:|fwd:|follow.?up|following up|checking in/i
        }
      ],
      actions: [
        { type: 'update_deal', params: { findBy: 'email_thread' } },
        { type: 'log_activity', params: { type: 'email_received' } },
        { type: 'notify', users: ['deal_owner'] }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  constructor(zoho: ZohoClient, userId: string) {
    this.zoho = zoho;
    this.userId = userId;
    this.dealParser = new EmailDealParser();
    this.loadRules();
  }

  async loadRules(): Promise<void> {
    try {
      // Load custom rules from database
      const { data: customRules, error } = await supabase
        .from('email_automation_rules')
        .select('*')
        .eq('user_id', this.userId)
        .eq('active', true)
        .order('priority', { ascending: false });

      if (error) throw error;

      // Merge default and custom rules
      this.rules = [
        ...this.defaultRules.filter(r => r.active),
        ...(customRules || []).map(r => ({
          ...r,
          conditions: JSON.parse(r.conditions),
          actions: JSON.parse(r.actions),
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at)
        }))
      ].sort((a, b) => b.priority - a.priority);

    } catch (error) {
      console.error('Error loading rules:', error);
      // Fallback to default rules
      this.rules = this.defaultRules.filter(r => r.active);
    }
  }

  async processEmail(email: Email | ParsedEmail): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    const result: EmailProcessingResult = {
      matched: false,
      rules: [],
      actions: [],
      totalDuration: 0,
      errors: []
    };

    try {
      // Process rules in priority order
      for (const rule of this.rules) {
        if (await this.evaluateConditions(email, rule.conditions, rule.conditionLogic)) {
          result.matched = true;
          result.rules.push(rule.name);

          // Execute actions
          for (const action of rule.actions) {
            const actionStart = Date.now();
            try {
              const actionResult = await this.executeAction(email, action, rule);
              result.actions.push({
                type: action.type,
                success: true,
                result: actionResult,
                duration: Date.now() - actionStart
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              result.errors.push(`Action ${action.type} failed: ${errorMessage}`);
              result.actions.push({
                type: action.type,
                success: false,
                error: errorMessage,
                duration: Date.now() - actionStart
              });
            }
          }

          // Update rule statistics
          await this.updateRuleStats(rule.id);

          // Stop processing if rule says so
          if (rule.stopOnMatch) {
            break;
          }
        }
      }

      result.totalDuration = Date.now() - startTime;
      
      // Log processing result
      await this.logProcessingResult(email, result);

      return result;

    } catch (error) {
      console.error('Error processing email:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.totalDuration = Date.now() - startTime;
      return result;
    }
  }

  private async evaluateConditions(
    email: Email | ParsedEmail, 
    conditions: RuleCondition[], 
    logic: 'AND' | 'OR' = 'AND'
  ): Promise<boolean> {
    const results = await Promise.all(
      conditions.map(condition => this.evaluateCondition(email, condition))
    );

    return logic === 'AND' 
      ? results.every(r => r)
      : results.some(r => r);
  }

  private async evaluateCondition(
    email: Email | ParsedEmail, 
    condition: RuleCondition
  ): Promise<boolean> {
    const fieldValue = this.getFieldValue(email, condition.field);
    
    switch (condition.operator) {
      case 'contains':
        if (Array.isArray(condition.value)) {
          return condition.value.some(v => 
            this.contains(fieldValue, v, condition.caseSensitive)
          );
        }
        return this.contains(fieldValue, condition.value as string, condition.caseSensitive);

      case 'not_contains':
        if (Array.isArray(condition.value)) {
          return !condition.value.some(v => 
            this.contains(fieldValue, v, condition.caseSensitive)
          );
        }
        return !this.contains(fieldValue, condition.value as string, condition.caseSensitive);

      case 'equals':
        return condition.caseSensitive 
          ? fieldValue === condition.value
          : fieldValue.toLowerCase() === (condition.value as string).toLowerCase();

      case 'domain_in':
        const emailDomain = this.extractDomain(email);
        return Array.isArray(condition.value) 
          ? condition.value.includes(emailDomain)
          : emailDomain === condition.value;

      case 'has':
        if (condition.field === 'attachments' && email.attachments) {
          return Array.isArray(condition.value)
            ? condition.value.some(ext => 
                email.attachments?.some(att => 
                  att.filename.toLowerCase().includes(ext.toLowerCase())
                )
              )
            : email.attachments.length > 0;
        }
        return false;

      case 'matches_regex':
        const regex = condition.value instanceof RegExp 
          ? condition.value 
          : new RegExp(condition.value as string, condition.caseSensitive ? '' : 'i');
        return regex.test(fieldValue);

      default:
        return false;
    }
  }

  private getFieldValue(email: Email | ParsedEmail, field: string): string {
    switch (field) {
      case 'from':
        return email.from.email;
      case 'to':
        return Array.isArray(email.to) 
          ? email.to.map(t => t.email).join(' ')
          : email.to?.email || '';
      case 'subject':
        return email.subject || '';
      case 'body':
        return email.body || '';
      case 'domain':
        return this.extractDomain(email);
      default:
        return '';
    }
  }

  private extractDomain(email: Email | ParsedEmail): string {
    const emailAddress = email.from.email;
    return emailAddress.split('@')[1] || '';
  }

  private contains(haystack: string, needle: string, caseSensitive?: boolean): boolean {
    if (!caseSensitive) {
      return haystack.toLowerCase().includes(needle.toLowerCase());
    }
    return haystack.includes(needle);
  }

  private async executeAction(
    email: Email | ParsedEmail, 
    action: RuleAction,
    rule: AutomationRule
  ): Promise<any> {
    switch (action.type) {
      case 'create_deal':
        return await this.createDealAction(email, action, rule);
      
      case 'update_deal':
        return await this.updateDealAction(email, action);
      
      case 'create_contact':
        return await this.createContactAction(email, action);
      
      case 'update_contact':
        return await this.updateContactAction(email, action);
      
      case 'parse_resume':
        return await this.parseResumeAction(email, action);
      
      case 'match_to_jobs':
        return await this.matchToJobsAction(email, action);
      
      case 'notify':
        return await this.notifyAction(email, action, rule);
      
      case 'send_reply':
        return await this.sendReplyAction(email, action);
      
      case 'add_tag':
        return await this.addTagAction(email, action);
      
      case 'assign_to':
        return await this.assignToAction(email, action);
      
      case 'create_task':
        return await this.createTaskAction(email, action, rule);
      
      case 'log_activity':
        return await this.logActivityAction(email, action);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async createDealAction(
    email: Email | ParsedEmail, 
    action: RuleAction,
    rule: AutomationRule
  ): Promise<any> {
    // Parse email to deal data
    const dealData = await this.dealParser.parseEmailToDeal(email as ParsedEmail);
    
    // Apply template if specified
    if (action.template) {
      const template = await this.getDealTemplate(action.template);
      Object.assign(dealData, template);
    }
    
    // Apply action params
    if (action.params) {
      Object.assign(dealData, action.params);
    }
    
    // Add rule information
    dealData.customFields = {
      ...dealData.customFields,
      automationRule: rule.name,
      automationRuleId: rule.id
    };
    
    // Create deal in Zoho
    const deal = await this.zoho.createDeal(dealData);
    
    // Track metrics
    await this.trackDealCreation(deal, email, rule);
    
    return deal;
  }

  private async updateDealAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    // Find existing deal
    let dealId: string | undefined;
    
    if (action.params?.findBy === 'email_thread') {
      // Search for deal by email thread
      const deals = await this.zoho.searchDeals({
        criteria: `(Email:equals:${email.from.email})`
      });
      dealId = deals[0]?.id;
    } else if (action.params?.dealId) {
      dealId = action.params.dealId;
    }
    
    if (!dealId) {
      throw new Error('No deal found to update');
    }
    
    // Update deal
    const updates = {
      ...action.params,
      Last_Activity: new Date().toISOString(),
      Modified_Time: new Date().toISOString()
    };
    
    delete updates.findBy;
    delete updates.dealId;
    
    return await this.zoho.updateDeal(dealId, updates);
  }

  private async createContactAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    const contact = {
      Email: email.from.email,
      First_Name: email.from.name?.split(' ')[0] || '',
      Last_Name: email.from.name?.split(' ').slice(1).join(' ') || '',
      Lead_Source: 'Email',
      ...action.params
    };
    
    return await this.zoho.createContact(contact);
  }

  private async updateContactAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    // Find contact by email
    const contacts = await this.zoho.searchContacts({
      criteria: `(Email:equals:${email.from.email})`
    });
    
    if (!contacts || contacts.length === 0) {
      throw new Error('No contact found to update');
    }
    
    return await this.zoho.updateContact(contacts[0].id, action.params || {});
  }

  private async parseResumeAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    if (!email.attachments || email.attachments.length === 0) {
      throw new Error('No attachments found for resume parsing');
    }
    
    // Find resume attachment
    const resumeAttachment = email.attachments.find(att => 
      /\.(pdf|doc|docx)$/i.test(att.filename)
    );
    
    if (!resumeAttachment) {
      throw new Error('No resume file found in attachments');
    }
    
    // Parse resume (placeholder - integrate with actual resume parser)
    const parsedData = {
      email: email.from.email,
      name: email.from.name,
      skills: [],
      experience: [],
      education: []
    };
    
    // Store or update based on destination
    if (action.destination === 'contact_fields') {
      await this.updateContactAction(email, {
        type: 'update_contact',
        params: parsedData
      });
    }
    
    return parsedData;
  }

  private async matchToJobsAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    // Placeholder for job matching logic
    const matches = [];
    
    if (action.notify) {
      await this.notifyAction(email, {
        type: 'notify',
        params: {
          message: `${matches.length} job matches found for ${email.from.name}`,
          matches
        }
      }, {} as AutomationRule);
    }
    
    return matches;
  }

  private async notifyAction(
    email: Email | ParsedEmail, 
    action: RuleAction,
    rule: AutomationRule
  ): Promise<any> {
    const notifications = [];
    
    const users = action.users || ['current_user'];
    
    for (const user of users) {
      const notification = {
        user_id: user === 'current_user' ? this.userId : user,
        type: 'email_automation',
        title: `Email Rule Triggered: ${rule.name}`,
        message: action.params?.message || `Email from ${email.from.email} matched rule "${rule.name}"`,
        data: {
          email_id: email.id,
          rule_id: rule.id,
          rule_name: rule.name,
          from: email.from.email,
          subject: email.subject
        },
        created_at: new Date().toISOString()
      };
      
      // Save notification to database
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();
      
      if (!error) {
        notifications.push(data);
      }
    }
    
    return notifications;
  }

  private async sendReplyAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    // Get reply template
    const template = await this.getEmailTemplate(action.template || 'default_reply');
    
    // Personalize template
    const personalizedContent = this.personalizeTemplate(template, email);
    
    // Queue reply email
    const reply = {
      to: email.from.email,
      subject: `Re: ${email.subject}`,
      body: personalizedContent,
      inReplyTo: email.id,
      scheduled_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('email_queue')
      .insert(reply)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  }

  private async addTagAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    const tags = action.params?.tags || [];
    
    // Add tags to email record
    const { data, error } = await supabase
      .from('email_tags')
      .insert(
        tags.map((tag: string) => ({
          email_id: email.id,
          tag,
          user_id: this.userId
        }))
      );
    
    if (error) throw error;
    
    return data;
  }

  private async assignToAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    const assigneeId = action.params?.user_id || this.userId;
    
    // Create assignment record
    const { data, error } = await supabase
      .from('email_assignments')
      .insert({
        email_id: email.id,
        assigned_to: assigneeId,
        assigned_by: this.userId,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  }

  private async createTaskAction(
    email: Email | ParsedEmail, 
    action: RuleAction,
    rule: AutomationRule
  ): Promise<any> {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + (action.params?.dueIn || 24));
    
    const task = {
      Subject: action.params?.title || `Follow up: ${email.subject}`,
      Due_Date: dueDate.toISOString(),
      Priority: action.params?.priority || 'Normal',
      Status: 'Not Started',
      Description: `Created by automation rule: ${rule.name}\n\nOriginal email from: ${email.from.email}`,
      Related_To: action.params?.relatedTo
    };
    
    return await this.zoho.createTask(task);
  }

  private async logActivityAction(email: Email | ParsedEmail, action: RuleAction): Promise<any> {
    const activity = {
      email_id: email.id,
      type: action.params?.type || 'email_received',
      description: action.params?.description || `Email received from ${email.from.email}`,
      metadata: {
        from: email.from,
        subject: email.subject,
        timestamp: email.receivedAt
      },
      user_id: this.userId,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('activity_log')
      .insert(activity)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  }

  private async getDealTemplate(templateId: string): Promise<any> {
    // Placeholder - implement template fetching
    const templates: Record<string, any> = {
      client_inquiry: {
        stage: 'Initial Contact',
        probability: 20,
        type: 'New Business'
      },
      urgent_request: {
        stage: 'Hot Lead',
        probability: 60,
        priority: 'High'
      }
    };
    
    return templates[templateId] || {};
  }

  private async getEmailTemplate(templateId: string): Promise<string> {
    // Placeholder - implement email template fetching
    const templates: Record<string, string> = {
      acknowledge_inquiry: `
Thank you for reaching out to us. We've received your inquiry and appreciate your interest.

Our team will review your requirements and get back to you within 24 hours with more information.

Best regards,
The Team
      `,
      application_received: `
Thank you for your application. We've received your resume and will review it carefully.

If your qualifications match our current openings, we'll be in touch soon to discuss next steps.

Best regards,
The Recruitment Team
      `,
      urgent_acknowledgment: `
We've received your urgent request and understand the time-sensitive nature of your needs.

A member of our team has been notified and will contact you within the next 2 hours.

Thank you for your patience.
      `
    };
    
    return templates[templateId] || templates.acknowledge_inquiry;
  }

  private personalizeTemplate(template: string, email: Email | ParsedEmail): string {
    return template
      .replace(/\{name\}/g, email.from.name || 'there')
      .replace(/\{email\}/g, email.from.email)
      .replace(/\{subject\}/g, email.subject || '')
      .replace(/\{date\}/g, new Date().toLocaleDateString());
  }

  private async updateRuleStats(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_rule_stats', {
        rule_id: ruleId,
        user_id: this.userId
      });
      
      if (error) console.error('Error updating rule stats:', error);
    } catch (error) {
      console.error('Error updating rule stats:', error);
    }
  }

  private async trackDealCreation(deal: any, email: Email | ParsedEmail, rule: AutomationRule): Promise<void> {
    try {
      const { error } = await supabase
        .from('deal_creation_metrics')
        .insert({
          user_id: this.userId,
          deal_id: deal.id,
          duration_ms: 0, // Will be calculated by the caller
          source: 'email',
          success: true,
          steps: {
            rule_matched: rule.name,
            email_parsed: true,
            deal_created: true
          }
        });
      
      if (error) console.error('Error tracking deal creation:', error);
    } catch (error) {
      console.error('Error tracking deal creation:', error);
    }
  }

  private async logProcessingResult(email: Email | ParsedEmail, result: EmailProcessingResult): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_processing_log')
        .insert({
          user_id: this.userId,
          email_id: email.id,
          matched: result.matched,
          rules: result.rules,
          actions: result.actions,
          total_duration: result.totalDuration,
          errors: result.errors,
          created_at: new Date().toISOString()
        });
      
      if (error) console.error('Error logging processing result:', error);
    } catch (error) {
      console.error('Error logging processing result:', error);
    }
  }

  // Public methods for rule management
  async addRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<AutomationRule> {
    const newRule: AutomationRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to database
    const { data, error } = await supabase
      .from('email_automation_rules')
      .insert({
        id: newRule.id,
        user_id: this.userId,
        name: newRule.name,
        description: newRule.description,
        active: newRule.active,
        priority: newRule.priority,
        conditions: JSON.stringify(newRule.conditions),
        condition_logic: newRule.conditionLogic || 'AND',
        actions: JSON.stringify(newRule.actions),
        stop_on_match: newRule.stopOnMatch || false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Reload rules
    await this.loadRules();
    
    return newRule;
  }

  async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.active !== undefined) updateData.active = updates.active;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.conditions !== undefined) updateData.conditions = JSON.stringify(updates.conditions);
    if (updates.conditionLogic !== undefined) updateData.condition_logic = updates.conditionLogic;
    if (updates.actions !== undefined) updateData.actions = JSON.stringify(updates.actions);
    if (updates.stopOnMatch !== undefined) updateData.stop_on_match = updates.stopOnMatch;
    
    const { error } = await supabase
      .from('email_automation_rules')
      .update(updateData)
      .eq('id', ruleId)
      .eq('user_id', this.userId);
    
    if (error) throw error;
    
    // Reload rules
    await this.loadRules();
  }

  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await supabase
      .from('email_automation_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', this.userId);
    
    if (error) throw error;
    
    // Reload rules
    await this.loadRules();
  }

  async getRules(): Promise<AutomationRule[]> {
    return this.rules;
  }

  async testRule(rule: AutomationRule, email: Email | ParsedEmail): Promise<EmailProcessingResult> {
    // Test a single rule without saving results
    const testRules = new EmailAutomationRules(this.zoho, this.userId);
    testRules.rules = [rule];
    
    const result = await testRules.processEmail(email);
    
    // Don't save test results
    return result;
  }
}