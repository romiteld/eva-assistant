# EVA Assistant Business Features Design

## Table of Contents
1. [Lead Generation System](#1-lead-generation-system)
2. [Outreach Campaign Manager](#2-outreach-campaign-manager)
3. [Resume Parser & ATS](#3-resume-parser--ats)
4. [AI Interview Center](#4-ai-interview-center)
5. [Task Management with Outlook](#5-task-management-with-outlook)

---

## 1. Lead Generation System

### Database Schema

```sql
-- Lead sources configuration
CREATE TABLE public.lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    source_type TEXT CHECK (source_type IN ('linkedin', 'website', 'api', 'manual', 'referral')) NOT NULL,
    config JSONB DEFAULT '{}', -- Contains API keys, scraping rules, etc.
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads/Prospects table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.lead_sources(id),
    
    -- Basic Information
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    job_title TEXT,
    department TEXT,
    
    -- LinkedIn Data
    linkedin_url TEXT,
    linkedin_headline TEXT,
    linkedin_summary TEXT,
    linkedin_connections INTEGER,
    
    -- Enrichment Data
    company_size TEXT,
    company_industry TEXT,
    company_revenue TEXT,
    company_website TEXT,
    location_city TEXT,
    location_state TEXT,
    location_country TEXT,
    
    -- Lead Scoring
    lead_score DECIMAL(5,2) DEFAULT 0,
    score_factors JSONB DEFAULT '{}',
    qualification_status TEXT CHECK (qualification_status IN ('unqualified', 'qualified', 'hot', 'cold', 'nurturing')),
    
    -- Tracking
    status TEXT CHECK (status IN ('new', 'contacted', 'engaged', 'qualified', 'converted', 'lost')) DEFAULT 'new',
    tags TEXT[],
    notes TEXT,
    last_activity TIMESTAMPTZ,
    
    -- CRM Sync
    crm_id TEXT,
    crm_type TEXT,
    crm_last_sync TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, email)
);

-- Lead enrichment history
CREATE TABLE public.lead_enrichment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    enrichment_source TEXT NOT NULL,
    enrichment_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead scoring rules
CREATE TABLE public.lead_scoring_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    rule_type TEXT CHECK (rule_type IN ('demographic', 'behavioral', 'firmographic', 'engagement')),
    conditions JSONB NOT NULL, -- JSON structure for rule conditions
    score_impact INTEGER NOT NULL, -- Points to add/subtract
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web scraping tasks
CREATE TABLE public.scraping_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.lead_sources(id),
    url TEXT NOT NULL,
    scrape_type TEXT CHECK (scrape_type IN ('profile', 'company', 'search_results', 'contact_info')),
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    result_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_user_status ON public.leads(user_id, status);
CREATE INDEX idx_leads_score ON public.leads(lead_score DESC);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_company ON public.leads(company_name);
CREATE INDEX idx_scraping_tasks_status ON public.scraping_tasks(status, scheduled_at);
```

### API Endpoints

```typescript
// /api/leads/generate
POST /api/leads/generate
{
  "source": "linkedin" | "website" | "manual",
  "parameters": {
    "searchQuery"?: string,
    "urls"?: string[],
    "filters"?: {
      "industry": string[],
      "location": string[],
      "companySize": string[],
      "jobTitle": string[]
    }
  }
}

// /api/leads/enrich
POST /api/leads/enrich/:leadId
{
  "enrichmentSources": ["clearbit", "hunter", "apollo", "linkedin"]
}

// /api/leads/score
POST /api/leads/score/:leadId
Response: {
  "leadScore": number,
  "scoreBreakdown": {
    "demographic": number,
    "firmographic": number,
    "behavioral": number,
    "engagement": number
  },
  "recommendations": string[]
}

// /api/leads/bulk-import
POST /api/leads/bulk-import
{
  "source": "csv" | "excel" | "api",
  "data": File | any[],
  "mappings": {
    "firstName": "first_name",
    "lastName": "last_name",
    // ... field mappings
  }
}

// /api/leads/sync-crm
POST /api/leads/sync-crm
{
  "crmType": "zoho" | "hubspot" | "salesforce",
  "leadIds": string[],
  "syncDirection": "push" | "pull" | "bidirectional"
}

// /api/leads
GET /api/leads?status=new&score_min=70&page=1&limit=50
PUT /api/leads/:id
DELETE /api/leads/:id

// /api/lead-scoring-rules
GET /api/lead-scoring-rules
POST /api/lead-scoring-rules
PUT /api/lead-scoring-rules/:id
DELETE /api/lead-scoring-rules/:id
```

### UI Components Design

```typescript
// Lead Generation Dashboard Component
interface LeadGenerationDashboard {
  // Stats Overview
  totalLeads: number;
  newLeadsToday: number;
  hotLeads: number;
  conversionRate: number;
  
  // Lead Sources Performance
  sourcePerformance: {
    sourceName: string;
    leadsGenerated: number;
    conversionRate: number;
    lastSync: Date;
  }[];
  
  // Lead Quality Distribution
  leadScoreDistribution: {
    range: string;
    count: number;
  }[];
}

// Lead Search & Filter Component
interface LeadSearchFilter {
  searchQuery: string;
  filters: {
    status: string[];
    scoreRange: [number, number];
    source: string[];
    dateRange: [Date, Date];
    tags: string[];
    location: string[];
    industry: string[];
  };
  sortBy: 'score' | 'createdAt' | 'lastActivity' | 'companyName';
  sortOrder: 'asc' | 'desc';
}

// Lead Profile View
interface LeadProfileView {
  basicInfo: {
    name: string;
    email: string;
    phone: string;
    linkedinUrl: string;
    profilePhoto: string;
  };
  
  companyInfo: {
    name: string;
    website: string;
    size: string;
    industry: string;
    revenue: string;
  };
  
  leadScoring: {
    totalScore: number;
    breakdown: Record<string, number>;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  
  enrichmentData: {
    source: string;
    data: any;
    confidence: number;
    timestamp: Date;
  }[];
  
  activityTimeline: {
    type: string;
    description: string;
    timestamp: Date;
  }[];
}

// Web Scraping Configuration
interface ScrapingConfig {
  source: {
    name: string;
    type: string;
    url: string;
  };
  
  rules: {
    selectors: Record<string, string>;
    pagination: {
      enabled: boolean;
      selector: string;
      maxPages: number;
    };
    rateLimit: {
      requestsPerMinute: number;
      cooldownSeconds: number;
    };
  };
  
  schedule: {
    frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
    time?: string;
    daysOfWeek?: number[];
  };
}
```

---

## 2. Outreach Campaign Manager

### Database Schema

```sql
-- Campaign templates
CREATE TABLE public.campaign_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    channel TEXT CHECK (channel IN ('email', 'linkedin', 'sms', 'multi')) NOT NULL,
    template_data JSONB NOT NULL, -- Contains subject, body, personalization tokens
    category TEXT,
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.campaign_templates(id),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Campaign Settings
    channel TEXT CHECK (channel IN ('email', 'linkedin', 'sms', 'multi')) NOT NULL,
    status TEXT CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')) DEFAULT 'draft',
    
    -- Targeting
    audience_filter JSONB DEFAULT '{}', -- Lead filtering criteria
    audience_count INTEGER DEFAULT 0,
    
    -- Scheduling
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',
    send_schedule JSONB DEFAULT '{}', -- Time windows, days of week
    
    -- A/B Testing
    ab_test_enabled BOOLEAN DEFAULT FALSE,
    ab_variants JSONB DEFAULT '[]', -- Array of variant configurations
    ab_test_metric TEXT, -- 'open_rate', 'click_rate', 'response_rate'
    
    -- Performance
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign recipients
CREATE TABLE public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    
    -- Delivery Status
    status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed')) DEFAULT 'pending',
    variant_id TEXT, -- For A/B testing
    
    -- Personalization
    personalized_content JSONB, -- Generated personalized content
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    first_click_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    
    -- Engagement
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    clicked_links JSONB DEFAULT '[]',
    
    -- Response
    response_text TEXT,
    response_sentiment TEXT CHECK (response_sentiment IN ('positive', 'neutral', 'negative')),
    
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up sequences
CREATE TABLE public.follow_up_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    
    -- Trigger Conditions
    trigger_type TEXT CHECK (trigger_type IN ('no_open', 'no_click', 'no_response', 'opened', 'clicked', 'responded')),
    trigger_delay_hours INTEGER NOT NULL,
    
    -- Content
    template_id UUID REFERENCES public.campaign_templates(id),
    custom_content JSONB,
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    max_sends_per_recipient INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign analytics events
CREATE TABLE public.campaign_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
    event_type TEXT CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'responded', 'bounced', 'unsubscribed', 'converted')),
    event_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personalization tokens
CREATE TABLE public.personalization_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token_name TEXT NOT NULL,
    token_type TEXT CHECK (token_type IN ('static', 'dynamic', 'ai_generated')),
    default_value TEXT,
    generation_prompt TEXT, -- For AI-generated tokens
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token_name)
);

-- Indexes
CREATE INDEX idx_campaigns_user_status ON public.campaigns(user_id, status);
CREATE INDEX idx_campaign_recipients_campaign_status ON public.campaign_recipients(campaign_id, status);
CREATE INDEX idx_campaign_recipients_lead ON public.campaign_recipients(lead_id);
CREATE INDEX idx_campaign_events_campaign ON public.campaign_events(campaign_id, event_type);
CREATE INDEX idx_follow_up_sequences_campaign ON public.follow_up_sequences(campaign_id, sequence_order);
```

### API Endpoints

```typescript
// /api/campaigns/create
POST /api/campaigns/create
{
  "name": string,
  "channel": "email" | "linkedin" | "sms" | "multi",
  "templateId"?: string,
  "content": {
    "subject"?: string,
    "body": string,
    "personalizationTokens": string[]
  },
  "audience": {
    "leadIds"?: string[],
    "filters"?: {
      "score": { min: number, max: number },
      "status": string[],
      "tags": string[],
      "location": string[]
    }
  },
  "schedule": {
    "startDate": Date,
    "endDate"?: Date,
    "sendWindows": {
      "days": number[],
      "startTime": string,
      "endTime": string
    }
  },
  "abTest"?: {
    "enabled": boolean,
    "variants": Array<{
      "name": string,
      "subject"?: string,
      "content": string,
      "percentage": number
    }>,
    "metric": "open_rate" | "click_rate" | "response_rate"
  }
}

// /api/campaigns/:id/launch
POST /api/campaigns/:id/launch

// /api/campaigns/:id/pause
POST /api/campaigns/:id/pause

// /api/campaigns/:id/analytics
GET /api/campaigns/:id/analytics
Response: {
  "overview": {
    "sent": number,
    "delivered": number,
    "opened": number,
    "clicked": number,
    "responded": number,
    "converted": number
  },
  "rates": {
    "deliveryRate": number,
    "openRate": number,
    "clickRate": number,
    "responseRate": number,
    "conversionRate": number
  },
  "timeline": Array<{
    "date": Date,
    "sent": number,
    "opened": number,
    "clicked": number,
    "responded": number
  }>,
  "abTestResults"?: {
    "winner": string,
    "confidence": number,
    "variantPerformance": Array<{
      "variant": string,
      "metrics": Record<string, number>
    }>
  }
}

// /api/campaigns/:id/recipients
GET /api/campaigns/:id/recipients?status=opened&page=1&limit=50

// /api/campaigns/personalize
POST /api/campaigns/personalize
{
  "templateId": string,
  "leadId": string,
  "aiEnhanced": boolean
}
Response: {
  "personalizedContent": {
    "subject": string,
    "body": string,
    "preview": string
  },
  "tokens": Record<string, string>
}

// /api/follow-ups/configure
POST /api/follow-ups/configure
{
  "campaignId": string,
  "sequences": Array<{
    "trigger": "no_open" | "no_response" | "opened" | "clicked",
    "delayHours": number,
    "content": {
      "templateId"?: string,
      "customContent"?: any
    }
  }>
}
```

### UI Components Design

```typescript
// Campaign Builder Component
interface CampaignBuilder {
  step: 'template' | 'audience' | 'content' | 'schedule' | 'review';
  
  templateSelection: {
    templates: CampaignTemplate[];
    selectedTemplate?: CampaignTemplate;
    createNew: boolean;
  };
  
  audienceBuilder: {
    selectedLeads: string[];
    filters: LeadFilters;
    estimatedReach: number;
    audiencePreview: Lead[];
  };
  
  contentEditor: {
    channel: string;
    subject?: string;
    body: string;
    personalizationTokens: {
      token: string;
      preview: string;
    }[];
    aiSuggestions: {
      tone: string;
      improvements: string[];
    };
  };
  
  scheduleConfig: {
    sendNow: boolean;
    startDate: Date;
    endDate?: Date;
    timezone: string;
    sendWindows: {
      days: string[];
      startTime: string;
      endTime: string;
    };
    throttling: {
      enabled: boolean;
      ratePerHour: number;
    };
  };
  
  abTestConfig: {
    enabled: boolean;
    variants: Array<{
      name: string;
      content: any;
      allocation: number;
    }>;
    successMetric: string;
    minimumSampleSize: number;
  };
}

// Campaign Analytics Dashboard
interface CampaignAnalytics {
  performanceMetrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    responded: number;
    converted: number;
  };
  
  engagementFunnel: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  
  timeSeriesData: {
    date: Date;
    opens: number;
    clicks: number;
    responses: number;
  }[];
  
  recipientEngagement: {
    recipient: Lead;
    status: string;
    engagement: {
      opened: boolean;
      openCount: number;
      clicked: boolean;
      clickedLinks: string[];
      responded: boolean;
      responseText?: string;
    };
  }[];
  
  abTestResults?: {
    variants: Array<{
      name: string;
      sent: number;
      performance: Record<string, number>;
      isWinner: boolean;
    }>;
    confidence: number;
    recommendation: string;
  };
  
  geographicDistribution: {
    location: string;
    openRate: number;
    responseRate: number;
  }[];
}

// Email Template Editor
interface EmailTemplateEditor {
  template: {
    name: string;
    subject: string;
    preheader: string;
    body: string;
    footerType: 'default' | 'custom';
  };
  
  editor: {
    type: 'visual' | 'html' | 'markdown';
    content: string;
    variables: string[];
  };
  
  personalization: {
    tokens: Array<{
      name: string;
      type: 'field' | 'custom' | 'ai';
      value: string;
    }>;
    preview: {
      lead: Lead;
      renderedContent: string;
    };
  };
  
  validation: {
    spamScore: number;
    warnings: string[];
    suggestions: string[];
  };
}
```

---

## 3. Resume Parser & ATS

### Database Schema

```sql
-- Job openings/requisitions
CREATE TABLE public.job_openings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Job Details
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship')),
    remote_type TEXT CHECK (remote_type IN ('onsite', 'remote', 'hybrid')),
    
    -- Requirements
    description TEXT NOT NULL,
    requirements TEXT[],
    nice_to_have TEXT[],
    required_skills TEXT[],
    preferred_skills TEXT[],
    experience_years_min INTEGER,
    experience_years_max INTEGER,
    education_level TEXT,
    
    -- Compensation
    salary_min DECIMAL(12,2),
    salary_max DECIMAL(12,2),
    salary_currency TEXT DEFAULT 'USD',
    benefits TEXT[],
    
    -- Status
    status TEXT CHECK (status IN ('draft', 'open', 'paused', 'closed', 'filled')) DEFAULT 'draft',
    urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    
    -- Tracking
    client_company TEXT,
    hiring_manager TEXT,
    target_hire_date DATE,
    positions_available INTEGER DEFAULT 1,
    positions_filled INTEGER DEFAULT 0,
    
    -- Integration
    external_job_id TEXT,
    posted_to TEXT[], -- job boards where posted
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Applications
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.job_openings(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    
    -- Application Info
    source TEXT CHECK (source IN ('direct', 'referral', 'job_board', 'linkedin', 'website', 'email')),
    source_details TEXT,
    referrer_name TEXT,
    
    -- Status Tracking
    status TEXT CHECK (status IN ('new', 'reviewing', 'phone_screen', 'interview', 'assessment', 'reference_check', 'offer', 'hired', 'rejected', 'withdrawn')) DEFAULT 'new',
    stage_history JSONB DEFAULT '[]', -- Array of stage transitions
    rejection_reason TEXT,
    
    -- Resume Data
    resume_file_id UUID REFERENCES public.documents(id),
    cover_letter_file_id UUID REFERENCES public.documents(id),
    portfolio_url TEXT,
    
    -- Parsed Resume Data
    parsed_resume JSONB DEFAULT '{}',
    parsing_confidence DECIMAL(3,2),
    
    -- Scoring
    overall_score DECIMAL(5,2),
    skill_match_score DECIMAL(5,2),
    experience_match_score DECIMAL(5,2),
    education_match_score DECIMAL(5,2),
    ai_assessment_score DECIMAL(5,2),
    
    -- Ranking
    rank_in_job INTEGER,
    rank_percentile DECIMAL(5,2),
    
    -- Notes & Feedback
    notes TEXT,
    internal_notes TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(job_id, candidate_id)
);

-- Resume parsing results
CREATE TABLE public.resume_parsing_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    
    -- Parsing Status
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    parser_version TEXT,
    
    -- Extracted Data
    contact_info JSONB DEFAULT '{}',
    summary TEXT,
    
    -- Experience
    work_experience JSONB DEFAULT '[]', -- Array of experience objects
    total_experience_months INTEGER,
    
    -- Education
    education JSONB DEFAULT '[]', -- Array of education objects
    highest_degree TEXT,
    
    -- Skills
    technical_skills TEXT[],
    soft_skills TEXT[],
    languages JSONB DEFAULT '[]', -- Array of {language, proficiency}
    
    -- Certifications & Achievements
    certifications JSONB DEFAULT '[]',
    achievements TEXT[],
    publications TEXT[],
    
    -- Additional Info
    keywords TEXT[],
    industry_classification TEXT[],
    
    -- Quality Metrics
    parsing_confidence DECIMAL(3,2),
    completeness_score DECIMAL(3,2),
    formatting_quality TEXT CHECK (formatting_quality IN ('excellent', 'good', 'fair', 'poor')),
    
    parsing_errors JSONB DEFAULT '[]',
    processing_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skill matching rules
CREATE TABLE public.skill_matching_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    primary_skill TEXT NOT NULL,
    synonyms TEXT[],
    related_skills TEXT[],
    skill_category TEXT,
    importance_weight DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application evaluations
CREATE TABLE public.application_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES auth.users(id),
    
    -- Ratings
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    technical_rating INTEGER CHECK (technical_rating BETWEEN 1 AND 5),
    experience_rating INTEGER CHECK (experience_rating BETWEEN 1 AND 5),
    culture_fit_rating INTEGER CHECK (culture_fit_rating BETWEEN 1 AND 5),
    
    -- Feedback
    strengths TEXT[],
    weaknesses TEXT[],
    comments TEXT,
    recommendation TEXT CHECK (recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_openings_status ON public.job_openings(user_id, status);
CREATE INDEX idx_applications_job_status ON public.applications(job_id, status);
CREATE INDEX idx_applications_candidate ON public.applications(candidate_id);
CREATE INDEX idx_applications_score ON public.applications(overall_score DESC);
CREATE INDEX idx_resume_parsing_document ON public.resume_parsing_results(document_id);
```

### API Endpoints

```typescript
// /api/jobs/create
POST /api/jobs/create
{
  "title": string,
  "department": string,
  "location": string,
  "description": string,
  "requirements": string[],
  "skills": {
    "required": string[],
    "preferred": string[]
  },
  "experience": {
    "min": number,
    "max": number
  },
  "salary": {
    "min": number,
    "max": number,
    "currency": string
  }
}

// /api/resume/parse
POST /api/resume/parse
{
  "file": File,
  "jobId"?: string, // Optional: for immediate matching
  "enhanceWithAI": boolean
}
Response: {
  "parsedData": {
    "contact": {
      "name": string,
      "email": string,
      "phone": string,
      "linkedin": string
    },
    "experience": Array<{
      "company": string,
      "title": string,
      "duration": string,
      "description": string
    }>,
    "education": Array<{
      "institution": string,
      "degree": string,
      "field": string,
      "graduationYear": number
    }>,
    "skills": {
      "technical": string[],
      "soft": string[]
    }
  },
  "confidence": number,
  "warnings": string[]
}

// /api/applications/submit
POST /api/applications/submit
{
  "jobId": string,
  "candidateData": {
    "firstName": string,
    "lastName": string,
    "email": string,
    "phone": string
  },
  "resume": File,
  "coverLetter"?: File,
  "source": string,
  "referrer"?: string
}

// /api/applications/:id/evaluate
POST /api/applications/:id/evaluate
{
  "ratings": {
    "overall": number,
    "technical": number,
    "experience": number,
    "cultureFit": number
  },
  "feedback": {
    "strengths": string[],
    "weaknesses": string[],
    "comments": string
  },
  "recommendation": string
}

// /api/applications/rank
POST /api/applications/rank
{
  "jobId": string,
  "criteria": {
    "skillMatch": number, // weight
    "experienceMatch": number,
    "educationMatch": number,
    "aiAssessment": number
  }
}
Response: {
  "rankings": Array<{
    "applicationId": string,
    "candidateName": string,
    "overallScore": number,
    "scoreBreakdown": Record<string, number>,
    "rank": number,
    "percentile": number
  }>
}

// /api/ats/search
POST /api/ats/search
{
  "query": string,
  "filters": {
    "skills": string[],
    "experience": { min: number, max: number },
    "education": string[],
    "location": string[],
    "status": string[]
  },
  "includeExternal": boolean // Search external job boards
}

// /api/skills/extract
POST /api/skills/extract
{
  "text": string,
  "context": "resume" | "job_description"
}
Response: {
  "skills": Array<{
    "skill": string,
    "category": string,
    "confidence": number,
    "synonyms": string[]
  }>
}
```

### UI Components Design

```typescript
// ATS Dashboard
interface ATSDashboard {
  overview: {
    openJobs: number;
    totalApplications: number;
    newApplications: number;
    inReview: number;
    averageTimeToHire: number;
  };
  
  jobPipeline: Array<{
    job: JobOpening;
    stages: Array<{
      name: string;
      count: number;
      candidates: ApplicationSummary[];
    }>;
    metrics: {
      applicationsPerDay: number;
      conversionRate: number;
      topSource: string;
    };
  }>;
  
  recentActivity: Array<{
    type: 'application' | 'evaluation' | 'status_change';
    description: string;
    timestamp: Date;
    user: string;
  }>;
}

// Resume Parser Interface
interface ResumeParserUI {
  uploadSection: {
    dragDropArea: boolean;
    supportedFormats: string[];
    maxFileSize: number;
    batchUpload: boolean;
  };
  
  parsingResults: {
    candidateInfo: {
      name: string;
      email: string;
      phone: string;
      location: string;
      linkedIn: string;
    };
    
    experienceTimeline: Array<{
      company: string;
      role: string;
      duration: string;
      highlights: string[];
    }>;
    
    skillsMatrix: {
      technical: Array<{
        skill: string;
        proficiency: 'beginner' | 'intermediate' | 'expert';
        yearsOfExperience: number;
      }>;
      soft: string[];
      certifications: string[];
    };
    
    aiInsights: {
      summary: string;
      strengths: string[];
      potentialRoles: string[];
      salaryExpectation: { min: number; max: number };
    };
  };
  
  matchingJobs: Array<{
    job: JobOpening;
    matchScore: number;
    matchBreakdown: {
      skills: number;
      experience: number;
      education: number;
      location: number;
    };
  }>;
}

// Application Review Interface
interface ApplicationReview {
  candidate: {
    info: CandidateInfo;
    resume: {
      url: string;
      parsedContent: any;
      highlights: string[];
    };
    applicationDetails: {
      source: string;
      appliedDate: Date;
      coverLetter?: string;
    };
  };
  
  scoring: {
    overallScore: number;
    breakdown: {
      skillMatch: number;
      experienceMatch: number;
      educationMatch: number;
      aiAssessment: number;
    };
    comparison: {
      rankInJob: number;
      totalApplicants: number;
      percentile: number;
    };
  };
  
  evaluation: {
    form: {
      ratings: Record<string, number>;
      feedback: {
        strengths: string[];
        weaknesses: string[];
        notes: string;
      };
      recommendation: string;
    };
    history: Array<{
      evaluator: string;
      date: Date;
      recommendation: string;
      notes: string;
    }>;
  };
  
  actions: {
    moveToStage: string[];
    scheduleInterview: boolean;
    sendEmail: boolean;
    addNote: boolean;
    downloadResume: boolean;
  };
}

// Job Posting Builder
interface JobPostingBuilder {
  basics: {
    title: string;
    department: string;
    location: string;
    employmentType: string;
    remoteOptions: string;
  };
  
  description: {
    editor: 'rich' | 'markdown' | 'ai-assisted';
    content: string;
    aiSuggestions: {
      improvements: string[];
      missingElements: string[];
      biasCheck: {
        score: number;
        issues: string[];
      };
    };
  };
  
  requirements: {
    mustHave: Array<{
      requirement: string;
      category: 'skill' | 'experience' | 'education';
    }>;
    niceToHave: string[];
    dealBreakers: string[];
  };
  
  compensation: {
    salaryRange: { min: number; max: number };
    benefits: string[];
    perks: string[];
  };
  
  distribution: {
    internal: boolean;
    jobBoards: Array<{
      platform: string;
      enabled: boolean;
      lastPosted?: Date;
    }>;
    socialMedia: {
      linkedin: boolean;
      twitter: boolean;
      facebook: boolean;
    };
  };
}
```

---

## 4. AI Interview Center

### Database Schema

```sql
-- Interview templates
CREATE TABLE public.interview_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    interview_type TEXT CHECK (interview_type IN ('screening', 'technical', 'behavioral', 'cultural', 'final')) NOT NULL,
    
    -- Question Configuration
    questions JSONB DEFAULT '[]', -- Array of question objects
    question_count INTEGER,
    duration_minutes INTEGER,
    
    -- AI Settings
    ai_difficulty_level TEXT CHECK (ai_difficulty_level IN ('junior', 'mid', 'senior', 'expert')),
    ai_follow_up_enabled BOOLEAN DEFAULT TRUE,
    ai_personality TEXT CHECK (ai_personality IN ('friendly', 'professional', 'challenging', 'conversational')),
    
    -- Evaluation Criteria
    evaluation_criteria JSONB DEFAULT '{}',
    scoring_rubric JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview sessions
CREATE TABLE public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.interview_templates(id),
    interviewer_id UUID REFERENCES auth.users(id),
    
    -- Session Details
    interview_type TEXT CHECK (interview_type IN ('screening', 'technical', 'behavioral', 'cultural', 'final')) NOT NULL,
    format TEXT CHECK (format IN ('video', 'audio', 'in-person', 'ai-automated')) NOT NULL,
    
    -- Scheduling
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',
    
    -- Status
    status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')) DEFAULT 'scheduled',
    
    -- Meeting Details
    meeting_link TEXT,
    meeting_platform TEXT CHECK (meeting_platform IN ('zoom', 'teams', 'google_meet', 'phone', 'in_person', 'eva_video')),
    meeting_id TEXT,
    access_code TEXT,
    
    -- Recording
    recording_enabled BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    transcript_url TEXT,
    
    -- AI Analysis
    ai_analysis_enabled BOOLEAN DEFAULT TRUE,
    ai_summary TEXT,
    ai_score DECIMAL(5,2),
    ai_recommendations JSONB DEFAULT '{}',
    
    -- Feedback
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    hire_recommendation TEXT CHECK (hire_recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview questions & responses
CREATE TABLE public.interview_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    
    -- Question Details
    question_text TEXT NOT NULL,
    question_type TEXT CHECK (question_type IN ('behavioral', 'technical', 'situational', 'culture', 'general')),
    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert')),
    
    -- Expected Answer (for evaluation)
    expected_answer_points TEXT[],
    evaluation_criteria JSONB DEFAULT '{}',
    
    -- Response
    response_text TEXT,
    response_audio_url TEXT,
    response_video_url TEXT,
    response_duration_seconds INTEGER,
    
    -- AI Evaluation
    ai_transcription TEXT,
    ai_score DECIMAL(5,2),
    ai_feedback TEXT,
    ai_key_points TEXT[],
    ai_concerns TEXT[],
    
    -- Human Evaluation
    human_score INTEGER CHECK (human_score BETWEEN 1 AND 5),
    human_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview availability slots
CREATE TABLE public.interview_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Availability Window
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'America/New_York',
    
    -- Slot Configuration
    slot_duration_minutes INTEGER DEFAULT 60,
    buffer_minutes INTEGER DEFAULT 15,
    
    -- Booking Status
    is_available BOOLEAN DEFAULT TRUE,
    session_id UUID REFERENCES public.interview_sessions(id),
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT, -- RRULE format
    recurrence_end_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI interview analysis
CREATE TABLE public.ai_interview_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    
    -- Communication Analysis
    speech_clarity DECIMAL(5,2),
    pace_score DECIMAL(5,2),
    filler_word_count INTEGER,
    
    -- Content Analysis
    technical_accuracy DECIMAL(5,2),
    answer_completeness DECIMAL(5,2),
    example_quality DECIMAL(5,2),
    
    -- Behavioral Analysis
    confidence_level DECIMAL(5,2),
    enthusiasm_score DECIMAL(5,2),
    professionalism_score DECIMAL(5,2),
    
    -- Key Insights
    strengths TEXT[],
    improvement_areas TEXT[],
    red_flags TEXT[],
    
    -- Comparison
    percentile_rank DECIMAL(5,2), -- Compared to other candidates
    benchmark_comparison JSONB DEFAULT '{}',
    
    -- Recommendations
    next_steps TEXT[],
    interview_feedback TEXT,
    coaching_suggestions TEXT[],
    
    processing_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_interview_sessions_application ON public.interview_sessions(application_id);
CREATE INDEX idx_interview_sessions_scheduled ON public.interview_sessions(scheduled_start, status);
CREATE INDEX idx_interview_availability_user_time ON public.interview_availability(user_id, start_time, is_available);
CREATE INDEX idx_interview_questions_session ON public.interview_questions(session_id, question_order);
```

### API Endpoints

```typescript
// /api/interviews/schedule
POST /api/interviews/schedule
{
  "applicationId": string,
  "interviewType": "screening" | "technical" | "behavioral" | "cultural" | "final",
  "format": "video" | "audio" | "in-person" | "ai-automated",
  "duration": number, // minutes
  "interviewerId"?: string,
  "candidateAvailability": Array<{
    date: Date,
    timeSlots: Array<{ start: string, end: string }>
  }>,
  "sendInvites": boolean
}

// /api/interviews/availability
GET /api/interviews/availability?startDate=2024-01-01&endDate=2024-01-31&interviewerId=xxx
POST /api/interviews/availability
{
  "slots": Array<{
    "startTime": Date,
    "endTime": Date,
    "recurring": boolean,
    "recurrenceRule"?: string
  }>
}

// /api/interviews/:id/start
POST /api/interviews/:id/start
{
  "recordingEnabled": boolean,
  "aiAnalysisEnabled": boolean
}

// /api/interviews/:id/questions/generate
POST /api/interviews/:id/questions/generate
{
  "jobId": string,
  "candidateId": string,
  "questionCount": number,
  "focusAreas": string[],
  "difficulty": "junior" | "mid" | "senior" | "expert"
}
Response: {
  "questions": Array<{
    "question": string,
    "type": string,
    "difficulty": string,
    "evaluationPoints": string[],
    "followUps": string[]
  }>
}

// /api/interviews/:id/evaluate
POST /api/interviews/:id/evaluate
{
  "ratings": {
    "overall": number,
    "technical": number,
    "communication": number,
    "problemSolving": number,
    "cultureFit": number
  },
  "questionScores": Array<{
    "questionId": string,
    "score": number,
    "notes": string
  }>,
  "feedback": {
    "strengths": string[],
    "concerns": string[],
    "notes": string
  },
  "recommendation": "strong_yes" | "yes" | "maybe" | "no" | "strong_no"
}

// /api/interviews/:id/ai-analysis
GET /api/interviews/:id/ai-analysis
Response: {
  "summary": string,
  "scores": {
    "overall": number,
    "technical": number,
    "communication": number,
    "confidence": number,
    "enthusiasm": number
  },
  "insights": {
    "strengths": string[],
    "improvements": string[],
    "redFlags": string[]
  },
  "comparison": {
    "percentile": number,
    "betterThan": number, // percentage
    "benchmarks": Record<string, number>
  },
  "transcript": {
    "fullText": string,
    "keyMoments": Array<{
      "timestamp": string,
      "type": "highlight" | "concern",
      "text": string,
      "note": string
    }>
  }
}

// /api/interviews/feedback-report
POST /api/interviews/feedback-report
{
  "sessionId": string,
  "includeAiAnalysis": boolean,
  "includeTranscript": boolean,
  "recipientEmail": string
}
```

### UI Components Design

```typescript
// Interview Scheduler Component
interface InterviewScheduler {
  calendar: {
    view: 'month' | 'week' | 'day';
    availability: Array<{
      date: Date;
      slots: Array<{
        time: string;
        available: boolean;
        interviewer?: string;
      }>;
    }>;
    selectedSlot?: {
      date: Date;
      time: string;
      duration: number;
    };
  };
  
  interviewConfig: {
    type: string;
    format: string;
    duration: number;
    questions: {
      useTemplate: boolean;
      templateId?: string;
      customQuestions: string[];
      aiGenerated: boolean;
    };
  };
  
  invitations: {
    candidateEmail: string;
    interviewerEmails: string[];
    customMessage: string;
    includePrep: boolean;
    sendReminders: boolean;
  };
}

// AI Interview Interface
interface AIInterviewInterface {
  status: 'waiting' | 'recording' | 'processing' | 'complete';
  
  videoSection: {
    localStream: MediaStream;
    recordingStatus: boolean;
    timeElapsed: number;
    currentQuestion: number;
  };
  
  questionDisplay: {
    current: {
      text: string;
      type: string;
      timeLimit?: number;
    };
    progress: {
      current: number;
      total: number;
      answered: number[];
    };
  };
  
  controls: {
    startRecording: boolean;
    pauseInterview: boolean;
    skipQuestion: boolean;
    endInterview: boolean;
  };
  
  aiAssistant: {
    enabled: boolean;
    hints: string[];
    followUpQuestions: string[];
    encouragement: string;
  };
}

// Interview Evaluation Dashboard
interface InterviewEvaluation {
  session: {
    candidate: CandidateInfo;
    interviewType: string;
    date: Date;
    duration: number;
    recording?: {
      url: string;
      transcript: string;
    };
  };
  
  questions: Array<{
    question: string;
    response: string;
    aiScore: number;
    humanScore?: number;
    evaluation: {
      strengths: string[];
      misses: string[];
      followUpNeeded: boolean;
    };
  }>;
  
  analysis: {
    communication: {
      clarity: number;
      structure: number;
      pace: number;
      fillerWords: string[];
    };
    technical: {
      accuracy: number;
      depth: number;
      problemSolving: number;
    };
    behavioral: {
      confidence: number;
      enthusiasm: number;
      authenticity: number;
    };
  };
  
  comparison: {
    roleAverage: number;
    percentile: number;
    topStrengths: string[];
    improvementAreas: string[];
  };
  
  recommendation: {
    aiSuggestion: string;
    riskFactors: string[];
    nextSteps: string[];
  };
}

// Interview Prep Center
interface InterviewPrepCenter {
  upcomingInterview: {
    date: Date;
    type: string;
    interviewer: string;
    format: string;
    joinLink?: string;
  };
  
  preparation: {
    companyResearch: {
      overview: string;
      culture: string[];
      recentNews: string[];
    };
    roleInsights: {
      keyResponsibilities: string[];
      requiredSkills: string[];
      typicalChallenges: string[];
    };
    practiceQuestions: Array<{
      category: string;
      questions: string[];
      tips: string[];
    }>;
  };
  
  mockInterview: {
    available: boolean;
    aiCoach: boolean;
    recordingEnabled: boolean;
    feedbackType: 'realtime' | 'post-session';
  };
  
  resources: {
    videos: Array<{ title: string; url: string }>;
    articles: Array<{ title: string; url: string }>;
    tips: string[];
  };
}
```

---

## 5. Task Management with Outlook Integration

### Database Schema

```sql
-- Enhanced tasks table for Outlook integration
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlook_id TEXT UNIQUE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlook_category TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlook_importance TEXT CHECK (outlook_importance IN ('low', 'normal', 'high'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_datetime TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlook_sync_status TEXT CHECK (outlook_sync_status IN ('pending', 'synced', 'error'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlook_last_sync TIMESTAMPTZ;

-- Outlook calendar integration
CREATE TABLE public.outlook_calendar_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    
    -- Outlook Details
    outlook_event_id TEXT UNIQUE NOT NULL,
    outlook_calendar_id TEXT,
    outlook_icaluid TEXT,
    
    -- Sync Status
    sync_direction TEXT CHECK (sync_direction IN ('to_outlook', 'from_outlook', 'bidirectional')),
    last_sync TIMESTAMPTZ,
    sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
    conflict_resolution TEXT CHECK (conflict_resolution IN ('outlook_wins', 'eva_wins', 'manual')),
    
    -- Change Tracking
    outlook_last_modified TIMESTAMPTZ,
    eva_last_modified TIMESTAMPTZ,
    change_key TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email-to-task conversion rules
CREATE TABLE public.email_task_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    
    -- Rule Conditions
    email_filters JSONB NOT NULL, -- sender, subject patterns, keywords, etc.
    priority_mapping JSONB DEFAULT '{}', -- map email importance to task priority
    
    -- Task Creation Settings
    auto_create_task BOOLEAN DEFAULT TRUE,
    task_template JSONB DEFAULT '{}', -- default task properties
    assign_to_agent TEXT,
    default_due_date_offset INTEGER, -- days from email received
    
    -- Categories & Tags
    outlook_categories TEXT[],
    eva_tags TEXT[],
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time tracking
CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    
    -- Time Details
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    -- Activity
    activity_type TEXT CHECK (activity_type IN ('focus', 'meeting', 'email', 'break', 'planning', 'other')),
    description TEXT,
    
    -- Productivity Metrics
    productivity_score DECIMAL(3,2),
    interruption_count INTEGER DEFAULT 0,
    
    -- Integration
    outlook_calendar_item_id TEXT,
    auto_tracked BOOLEAN DEFAULT FALSE,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting action items
CREATE TABLE public.meeting_action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    
    -- Action Item Details
    action_text TEXT NOT NULL,
    assigned_to TEXT,
    due_date DATE,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    
    -- Source
    source TEXT CHECK (source IN ('manual', 'ai_extracted', 'attendee_added')),
    confidence_score DECIMAL(3,2), -- for AI extracted items
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productivity analytics
CREATE TABLE public.productivity_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    
    -- Task Metrics
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_overdue INTEGER DEFAULT 0,
    average_task_completion_hours DECIMAL(10,2),
    
    -- Time Metrics
    total_tracked_minutes INTEGER DEFAULT 0,
    focus_time_minutes INTEGER DEFAULT 0,
    meeting_time_minutes INTEGER DEFAULT 0,
    email_time_minutes INTEGER DEFAULT 0,
    
    -- Efficiency Metrics
    task_completion_rate DECIMAL(5,2),
    on_time_completion_rate DECIMAL(5,2),
    average_priority_score DECIMAL(3,2),
    
    -- Outlook Sync Metrics
    emails_processed INTEGER DEFAULT 0,
    meetings_synced INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, metric_date)
);

-- Indexes
CREATE INDEX idx_outlook_calendar_sync_user ON public.outlook_calendar_sync(user_id, sync_status);
CREATE INDEX idx_email_task_rules_user ON public.email_task_rules(user_id, is_active);
CREATE INDEX idx_time_entries_user_date ON public.time_entries(user_id, start_time);
CREATE INDEX idx_meeting_action_items_event ON public.meeting_action_items(calendar_event_id, status);
CREATE INDEX idx_productivity_metrics_user_date ON public.productivity_metrics(user_id, metric_date);
```

### API Endpoints

```typescript
// /api/outlook/auth
POST /api/outlook/auth/connect
GET /api/outlook/auth/callback
POST /api/outlook/auth/refresh
DELETE /api/outlook/auth/disconnect

// /api/outlook/sync
POST /api/outlook/sync/calendar
{
  "startDate": Date,
  "endDate": Date,
  "syncDirection": "to_outlook" | "from_outlook" | "bidirectional",
  "categories": string[]
}

POST /api/outlook/sync/tasks
{
  "folders": string[],
  "includeCompleted": boolean,
  "syncDirection": "to_outlook" | "from_outlook" | "bidirectional"
}

// /api/tasks/from-email
POST /api/tasks/from-email
{
  "emailId": string,
  "extractActionItems": boolean,
  "assignToAgent": string,
  "dueDate": Date,
  "priority": number
}

// /api/tasks/bulk-actions
POST /api/tasks/bulk-actions
{
  "taskIds": string[],
  "action": "complete" | "postpone" | "delegate" | "archive",
  "parameters": {
    "newDueDate"?: Date,
    "assignTo"?: string,
    "notes"?: string
  }
}

// /api/time-tracking/start
POST /api/time-tracking/start
{
  "taskId": string,
  "activityType": string,
  "description": string
}

// /api/time-tracking/stop
POST /api/time-tracking/stop/:entryId

// /api/meetings/:id/extract-actions
POST /api/meetings/:id/extract-actions
{
  "useAI": boolean,
  "meetingNotes"?: string,
  "recordingUrl"?: string
}
Response: {
  "actionItems": Array<{
    "text": string,
    "assignedTo": string,
    "dueDate": Date,
    "confidence": number,
    "context": string
  }>
}

// /api/productivity/dashboard
GET /api/productivity/dashboard?period=week&userId=xxx
Response: {
  "summary": {
    "tasksCompleted": number,
    "productivityScore": number,
    "focusTime": number,
    "meetingTime": number
  },
  "trends": {
    "taskCompletion": Array<{ date: Date, value: number }>,
    "timeDistribution": Array<{ category: string, minutes: number }>,
    "productivityByHour": Array<{ hour: number, score: number }>
  },
  "insights": {
    "mostProductiveTime": string,
    "bottlenecks": string[],
    "recommendations": string[]
  }
}

// /api/email-rules
GET /api/email-rules
POST /api/email-rules
{
  "name": string,
  "filters": {
    "from": string[],
    "subject": string[],
    "keywords": string[],
    "importance": string
  },
  "actions": {
    "createTask": boolean,
    "priority": number,
    "assignTo": string,
    "tags": string[],
    "dueInDays": number
  }
}
```

### UI Components Design

```typescript
// Unified Task & Calendar View
interface UnifiedTaskCalendar {
  view: {
    type: 'calendar' | 'list' | 'kanban' | 'timeline';
    dateRange: { start: Date; end: Date };
    filters: {
      sources: ('eva' | 'outlook' | 'both')[];
      taskTypes: string[];
      priority: number[];
      assignee: string[];
    };
  };
  
  calendarDisplay: {
    events: Array<{
      id: string;
      title: string;
      start: Date;
      end: Date;
      type: 'task' | 'meeting' | 'deadline';
      source: 'eva' | 'outlook';
      color: string;
      icons: string[];
    }>;
    taskDeadlines: Array<{
      date: Date;
      tasks: Task[];
    }>;
    workingHours: {
      start: string;
      end: string;
      breakTimes: Array<{ start: string; end: string }>;
    };
  };
  
  taskList: {
    sections: Array<{
      title: string;
      tasks: Array<{
        task: Task;
        outlookSync: {
          status: string;
          lastSync: Date;
          hasConflict: boolean;
        };
        subtasks: Task[];
        timeTracked: number;
      }>;
    }>;
    quickActions: {
      complete: boolean;
      snooze: boolean;
      delegate: boolean;
      convertToMeeting: boolean;
    };
  };
}

// Email to Task Converter
interface EmailTaskConverter {
  email: {
    from: string;
    subject: string;
    body: string;
    receivedDate: Date;
    importance: string;
    attachments: string[];
  };
  
  extraction: {
    suggestedTitle: string;
    actionItems: Array<{
      text: string;
      confidence: number;
      selected: boolean;
    }>;
    dueDate: Date;
    priority: number;
    relatedContacts: string[];
  };
  
  taskCreation: {
    title: string;
    description: string;
    dueDate: Date;
    priority: number;
    assignTo: string;
    tags: string[];
    attachOriginalEmail: boolean;
    createFollowUp: boolean;
  };
  
  rules: {
    matchedRules: Array<{
      rule: EmailTaskRule;
      confidence: number;
    }>;
    applyRule: boolean;
    customizeBeforeApply: boolean;
  };
}

// Time Tracking Widget
interface TimeTrackingWidget {
  current: {
    isTracking: boolean;
    task: Task;
    startTime: Date;
    elapsed: number;
    activityType: string;
  };
  
  dailySummary: {
    totalTime: number;
    byCategory: Array<{
      category: string;
      duration: number;
      percentage: number;
    }>;
    timeline: Array<{
      start: Date;
      end: Date;
      task: string;
      duration: number;
    }>;
  };
  
  controls: {
    startStop: boolean;
    selectTask: Task[];
    activityTypes: string[];
    notes: string;
    autoTrack: {
      enabled: boolean;
      rules: Array<{
        app: string;
        category: string;
      }>;
    };
  };
}

// Meeting Action Items Extractor
interface MeetingActionExtractor {
  meeting: {
    title: string;
    attendees: string[];
    date: Date;
    duration: number;
    hasRecording: boolean;
    hasTranscript: boolean;
  };
  
  extraction: {
    source: 'notes' | 'transcript' | 'recording';
    content: string;
    processing: boolean;
  };
  
  actionItems: Array<{
    text: string;
    assignedTo: string;
    dueDate: Date;
    context: string;
    confidence: number;
    isSelected: boolean;
    editMode: boolean;
  }>;
  
  review: {
    groupByAssignee: boolean;
    sendNotifications: boolean;
    createTasks: boolean;
    updateOutlook: boolean;
  };
}

// Productivity Dashboard
interface ProductivityDashboard {
  overview: {
    period: 'day' | 'week' | 'month';
    productivityScore: number;
    trend: 'up' | 'down' | 'stable';
    achievements: string[];
  };
  
  metrics: {
    tasks: {
      completed: number;
      created: number;
      overdue: number;
      completionRate: number;
    };
    time: {
      total: number;
      productive: number;
      meetings: number;
      breaks: number;
      untracked: number;
    };
    focus: {
      longestStreak: number;
      averageSession: number;
      interruptions: number;
      deepWorkHours: number;
    };
  };
  
  insights: {
    patterns: Array<{
      insight: string;
      impact: 'positive' | 'negative' | 'neutral';
      recommendation: string;
    }>;
    peakHours: Array<{
      hour: number;
      productivity: number;
    }>;
    taskVelocity: Array<{
      date: Date;
      completed: number;
      created: number;
    }>;
  };
  
  outlookSync: {
    status: 'connected' | 'syncing' | 'error' | 'disconnected';
    lastSync: Date;
    stats: {
      emailsProcessed: number;
      tasksCreated: number;
      eventssynced: number;
      conflictsResolved: number;
    };
  };
}
```

## Implementation Architecture

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (PostgreSQL, Edge Functions, Realtime)
- **AI/ML**: OpenAI GPT-4, Google Gemini, Custom ML models
- **Integrations**: Microsoft Graph API, LinkedIn API, Various email/CRM APIs
- **Infrastructure**: Vercel, Supabase Cloud, Cloudflare Workers

### Security Considerations
1. **Data Encryption**: All sensitive data encrypted at rest and in transit
2. **API Security**: Rate limiting, API key management, OAuth 2.0
3. **Compliance**: GDPR, CCPA compliant data handling
4. **Access Control**: Role-based permissions, row-level security
5. **Audit Logging**: Comprehensive activity tracking

### Performance Optimization
1. **Database**: Proper indexing, query optimization, connection pooling
2. **Caching**: Redis for frequently accessed data
3. **CDN**: Static asset delivery via Cloudflare
4. **Lazy Loading**: Component and data lazy loading
5. **Background Jobs**: Queue system for heavy processing

### Scalability Plan
1. **Horizontal Scaling**: Microservices architecture
2. **Load Balancing**: Distributed across regions
3. **Database Sharding**: For large datasets
4. **Event-Driven**: Async processing for non-critical tasks
5. **Monitoring**: Real-time performance tracking