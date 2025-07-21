import { ParsedEmail, DealData, ExtractedData, Contact } from '@/types/email';

export interface EmailPattern {
  pattern: RegExp;
  type: string;
  weight?: number;
}

export interface DealParserConfig {
  patterns?: Record<string, EmailPattern>;
  customFieldMapping?: Record<string, string>;
  defaultStage?: string;
  priorityThresholds?: {
    high: number;
    medium: number;
    low: number;
  };
}

export class EmailDealParser {
  private patterns: Record<string, EmailPattern> = {
    urgency: {
      pattern: /urgent|asap|immediately|priority|rush|critical|time.?sensitive|expedite/i,
      type: 'urgency',
      weight: 2.0
    },
    budget: {
      pattern: /budget|salary|rate|compensation|pay|wage|\$[\d,]+k?|[\d,]+\/hr|[\d,]+\/hour|[\d,]+k\s*(USD|CAD|EUR)?/i,
      type: 'budget',
      weight: 1.5
    },
    timeline: {
      pattern: /start date|begin|available|timeline|when can|by when|deadline|target date/i,
      type: 'timeline',
      weight: 1.3
    },
    dealType: {
      pattern: /permanent|contract|temp(?:orary)?|freelance|full[- ]?time|part[- ]?time|consulting|placement/i,
      type: 'dealType',
      weight: 1.2
    },
    requirements: {
      pattern: /requirements?|looking for|need|seeking|must have|qualifications?|skills?|experience/i,
      type: 'requirements',
      weight: 1.4
    },
    location: {
      pattern: /location|remote|hybrid|on[- ]?site|office|based in|relocat/i,
      type: 'location',
      weight: 1.1
    },
    experience: {
      pattern: /\d+\+?\s*years?|senior|junior|mid[- ]?level|entry[- ]?level|experienced|seasoned/i,
      type: 'experience',
      weight: 1.2
    },
    company: {
      pattern: /company|organization|firm|agency|corporation|inc\.|ltd\.|llc|corp\./i,
      type: 'company',
      weight: 1.0
    }
  };

  private priorityThresholds = {
    high: 7.0,
    medium: 4.0,
    low: 0
  };

  constructor(config?: DealParserConfig) {
    if (config?.patterns) {
      this.patterns = { ...this.patterns, ...config.patterns };
    }
    if (config?.priorityThresholds) {
      this.priorityThresholds = { ...this.priorityThresholds, ...config.priorityThresholds };
    }
  }

  async parseEmailToDeal(email: ParsedEmail): Promise<DealData> {
    // Extract structured data from email
    const extracted = await this.extractStructuredData(email);
    
    // Determine deal stage based on content
    const stage = this.determineStage(extracted);
    
    // Calculate priority score
    const priority = this.calculatePriority(extracted);
    
    // Find or create related contacts
    const contacts = await this.identifyContacts(email);
    
    // Extract budget information
    const budgetInfo = this.extractBudget(email.body);
    
    // Extract timeline information
    const timeline = this.extractTimeline(email.body);
    
    return {
      name: this.generateDealName(extracted, email),
      stage,
      priority,
      source: 'Email',
      description: this.summarizeEmail(email),
      customFields: {
        originalEmailId: email.id,
        urgencyScore: extracted.urgency,
        requirements: extracted.requirements,
        nextAction: this.suggestNextAction(extracted),
        emailSubject: email.subject,
        senderEmail: email.from.email,
        receivedAt: email.receivedAt,
        hasAttachments: Boolean(email.attachments?.length),
        dealType: extracted.dealType,
        location: extracted.location,
        experienceLevel: extracted.experience
      },
      contacts,
      estimatedValue: budgetInfo?.amount,
      expectedCloseDate: this.calculateExpectedClose(extracted, timeline),
      probability: this.calculateProbability(stage, priority)
    };
  }

