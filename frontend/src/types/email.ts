export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  content?: string; // Base64 encoded
}

export interface Email {
  id: string;
  from: EmailAddress;
  to: EmailAddress | EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject?: string;
  body: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  receivedAt: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface ParsedEmail extends Email {
  parsed?: boolean;
  tags?: string[];
  priority?: number;
  category?: string;
}

export interface DealData {
  id?: string;
  name: string;
  stage: string;
  priority: 'high' | 'medium' | 'low';
  source: string;
  description: string;
  customFields: Record<string, any>;
  contacts: Contact[];
  estimatedValue?: number;
  expectedCloseDate?: Date;
  probability?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Contact {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  title?: string;
  source: string;
  type?: string;
}

export interface ExtractedData {
  urgency: number;
  hasBudget: boolean;
  hasRequirements: boolean;
  isInquiry: boolean;
  hasUrgency: boolean;
  patterns: Record<string, {
    matched: boolean;
    count: number;
    weight: number;
    matches?: string[];
  }>;
  matchedKeywords?: string[];
  requirements?: string[];
  dealType?: string;
  location?: string;
  experience?: string;
  budget?: {
    amount: number;
    currency: string;
  };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailCampaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  recipients: string[];
  template: EmailTemplate;
  scheduledAt?: Date;
  completedAt?: Date;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
}