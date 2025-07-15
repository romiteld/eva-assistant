import { supabase } from '@/lib/supabase/browser';
import { 
  Competitor, 
  CompetitorAlert,
  MarketTrend,
  CompetitorDiscovery
} from '@/types/competitor-analysis';

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

  // Update competitor analysis
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

    // Update with new analysis timestamp
    const { error } = await supabase
      .from('competitor_analyses')
      .update({
        last_analyzed_at: new Date().toISOString(),
        findings: {
          ...existing.findings,
          lastAnalysis: {
            timestamp: new Date().toISOString(),
            status: 'completed'
          }
        }
      })
      .eq('id', competitorId);

    if (error) throw error;
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

  // Discover competitors (simplified version)
  async discoverCompetitors(
    industry: string,
    keywords: string[],
    currentDomain?: string
  ): Promise<CompetitorDiscovery> {
    // Mock discovery results
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

  // Get market trends (mock data)
  async getMarketTrends(industry: string): Promise<MarketTrend[]> {
    return [
      {
        id: '1',
        trend: 'AI-Powered Recruitment Tools',
        category: 'Technology',
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
        category: 'Market',
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