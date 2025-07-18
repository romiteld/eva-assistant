import { supabase } from '@/lib/supabase/browser';
import { FirecrawlService } from './firecrawl';
import { 
  Competitor, 
  CompetitorAlert,
  MarketTrend,
  CompetitorDiscovery
} from '@/types/competitor-analysis';

// Initialize Firecrawl client
const getFirecrawlService = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn('Firecrawl API key not found. Using mock data.');
    return null;
  }
  return new FirecrawlService({ apiKey });
};

// Adapter to work with existing database schema
export class CompetitorAnalysisAdapter {
  // Convert database competitor analysis to our Competitor type
  private dbToCompetitor(dbRow: any): Competitor {
    return {
      id: dbRow.id,
      name: dbRow.competitor_name,
      domain: dbRow.competitor_url || '',
      industry: dbRow.platform || 'Unknown',
      description: dbRow.findings?.description || '',
      logo: dbRow.findings?.logo || '',
      primaryColor: dbRow.findings?.primaryColor || '',
      lastAnalyzed: dbRow.last_analyzed_at,
      status: 'active',
      createdAt: dbRow.created_at,
      updatedAt: dbRow.created_at
    };
  }

  // Get all competitors for the current user
  async getCompetitors(): Promise<Competitor[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('competitor_analyses')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by competitor name and get the latest analysis for each
    const competitorMap = new Map<string, any>();
    
    data?.forEach(row => {
      const existing = competitorMap.get(row.competitor_name);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        competitorMap.set(row.competitor_name, row);
      }
    });

