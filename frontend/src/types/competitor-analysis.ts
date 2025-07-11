export interface Competitor {
  id: string;
  name: string;
  domain: string;
  industry: string;
  description?: string;
  logo?: string;
  primaryColor?: string;
  lastAnalyzed?: string;
  status: 'active' | 'monitoring' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorMetrics {
  competitorId: string;
  marketShare: number;
  growthRate: number;
  customerSatisfaction: number;
  brandStrength: number;
  innovationScore: number;
  onlinePresence: {
    websiteTraffic: number;
    socialMediaFollowers: {
      linkedin?: number;
      twitter?: number;
      facebook?: number;
      instagram?: number;
    };
    seoRanking: number;
    domainAuthority: number;
  };
  financials?: {
    revenue?: number;
    employees?: number;
    funding?: number;
  };
}

export interface CompetitorAnalysis {
  id: string;
  competitorId: string;
  timestamp: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  keyDifferentiators: string[];
  marketPosition: 'leader' | 'challenger' | 'follower' | 'nicher';
  competitiveAdvantages: string[];
  riskFactors: string[];
}

export interface ContentGap {
  id: string;
  topic: string;
  competitorCoverage: {
    competitorId: string;
    hasContent: boolean;
    contentQuality: number;
    contentUrl?: string;
  }[];
  opportunity: 'high' | 'medium' | 'low';
  suggestedAction: string;
  potentialImpact: number;
}

export interface PricingIntelligence {
  competitorId: string;
  products: {
    name: string;
    price: number;
    currency: string;
    billingCycle?: 'monthly' | 'yearly' | 'one-time';
    features: string[];
  }[];
  pricingStrategy: 'premium' | 'competitive' | 'penetration' | 'freemium';
  averagePrice: number;
  pricePositioning: number; // -100 to 100 (negative = below market, positive = above)
}

export interface CompetitorAlert {
  id: string;
  competitorId: string;
  type: 'product_launch' | 'pricing_change' | 'content_update' | 'leadership_change' | 'funding' | 'partnership';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  detectedAt: string;
  source: string;
  actionRequired: boolean;
  suggestedResponse?: string;
}

export interface ComparisonMatrix {
  features: {
    name: string;
    category: string;
    competitors: {
      competitorId: string;
      hasFeature: boolean;
      quality?: number; // 1-10
      notes?: string;
    }[];
  }[];
  overallComparison: {
    competitorId: string;
    overallScore: number;
    rank: number;
  }[];
}

export interface MarketTrend {
  id: string;
  trend: string;
  category: 'technology' | 'customer_preference' | 'regulation' | 'economic' | 'social';
  impact: 'positive' | 'negative' | 'neutral';
  relevance: number; // 0-100
  competitors: {
    competitorId: string;
    adaptation: 'leading' | 'following' | 'ignoring';
    actions: string[];
  }[];
  recommendations: string[];
}

export interface CompetitorDiscovery {
  suggestedCompetitors: {
    name: string;
    domain: string;
    reason: string;
    similarityScore: number;
    sharedKeywords: string[];
    overlappingMarkets: string[];
  }[];
}

export interface AnalysisSchedule {
  competitorId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastRun?: string;
  nextRun: string;
  analysisTypes: ('metrics' | 'content' | 'pricing' | 'social')[];
  emailAlerts: boolean;
  alertThreshold: 'all' | 'high' | 'critical';
}

export interface CompetitorAnalysisConfig {
  userId: string;
  autoDiscovery: boolean;
  trackingEnabled: boolean;
  alertPreferences: {
    email: boolean;
    inApp: boolean;
    alertTypes: CompetitorAlert['type'][];
    severityThreshold: CompetitorAlert['severity'];
  };
  analysisDepth: 'basic' | 'standard' | 'deep';
  industryFocus: string[];
  geographicFocus?: string[];
}

export interface CompetitorInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  evidence: string[];
  confidence: number; // 0-100
  actionable: boolean;
  suggestedActions?: string[];
  impact: 'high' | 'medium' | 'low';
}

export interface SEOComparison {
  competitorId: string;
  metrics: {
    domainAuthority: number;
    pageAuthority: number;
    backlinks: number;
    referringDomains: number;
    organicKeywords: number;
    organicTraffic: number;
    topKeywords: {
      keyword: string;
      position: number;
      volume: number;
      difficulty: number;
    }[];
  };
  contentAnalysis: {
    totalPages: number;
    avgWordCount: number;
    contentFreshness: number; // 0-100
    topPerformingContent: {
      url: string;
      title: string;
      traffic: number;
      backlinks: number;
    }[];
  };
}

export interface SocialMediaAnalysis {
  competitorId: string;
  platforms: {
    platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram' | 'youtube';
    metrics: {
      followers: number;
      engagement: number;
      postFrequency: number;
      avgLikes: number;
      avgComments: number;
      avgShares: number;
    };
    topPosts: {
      url: string;
      content: string;
      engagement: number;
      type: 'text' | 'image' | 'video' | 'link';
      postedAt: string;
    }[];
    contentThemes: string[];
  }[];
  overallEngagement: number;
  audienceGrowth: number;
}