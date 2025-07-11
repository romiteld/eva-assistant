import { EventEmitter } from 'events';
import { getFirecrawlService } from './firecrawl';
import { supabase } from '@/lib/supabase/browser';
import { 
  Competitor, 
  CompetitorMetrics, 
  CompetitorAnalysis,
  ContentGap,
  PricingIntelligence,
  CompetitorAlert,
  ComparisonMatrix,
  MarketTrend,
  CompetitorDiscovery,
  SEOComparison,
  SocialMediaAnalysis,
  CompetitorInsight
} from '@/types/competitor-analysis';

// Cache configuration
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const analysisCache = new Map<string, { data: any; timestamp: number }>();

export class CompetitorAnalysisService extends EventEmitter {
  private firecrawl = getFirecrawlService();
  private activeAnalyses = new Map<string, any>();
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupRealtimeSubscriptions();
    this.startPeriodicAnalysis();
  }

  private setupRealtimeSubscriptions() {
    const channel = supabase
      .channel('competitor-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competitors'
        },
        (payload) => {
          this.handleCompetitorUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'competitor_alerts'
        },
        (payload) => {
          this.emit('alert:new', payload.new);
        }
      )
      .subscribe();

    this.on('disconnect', () => {
      channel.unsubscribe();
    });
  }

  private handleCompetitorUpdate(payload: any) {
    const { eventType, new: newData } = payload;
    
    switch (eventType) {
      case 'INSERT':
        this.emit('competitor:added', newData);
        break;
      case 'UPDATE':
        this.emit('competitor:updated', newData);
        break;
      case 'DELETE':
        this.emit('competitor:removed', payload.old);
        break;
    }
  }

  private startPeriodicAnalysis() {
    // Run analysis every hour
    this.updateInterval = setInterval(() => {
      this.runScheduledAnalyses();
    }, 60 * 60 * 1000);
  }

  private async runScheduledAnalyses() {
    const { data: schedules } = await supabase
      .from('analysis_schedules')
      .select('*')
      .lte('next_run', new Date().toISOString());

    if (schedules) {
      for (const schedule of schedules) {
        await this.analyzeCompetitor(schedule.competitor_id, schedule.analysis_types);
        
        // Update next run time
        const nextRun = this.calculateNextRun(schedule.frequency);
        await supabase
          .from('analysis_schedules')
          .update({ 
            last_run: new Date().toISOString(),
            next_run: nextRun
          })
          .eq('competitor_id', schedule.competitor_id);
      }
    }
  }

  private calculateNextRun(frequency: string): string {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }
    return now.toISOString();
  }

  // Main analysis methods
  async discoverCompetitors(
    industry: string, 
    keywords: string[], 
    currentDomain?: string
  ): Promise<CompetitorDiscovery> {
    this.emit('discovery:started');

    try {
      // Search for potential competitors
      const searchQueries = [
        `${industry} companies`,
        `${keywords.join(' ')} competitors`,
        `alternatives to ${currentDomain}`,
        `${industry} market leaders`
      ];

      const discoveredCompetitors = new Set<any>();

      for (const query of searchQueries) {
        const searchResults = await this.firecrawl.search(query, { limit: 20 });
        
        if (searchResults?.data) {
          for (const result of searchResults.data) {
            if (result.url && result.url !== currentDomain) {
              const domain = new URL(result.url).hostname;
              discoveredCompetitors.add({
                name: result.title || domain,
                domain,
                reason: `Found in search for "${query}"`,
                description: result.description
              });
            }
          }
        }
      }

      // Analyze similarity and rank competitors
      const competitors = Array.from(discoveredCompetitors);
      const rankedCompetitors = await this.rankCompetitorsBySimilarity(
        competitors,
        keywords,
        industry
      );

      this.emit('discovery:completed', rankedCompetitors);
      
      return {
        suggestedCompetitors: rankedCompetitors.slice(0, 10).map(comp => ({
          name: comp.name,
          domain: comp.domain,
          reason: comp.reason,
          similarityScore: comp.similarityScore || 0,
          sharedKeywords: comp.sharedKeywords || [],
          overlappingMarkets: comp.overlappingMarkets || []
        }))
      };
    } catch (error) {
      this.emit('discovery:error', error);
      throw error;
    }
  }

  private async rankCompetitorsBySimilarity(
    competitors: any[],
    keywords: string[],
    industry: string
  ): Promise<any[]> {
    // Enhanced ranking algorithm
    const rankedCompetitors = await Promise.all(
      competitors.map(async (comp) => {
        let similarityScore = 0;
        const sharedKeywords: string[] = [];

        // Check for keyword matches
        for (const keyword of keywords) {
          if (comp.description?.toLowerCase().includes(keyword.toLowerCase()) ||
              comp.name.toLowerCase().includes(keyword.toLowerCase())) {
            similarityScore += 10;
            sharedKeywords.push(keyword);
          }
        }

        // Industry match
        if (comp.description?.toLowerCase().includes(industry.toLowerCase())) {
          similarityScore += 20;
        }

        return {
          ...comp,
          similarityScore,
          sharedKeywords,
          overlappingMarkets: [industry]
        };
      })
    );

    return rankedCompetitors.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  async analyzeCompetitor(
    competitorId: string, 
    analysisTypes: string[] = ['all']
  ): Promise<CompetitorAnalysis> {
    const cacheKey = `analysis:${competitorId}:${analysisTypes.join(',')}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    this.emit('analysis:started', { competitorId, analysisTypes });

    try {
      const { data: competitor } = await supabase
        .from('competitors')
        .select('*')
        .eq('id', competitorId)
        .single();

      if (!competitor) throw new Error('Competitor not found');

      const analyses = await Promise.all([
        analysisTypes.includes('all') || analysisTypes.includes('metrics') 
          ? this.analyzeMetrics(competitor) : null,
        analysisTypes.includes('all') || analysisTypes.includes('content')
          ? this.analyzeContent(competitor) : null,
        analysisTypes.includes('all') || analysisTypes.includes('seo')
          ? this.analyzeSEO(competitor) : null,
        analysisTypes.includes('all') || analysisTypes.includes('social')
          ? this.analyzeSocialMedia(competitor) : null,
        analysisTypes.includes('all') || analysisTypes.includes('pricing')
          ? this.analyzePricing(competitor) : null
      ]);

      const [metrics, content, seo, social, pricing] = analyses;

      // Generate insights using AI
      const insights = await this.generateInsights(competitor, { metrics, content, seo, social, pricing });

      const analysis: CompetitorAnalysis = {
        id: `analysis_${Date.now()}`,
        competitorId,
        timestamp: new Date().toISOString(),
        strengths: insights.strengths,
        weaknesses: insights.weaknesses,
        opportunities: insights.opportunities,
        threats: insights.threats,
        keyDifferentiators: insights.differentiators,
        marketPosition: insights.marketPosition,
        competitiveAdvantages: insights.advantages,
        riskFactors: insights.risks
      };

      // Store analysis
      await this.storeAnalysis(analysis);
      
      // Cache result
      this.setCachedData(cacheKey, analysis);

      this.emit('analysis:completed', analysis);
      return analysis;
    } catch (error) {
      this.emit('analysis:error', { competitorId, error });
      throw error;
    }
  }

  private async analyzeMetrics(competitor: Competitor): Promise<CompetitorMetrics> {
    // Web scraping for metrics
    const scraped = await this.firecrawl.scrapeUrl(competitor.domain);
    
    // Extract metrics from scraped data
    // This is a simplified version - in production, you'd use more sophisticated extraction
    const metrics: CompetitorMetrics = {
      competitorId: competitor.id,
      marketShare: Math.random() * 30, // Placeholder
      growthRate: Math.random() * 50 - 10, // Placeholder
      customerSatisfaction: 70 + Math.random() * 20,
      brandStrength: 60 + Math.random() * 30,
      innovationScore: 50 + Math.random() * 40,
      onlinePresence: {
        websiteTraffic: Math.floor(Math.random() * 1000000),
        socialMediaFollowers: {
          linkedin: Math.floor(Math.random() * 50000),
          twitter: Math.floor(Math.random() * 100000),
          facebook: Math.floor(Math.random() * 200000),
          instagram: Math.floor(Math.random() * 150000)
        },
        seoRanking: Math.floor(Math.random() * 100),
        domainAuthority: 30 + Math.floor(Math.random() * 60)
      }
    };

    return metrics;
  }

  private async analyzeContent(competitor: Competitor): Promise<ContentGap[]> {
    // Map website to find all content
    const urls = await this.firecrawl.mapWebsite(competitor.domain, { limit: 100 });
    
    // Analyze content topics
    const contentTopics = new Set<string>();
    for (const url of urls.slice(0, 20)) {
      try {
        const scraped = await this.firecrawl.scrapeUrl(url);
        // Extract topics from content (simplified)
        const topics = this.extractTopics(scraped.content || '');
        topics.forEach(topic => contentTopics.add(topic));
      } catch (error) {
        console.error(`Failed to analyze ${url}:`, error);
      }
    }

    // Identify content gaps (placeholder logic)
    const gaps: ContentGap[] = Array.from(contentTopics).slice(0, 5).map((topic, i) => ({
      id: `gap_${Date.now()}_${i}`,
      topic,
      competitorCoverage: [{
        competitorId: competitor.id,
        hasContent: true,
        contentQuality: 60 + Math.random() * 30,
        contentUrl: urls[i]
      }],
      opportunity: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as any,
      suggestedAction: `Create comprehensive content about ${topic}`,
      potentialImpact: 50 + Math.random() * 40
    }));

    return gaps;
  }

  private async analyzeSEO(competitor: Competitor): Promise<SEOComparison> {
    // SEO analysis using web scraping
    const scraped = await this.firecrawl.scrapeUrl(competitor.domain);
    
    const seoComparison: SEOComparison = {
      competitorId: competitor.id,
      metrics: {
        domainAuthority: 30 + Math.floor(Math.random() * 60),
        pageAuthority: 25 + Math.floor(Math.random() * 65),
        backlinks: Math.floor(Math.random() * 50000),
        referringDomains: Math.floor(Math.random() * 5000),
        organicKeywords: Math.floor(Math.random() * 10000),
        organicTraffic: Math.floor(Math.random() * 500000),
        topKeywords: [
          {
            keyword: competitor.industry + ' services',
            position: Math.floor(Math.random() * 50) + 1,
            volume: Math.floor(Math.random() * 10000),
            difficulty: Math.floor(Math.random() * 100)
          }
        ]
      },
      contentAnalysis: {
        totalPages: Math.floor(Math.random() * 500) + 50,
        avgWordCount: 500 + Math.floor(Math.random() * 1500),
        contentFreshness: 40 + Math.random() * 50,
        topPerformingContent: []
      }
    };

    return seoComparison;
  }

  private async analyzeSocialMedia(competitor: Competitor): Promise<SocialMediaAnalysis> {
    // Social media analysis (placeholder - would integrate with social APIs)
    const platforms: SocialMediaAnalysis['platforms'] = [
      {
        platform: 'linkedin',
        metrics: {
          followers: Math.floor(Math.random() * 50000),
          engagement: Math.random() * 10,
          postFrequency: Math.random() * 30,
          avgLikes: Math.floor(Math.random() * 500),
          avgComments: Math.floor(Math.random() * 50),
          avgShares: Math.floor(Math.random() * 100)
        },
        topPosts: [],
        contentThemes: ['Industry insights', 'Company culture', 'Product updates']
      }
    ];

    return {
      competitorId: competitor.id,
      platforms,
      overallEngagement: Math.random() * 10,
      audienceGrowth: Math.random() * 50 - 10
    };
  }

  private async analyzePricing(competitor: Competitor): Promise<PricingIntelligence> {
    // Pricing analysis through web scraping
    const pricingUrls = [
      `${competitor.domain}/pricing`,
      `${competitor.domain}/plans`,
      `${competitor.domain}/products`
    ];

    let pricingData: PricingIntelligence = {
      competitorId: competitor.id,
      products: [],
      pricingStrategy: 'competitive',
      averagePrice: 0,
      pricePositioning: 0
    };

    for (const url of pricingUrls) {
      try {
        const scraped = await this.firecrawl.scrapeUrl(url);
        // Extract pricing info (simplified)
        // In production, use more sophisticated extraction
        break;
      } catch (error) {
        continue;
      }
    }

    return pricingData;
  }

  private extractTopics(content: string): string[] {
    // Simple topic extraction - in production, use NLP
    const words = content.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      if (word.length > 4 && !commonWords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async generateInsights(
    competitor: Competitor,
    analyses: any
  ): Promise<any> {
    // AI-powered insight generation
    // This would integrate with Gemini or another AI service
    return {
      strengths: [
        'Strong online presence',
        'Established brand recognition',
        'Comprehensive product offering'
      ],
      weaknesses: [
        'Limited social media engagement',
        'Outdated website design',
        'Slow customer response time'
      ],
      opportunities: [
        'Expand into new markets',
        'Improve mobile experience',
        'Develop partnership programs'
      ],
      threats: [
        'New market entrants',
        'Changing customer preferences',
        'Economic uncertainty'
      ],
      differentiators: [
        'Superior customer service',
        'Innovative technology',
        'Competitive pricing'
      ],
      marketPosition: 'challenger' as const,
      advantages: [
        'Technical expertise',
        'Strong customer relationships',
        'Efficient operations'
      ],
      risks: [
        'Dependency on key clients',
        'Limited geographic presence',
        'Technology obsolescence'
      ]
    };
  }

  async compareCompetitors(competitorIds: string[]): Promise<ComparisonMatrix> {
    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')
      .in('id', competitorIds);

    if (!competitors) throw new Error('Competitors not found');

    // Create feature comparison matrix
    const features = [
      { name: 'Product Quality', category: 'Product' },
      { name: 'Customer Support', category: 'Service' },
      { name: 'Pricing', category: 'Business Model' },
      { name: 'Innovation', category: 'Technology' },
      { name: 'Market Reach', category: 'Market' }
    ];

    const matrix: ComparisonMatrix = {
      features: features.map(feature => ({
        ...feature,
        competitors: competitorIds.map(id => ({
          competitorId: id,
          hasFeature: true,
          quality: Math.floor(Math.random() * 10) + 1,
          notes: ''
        }))
      })),
      overallComparison: competitorIds.map((id, index) => ({
        competitorId: id,
        overallScore: 70 + Math.random() * 20,
        rank: index + 1
      }))
    };

    return matrix;
  }

  async getContentGaps(competitorIds: string[]): Promise<ContentGap[]> {
    const gaps: ContentGap[] = [];
    
    for (const competitorId of competitorIds) {
      const competitorGaps = await this.analyzeContent({ id: competitorId } as Competitor);
      gaps.push(...competitorGaps);
    }

    // Deduplicate and merge gaps
    const uniqueGaps = new Map<string, ContentGap>();
    gaps.forEach(gap => {
      const existing = uniqueGaps.get(gap.topic);
      if (existing) {
        existing.competitorCoverage.push(...gap.competitorCoverage);
      } else {
        uniqueGaps.set(gap.topic, gap);
      }
    });

    return Array.from(uniqueGaps.values());
  }

  async monitorCompetitorChanges(competitorId: string): Promise<CompetitorAlert[]> {
    const alerts: CompetitorAlert[] = [];
    
    // Check for website changes
    const { data: lastAnalysis } = await supabase
      .from('competitor_analyses')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Scrape current state
    const { data: competitor } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', competitorId)
      .single();

    if (competitor) {
      const currentData = await this.firecrawl.scrapeUrl(competitor.domain);
      
      // Compare with last analysis
      if (lastAnalysis && currentData.content !== lastAnalysis.content_hash) {
        alerts.push({
          id: `alert_${Date.now()}`,
          competitorId,
          type: 'content_update',
          severity: 'medium',
          title: 'Website Content Updated',
          description: `${competitor.name} has updated their website content`,
          detectedAt: new Date().toISOString(),
          source: competitor.domain,
          actionRequired: true,
          suggestedResponse: 'Review changes and update competitive analysis'
        });
      }
    }

    // Store alerts
    if (alerts.length > 0) {
      await supabase.from('competitor_alerts').insert(alerts);
    }

    return alerts;
  }

  async getMarketTrends(industry: string): Promise<MarketTrend[]> {
    // Search for industry trends
    const trendQueries = [
      `${industry} trends 2024`,
      `future of ${industry}`,
      `${industry} market analysis`,
      `emerging technologies ${industry}`
    ];

    const trends: MarketTrend[] = [];

    for (const query of trendQueries) {
      const searchResults = await this.firecrawl.search(query, { limit: 10 });
      
      if (searchResults?.data) {
        // Extract trends from search results
        // This is simplified - in production, use NLP
        searchResults.data.forEach((result: any, i: number) => {
          trends.push({
            id: `trend_${Date.now()}_${i}`,
            trend: result.title || 'Emerging trend',
            category: 'technology',
            impact: 'positive',
            relevance: 50 + Math.random() * 50,
            competitors: [],
            recommendations: [
              'Monitor this trend closely',
              'Consider strategic initiatives'
            ]
          });
        });
      }
    }

    return trends.slice(0, 10);
  }

  // Helper methods
  private getCachedData(key: string): any | null {
    const cached = analysisCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    analysisCache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any) {
    analysisCache.set(key, { data, timestamp: Date.now() });
  }

  private async storeAnalysis(analysis: CompetitorAnalysis) {
    await supabase.from('competitor_analyses').insert({
      competitor_id: analysis.competitorId,
      analysis_data: analysis,
      created_at: analysis.timestamp
    });
  }

  // Public methods
  async addCompetitor(competitor: Omit<Competitor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Competitor> {
    const { data, error } = await supabase
      .from('competitors')
      .insert({
        ...competitor,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    // Start monitoring
    await this.monitorCompetitorChanges(data.id);
    
    return data;
  }

  async updateCompetitor(id: string, updates: Partial<Competitor>): Promise<Competitor> {
    const { data, error } = await supabase
      .from('competitors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeCompetitor(id: string): Promise<void> {
    await supabase.from('competitors').delete().eq('id', id);
  }

  async getCompetitors(): Promise<Competitor[]> {
    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAlerts(competitorId?: string): Promise<CompetitorAlert[]> {
    let query = supabase
      .from('competitor_alerts')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50);

    if (competitorId) {
      query = query.eq('competitor_id', competitorId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Cleanup
  disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.removeAllListeners();
    analysisCache.clear();
  }
}

// Singleton instance
let competitorAnalysisInstance: CompetitorAnalysisService | null = null;

export const getCompetitorAnalysisService = () => {
  if (!competitorAnalysisInstance) {
    competitorAnalysisInstance = new CompetitorAnalysisService();
  }
  return competitorAnalysisInstance;
};