  private async extractStructuredData(email: ParsedEmail): Promise<ExtractedData> {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    const extracted: ExtractedData = {
      urgency: 0,
      hasBudget: false,
      hasRequirements: false,
      isInquiry: false,
      hasUrgency: false,
      patterns: {},
      matchedKeywords: []
    };

    // Check each pattern and calculate scores
    for (const [key, pattern] of Object.entries(this.patterns)) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        extracted.patterns[key] = {
          matched: true,
          count: matches.length,
          weight: pattern.weight || 1.0,
          matches: matches.slice(0, 5) // Keep first 5 matches
        };
        extracted.matchedKeywords?.push(...matches);
      }
    }

    // Set boolean flags
    extracted.hasUrgency = !!extracted.patterns.urgency?.matched;
    extracted.hasBudget = !!extracted.patterns.budget?.matched;
    extracted.hasRequirements = !!extracted.patterns.requirements?.matched;
    extracted.isInquiry = this.isInquiryEmail(email);

    // Calculate urgency score (0-10)
    extracted.urgency = this.calculateUrgencyScore(extracted);

    // Extract specific information
    extracted.requirements = this.extractRequirements(email.body);
    extracted.dealType = this.extractDealType(content);
    extracted.location = this.extractLocation(content);
    extracted.experience = this.extractExperience(content);
    extracted.budget = this.extractBudget(email.body);

    return extracted;
  }

  private determineStage(data: ExtractedData): string {
    // Advanced stage determination based on multiple factors
    if (data.hasBudget && data.hasRequirements && data.urgency > 6) {
      return 'Qualified Lead';
    }
    if (data.hasBudget && data.hasRequirements) {
      return 'Needs Analysis';
    }
    if (data.hasRequirements && !data.hasBudget) {
      return 'Discovery';
    }
    if (data.isInquiry && !data.hasRequirements) {
      return 'Initial Contact';
    }
    if (data.hasUrgency && data.urgency > 8) {
      return 'Hot Lead';
    }
    if (data.patterns.company?.matched) {
      return 'New Lead';
    }
    return 'Unqualified';
  }

  private calculatePriority(data: ExtractedData): 'high' | 'medium' | 'low' {
    let score = 0;

    // Calculate weighted score based on patterns
    for (const [key, patternData] of Object.entries(data.patterns)) {
      if (patternData.matched) {
        score += patternData.count * patternData.weight;
      }
    }

    // Add urgency bonus
    score += data.urgency * 0.5;

    // Add bonus for complete information
    if (data.hasBudget) score += 2;
    if (data.hasRequirements) score += 2;
    if (data.dealType) score += 1;
    if (data.location) score += 1;

    // Determine priority based on thresholds
    if (score >= this.priorityThresholds.high) return 'high';
    if (score >= this.priorityThresholds.medium) return 'medium';
    return 'low';
  }

  private async identifyContacts(email: ParsedEmail): Promise<Contact[]> {
    const contacts: Contact[] = [];

    // Primary contact from sender
    if (email.from) {
      contacts.push({
        email: email.from.email,
        firstName: email.from.name?.split(' ')[0] || '',
        lastName: email.from.name?.split(' ').slice(1).join(' ') || '',
        source: 'Email',
        type: 'Primary'
      });
    }

    // Extract additional contacts from CC
    if (email.cc) {
      for (const cc of email.cc) {
        contacts.push({
          email: cc.email,
          firstName: cc.name?.split(' ')[0] || '',
          lastName: cc.name?.split(' ').slice(1).join(' ') || '',
          source: 'Email',
          type: 'CC'
        });
      }
    }

    // Extract contacts mentioned in body
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
    const emailMatches = email.body.match(emailPattern) || [];
    
    for (const emailMatch of emailMatches) {
      if (!contacts.some(c => c.email === emailMatch)) {
        contacts.push({
          email: emailMatch,
          source: 'Email Body',
          type: 'Mentioned'
        });
      }
    }

    return contacts;
  }

  private generateDealName(extracted: ExtractedData, email: ParsedEmail): string {
    const parts: string[] = [];

    // Add deal type if available
    if (extracted.dealType) {
      parts.push(extracted.dealType);
    }

    // Add location if available
    if (extracted.location) {
      parts.push(`- ${extracted.location}`);
    }

    // Add sender domain
    const domain = email.from.email.split('@')[1];
    const company = domain.split('.')[0];
    parts.push(`- ${company.charAt(0).toUpperCase() + company.slice(1)}`);

    // If no meaningful parts, use subject or default
    if (parts.length === 0) {
      return email.subject || `Deal - ${email.from.name || email.from.email}`;
    }

    return parts.join(' ');
  }

  private summarizeEmail(email: ParsedEmail): string {
    const summary: string[] = [];
    
    summary.push(`Email from: ${email.from.name || email.from.email}`);
    summary.push(`Subject: ${email.subject}`);
    summary.push(`Received: ${new Date(email.receivedAt).toLocaleString()}`);
    
    if (email.attachments?.length) {
      summary.push(`Attachments: ${email.attachments.length} file(s)`);
    }
    
    summary.push('\n--- Email Content ---\n');
    
    // Truncate body to reasonable length
    const maxLength = 1000;
    if (email.body.length > maxLength) {
      summary.push(email.body.substring(0, maxLength) + '...');
    } else {
      summary.push(email.body);
    }
    
    return summary.join('\n');
  }

  private suggestNextAction(extracted: ExtractedData): string {
    if (extracted.urgency > 8) {
      return 'Immediate response required - Call within 2 hours';
    }
    if (extracted.hasBudget && extracted.hasRequirements) {
      return 'Schedule discovery call to discuss requirements';
    }
    if (extracted.hasRequirements && !extracted.hasBudget) {
      return 'Send pricing information and case studies';
    }
    if (extracted.isInquiry) {
      return 'Send introduction email with service overview';
    }
    return 'Review and qualify lead';
  }

  private calculateExpectedClose(extracted: ExtractedData, timeline?: Date): Date {
    const baseDate = new Date();
    
    if (timeline) {
      return timeline;
    }
    
    // Calculate based on urgency and completeness
    let daysToClose = 30; // Default
    
    if (extracted.urgency > 8) {
      daysToClose = 7;
    } else if (extracted.urgency > 6) {
      daysToClose = 14;
    } else if (extracted.hasBudget && extracted.hasRequirements) {
      daysToClose = 21;
    }
    
    baseDate.setDate(baseDate.getDate() + daysToClose);
    return baseDate;
  }

  private calculateProbability(stage: string, priority: string): number {
    const stageProbabilities: Record<string, number> = {
      'Hot Lead': 80,
      'Qualified Lead': 60,
      'Needs Analysis': 40,
      'Discovery': 30,
      'Initial Contact': 20,
      'New Lead': 10,
      'Unqualified': 5
    };

    const priorityMultipliers: Record<string, number> = {
      'high': 1.2,
      'medium': 1.0,
      'low': 0.8
    };

    const baseProbability = stageProbabilities[stage] || 10;
    const multiplier = priorityMultipliers[priority] || 1.0;

    return Math.min(Math.round(baseProbability * multiplier), 100);
  }

  private extractBudget(content: string): { amount: number; currency: string } | undefined {
    // Enhanced budget extraction with multiple patterns
    const budgetPatterns = [
      /\$\s?([\d,]+)k?/i,
      /([\d,]+)\s*(?:USD|CAD|EUR|GBP)/i,
      /budget.*?([\d,]+)/i,
      /salary.*?([\d,]+)/i,
      /([\d,]+)\s*\/\s*(?:hr|hour)/i,
      /rate.*?([\d,]+)/i
    ];

    for (const pattern of budgetPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const amount = parseInt(match[1].replace(/,/g, ''));
        if (!isNaN(amount)) {
          // Determine if it's hourly and convert to annual
          if (pattern.toString().includes('hr|hour')) {
            return { amount: amount * 2080, currency: 'USD' }; // Assuming full-time
          }
          
          // Check if 'k' notation
          if (match[0].toLowerCase().includes('k')) {
            return { amount: amount * 1000, currency: 'USD' };
          }
          
          return { amount, currency: 'USD' };
        }
      }
    }
    
    return undefined;
  }

  private extractTimeline(content: string): Date | undefined {
    const timelinePatterns = [
      /start.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /begin.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /by\s+(\w+\s+\d{1,2})/i,
      /available\s+(\w+\s+\d{1,2})/i,
      /deadline.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i
    ];

    for (const pattern of timelinePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    // Check for relative dates
    const relativePatterns = [
      /next\s+week/i,
      /next\s+month/i,
      /in\s+(\d+)\s+days?/i,
      /in\s+(\d+)\s+weeks?/i,
      /asap|immediately|urgent/i
    ];

    const now = new Date();
    
    if (content.match(/next\s+week/i)) {
      now.setDate(now.getDate() + 7);
      return now;
    }
    
    if (content.match(/next\s+month/i)) {
      now.setMonth(now.getMonth() + 1);
      return now;
    }
    
    if (content.match(/asap|immediately|urgent/i)) {
      now.setDate(now.getDate() + 3);
      return now;
    }

    const daysMatch = content.match(/in\s+(\d+)\s+days?/i);
    if (daysMatch && daysMatch[1]) {
      now.setDate(now.getDate() + parseInt(daysMatch[1]));
      return now;
    }

    const weeksMatch = content.match(/in\s+(\d+)\s+weeks?/i);
    if (weeksMatch && weeksMatch[1]) {
      now.setDate(now.getDate() + (parseInt(weeksMatch[1]) * 7));
      return now;
    }

    return undefined;
  }

  private extractRequirements(content: string): string[] {
    const requirements: string[] = [];
    
    // Split content into sentences
    const sentences = content.split(/[.!?]+/);
    
    // Keywords that indicate requirements
    const requirementKeywords = [
      'must have', 'required', 'looking for', 'need', 'should have',
      'experience with', 'knowledge of', 'skills', 'qualifications'
    ];
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const keyword of requirementKeywords) {
        if (lowerSentence.includes(keyword)) {
          requirements.push(sentence.trim());
          break;
        }
      }
    }
    
    return requirements.slice(0, 10); // Limit to 10 requirements
  }

  private extractDealType(content: string): string | undefined {
    const dealTypes: Record<string, string[]> = {
      'Permanent Placement': ['permanent', 'full-time', 'full time', 'fte'],
      'Contract': ['contract', 'contractor', 'consulting', 'consultant'],
      'Temporary': ['temp', 'temporary', 'short-term', 'short term'],
      'Contract-to-Hire': ['contract to hire', 'c2h', 'contract-to-hire', 'temp to perm'],
      'Part-Time': ['part-time', 'part time', 'partial'],
      'Freelance': ['freelance', 'freelancer', 'independent']
    };

    for (const [dealType, keywords] of Object.entries(dealTypes)) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          return dealType;
        }
      }
    }

    return undefined;
  }

  private extractLocation(content: string): string | undefined {
    // Look for location patterns
    const locationPatterns = [
      /location[:\s]+([^,.]+)/i,
      /based in[:\s]+([^,.]+)/i,
      /office in[:\s]+([^,.]+)/i,
      /(remote|hybrid|on-site|onsite)/i
    ];

    for (const pattern of locationPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Check for common cities
    const cities = [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
      'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
      'Austin', 'Jacksonville', 'San Francisco', 'Boston', 'Seattle',
      'Denver', 'Washington', 'Nashville', 'Miami', 'Atlanta'
    ];

    for (const city of cities) {
      if (content.includes(city.toLowerCase())) {
        return city;
      }
    }

    return undefined;
  }

  private extractExperience(content: string): string | undefined {
    const experiencePatterns = [
      /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
      /(senior|junior|mid-level|entry level|experienced)/i,
      /(\d+)-(\d+)\s*years?/i
    ];

    for (const pattern of experiencePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[0];
      }
    }

    return undefined;
  }

  private isInquiryEmail(email: ParsedEmail): boolean {
    const inquiryKeywords = [
      'interested', 'inquiry', 'information', 'learn more',
      'tell me about', 'details', 'how does', 'what is',
      'can you help', 'looking for information'
    ];

    const content = `${email.subject} ${email.body}`.toLowerCase();
    
    return inquiryKeywords.some(keyword => content.includes(keyword));
  }

  private calculateUrgencyScore(data: ExtractedData): number {
    let score = 0;

    // Base score from urgency pattern matches
    if (data.patterns.urgency?.matched) {
      score += data.patterns.urgency.count * 2;
    }

    // Additional factors
    if (data.patterns.timeline?.matched) {
      score += 1.5;
    }

    if (data.hasBudget) {
      score += 1;
    }

    if (data.hasRequirements) {
      score += 1;
    }

    // Check for specific urgent keywords in matches
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical'];
    const matchedKeywords = data.matchedKeywords?.join(' ').toLowerCase() || '';
    
    for (const keyword of urgentKeywords) {
      if (matchedKeywords.includes(keyword)) {
        score += 1.5;
      }
    }

    // Normalize to 0-10 scale
    return Math.min(Math.round(score), 10);
  }
}