    return Array.from(competitorMap.values()).map(row => this.dbToCompetitor(row));
  }

  // Add a new competitor
  async addCompetitor(competitor: Partial<Competitor>): Promise<Competitor> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('competitor_analyses')
      .insert({
        user_id: userData.user.id,
        competitor_name: competitor.name,
        competitor_url: competitor.domain,
        platform: competitor.industry || 'General',
        analysis_type: 'initial',
        findings: {
          description: competitor.description,
          status: 'active'
        },
        last_analyzed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return this.dbToCompetitor(data);
  }

  // Update competitor analysis with Firecrawl integration
  async analyzeCompetitor(competitorId: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) throw new Error('User not authenticated');

    // Get existing competitor
    const { data: existing, error: fetchError } = await supabase
      .from('competitor_analyses')
      .select('*')
      .eq('id', competitorId)
      .eq('user_id', userData.user.id)
      .single();

    if (fetchError) throw fetchError;

    let analysisFindings = existing.findings || {};

    // Try to scrape competitor website with Firecrawl
    const firecrawlService = getFirecrawlService();
    if (firecrawlService && existing.competitor_url) {
      try {
        const scrapeResult = await firecrawlService.scrapeUrl(existing.competitor_url);

        if (scrapeResult?.data) {
          // Extract competitor intelligence from scraped content
          const intelligence = this.extractCompetitorIntelligence(scrapeResult.data);
          analysisFindings = {
            ...analysisFindings,
            ...intelligence,
            scrapedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('Firecrawl scraping failed:', error);
        // Continue with basic analysis even if scraping fails
      }
    }

    // Update with new analysis timestamp and findings
    const { error } = await supabase
      .from('competitor_analyses')
      .update({
        last_analyzed_at: new Date().toISOString(),
        findings: {
          ...analysisFindings,
          lastAnalysis: {
            timestamp: new Date().toISOString(),
            status: 'completed'
          }
        }
      })
      .eq('id', competitorId);

    if (error) throw error;
  }

  // Extract competitor intelligence from scraped content
  private extractCompetitorIntelligence(content: string): any {
    const intelligence: any = {
      keyServices: [],
      pricingMentions: [],
      contactInfo: {},
      socialLinks: [],
      technologies: [],
      marketingMessages: []
    };

    // Extract key services (simple keyword matching)
    const serviceKeywords = [
      'recruitment', 'hiring', 'talent', 'advisor', 'financial', 'consultant',
      'placement', 'search', 'executive', 'headhunting', 'staffing'
    ];
    
    serviceKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches && matches.length > 2) {
        intelligence.keyServices.push(keyword);
      }
    });

    // Extract pricing mentions
    const pricingRegex = /\$[\d,]+|\d+%\s*(?:fee|commission|rate)/gi;
    const pricingMatches = content.match(pricingRegex);
    if (pricingMatches) {
      intelligence.pricingMentions = pricingMatches.slice(0, 5);
    }

    // Extract contact information
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /\+?[\d\s\-\(\)]{10,}/g;
    
    const emails = content.match(emailRegex);
    const phones = content.match(phoneRegex);
    
    if (emails) intelligence.contactInfo.emails = emails.slice(0, 3);
    if (phones) intelligence.contactInfo.phones = phones.slice(0, 3);

    // Extract social media links
    const socialRegex = /(linkedin|twitter|facebook|instagram)\.com\/[\w\-\.]+/gi;
    const socialMatches = content.match(socialRegex);
    if (socialMatches) {
      intelligence.socialLinks = socialMatches.slice(0, 5);
    }

    // Extract technology mentions
    const techKeywords = ['AI', 'machine learning', 'automation', 'CRM', 'API', 'cloud', 'SaaS'];
    techKeywords.forEach(tech => {
      const regex = new RegExp(`\\b${tech}\\b`, 'gi');
      if (content.match(regex)) {
        intelligence.technologies.push(tech);
      }
    });

    return intelligence;
  }

  // Remove competitor
  async removeCompetitor(competitorId: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('competitor_analyses')
      .delete()
      .eq('id', competitorId)
      .eq('user_id', userData.user.id);

    if (error) throw error;
  }

  // Get alerts (mock data for now)
  async getAlerts(): Promise<CompetitorAlert[]> {
    // Return mock alerts since we don't have an alerts table
    return [
      {
        id: '1',
        competitorId: '1',
        type: 'product_launch',
        severity: 'high',
        title: 'Competitor launched new AI feature',
        description: 'A major competitor has launched an AI-powered recruitment assistant similar to EVA.',
        detectedAt: new Date().toISOString(),
        source: 'Website update',
        actionRequired: true,
        suggestedResponse: 'Consider highlighting EVA\'s unique features and advanced capabilities in marketing materials.'
      }
    ];
  }

  // Discover competitors using Firecrawl search
  async discoverCompetitors(
    industry: string,
    keywords: string[],
    currentDomain?: string
  ): Promise<CompetitorDiscovery> {
    const firecrawlService = getFirecrawlService();
    
    if (!firecrawlService) {
      // Fallback to mock data if Firecrawl is not available
      return this.getMockCompetitorDiscovery(industry, keywords, currentDomain);
    }

    const suggestedCompetitors = [];
    
    try {
      // Search for competitors using industry + keywords
      const searchQuery = `${industry} ${keywords.join(' ')} companies`;
      const searchResults = await firecrawlService.search(searchQuery);

      if (searchResults?.data) {
        for (const result of searchResults.data) {
          // Skip if it's the current domain
          if (currentDomain && result.url?.includes(currentDomain)) {
            continue;
          }

          // Extract domain from URL
          const domain = this.extractDomainFromUrl(result.url);
          if (!domain) continue;

          // Calculate similarity score based on content
          const similarityScore = this.calculateSimilarityScore(
            result.content || result.description || '',
            keywords
          );

          // Only include if similarity score is reasonable
          if (similarityScore > 30) {
            const sharedKeywords = this.extractSharedKeywords(
              result.content || result.description || '',
              keywords
            );

            suggestedCompetitors.push({
              name: result.title || domain,
              domain: domain,
              reason: this.generateCompetitorReason(result, industry),
              similarityScore,
              sharedKeywords,
              overlappingMarkets: [industry]
            });
          }
        }
      }
    } catch (error) {
      console.error('Firecrawl search failed:', error);
      // Fallback to mock data
      return this.getMockCompetitorDiscovery(industry, keywords, currentDomain);
    }

    return {
      suggestedCompetitors: suggestedCompetitors.slice(0, 10)
    };
  }

  // Helper methods for competitor discovery
  private getMockCompetitorDiscovery(
    industry: string,
    keywords: string[],
    currentDomain?: string
  ): CompetitorDiscovery {
    const mockCompetitors = [
      {
        name: 'RecruitTech Solutions',
        domain: 'recruittech.com',
        reason: 'Leading recruitment platform in financial services',
        similarityScore: 85,
        sharedKeywords: ['recruitment', 'financial', 'advisor'],
        overlappingMarkets: ['Financial Services', 'Recruitment']
      },
      {
        name: 'TalentFinder Pro',
        domain: 'talentfinderpro.com',
        reason: 'AI-powered talent acquisition platform',
        similarityScore: 78,
        sharedKeywords: ['AI', 'recruitment', 'talent'],
        overlappingMarkets: ['Recruitment', 'AI Technology']
      },
      {
        name: 'AdvisorMatch',
        domain: 'advisormatch.com',
        reason: 'Specialized in financial advisor placement',
        similarityScore: 92,
        sharedKeywords: ['advisor', 'financial', 'placement'],
        overlappingMarkets: ['Financial Services']
      }
    ];

    return {
      suggestedCompetitors: mockCompetitors.filter(comp => 
        comp.domain !== currentDomain
      )
    };
  }

  private extractDomainFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }

  private calculateSimilarityScore(content: string, keywords: string[]): number {
    if (!content) return 0;

    const contentLower = content.toLowerCase();
    let score = 0;

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const matches = (contentLower.match(new RegExp(`\\b${keywordLower}\\b`, 'g')) || []).length;
      score += matches * 10; // Each keyword match adds 10 points
    });

    // Bonus for recruitment/hiring related terms
    const recruitmentTerms = ['recruitment', 'hiring', 'talent', 'staffing', 'placement', 'executive search'];
    recruitmentTerms.forEach(term => {
      if (contentLower.includes(term)) {
        score += 15;
      }
    });

    return Math.min(score, 100); // Cap at 100
  }

  private extractSharedKeywords(content: string, keywords: string[]): string[] {
    if (!content) return [];

    const contentLower = content.toLowerCase();
    const shared = [];

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if (contentLower.includes(keywordLower)) {
        shared.push(keyword);
      }
    });

    return shared;
  }

  private generateCompetitorReason(result: any, industry: string): string {
    const shared: any[] = [];
    const reasons = [
      `Active in ${industry} industry`,
      'Similar target market and services',
      'Competitive offering in the same space',
      'Overlapping customer base',
      'Similar business model and approach'
    ];

    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  // Get market trends (mock data)
  async getMarketTrends(industry: string): Promise<MarketTrend[]> {
    return [
      {
        id: '1',
        trend: 'AI-Powered Recruitment Tools',
        category: 'technology' as const,
        impact: 'positive',
        relevance: 95,
        recommendations: [
          'Enhance AI capabilities in EVA',
          'Highlight AI features in marketing',
          'Develop unique AI differentiators'
        ]
      },
      {
        id: '2',
        trend: 'Remote Hiring Surge',
        category: 'economic' as const,
        impact: 'positive',
        relevance: 88,
        recommendations: [
          'Optimize for remote recruitment workflows',
          'Add video interview features',
          'Enhance digital onboarding tools'
        ]
      }
    ];
  }
}

// Export singleton instance
export const competitorAnalysisAdapter = new CompetitorAnalysisAdapter();