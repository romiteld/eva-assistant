import { getFirecrawlService } from './firecrawl-service';
import { supabase } from '@/lib/supabase/browser';

interface ResearchQuery {
  type: 'company' | 'executive' | 'competitor' | 'news' | 'relationship';
  query: string;
  targetCompany?: string;
  targetPerson?: string;
  options?: {
    depth?: number;
    maxResults?: number;
    timeframe?: string; // e.g., "30d", "1y"
    entityType?: 'person' | 'company';
  };
}

interface ResearchResult {
  id: string;
  query: ResearchQuery;
  findings: {
    summary: string;
    keyPoints: string[];
    sources: Array<{
      url: string;
      title: string;
      relevance: number;
      extractedData: any;
    }>;
    entities: {
      companies: string[];
      people: string[];
      locations: string[];
      dates: string[];
    };
    insights: string[];
  };
  metadata: {
    startTime: string;
    endTime: string;
    totalSources: number;
    confidence: number;
  };
}

export class ResearchSystem {
  private firecrawl = getFirecrawlService();

  // Company Intelligence Research
  async companyIntelligence(companyName: string, options?: any): Promise<ResearchResult> {
    const query: ResearchQuery = {
      type: 'company',
      query: companyName,
      targetCompany: companyName,
      options
    };

    const startTime = new Date().toISOString();
    
    try {
      // 1. Search for company information
      const searchResults = await this.firecrawl.search(`${companyName} company profile revenue employees`, {
        limit: 10
      });

      // 2. Extract company website if found
      const companyUrls = searchResults.results
        ?.filter((r: any) => r.url.includes(companyName.toLowerCase().replace(/\s+/g, '')))
        ?.map((r: any) => r.url) || [];

      // 3. Scrape company pages for detailed info
      const scrapedData = [];
      for (const url of companyUrls.slice(0, 3)) {
        try {
          const data = await this.firecrawl.scrapeUrl(url);
          scrapedData.push(data);
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error);
        }
      }

      // 4. Extract structured data
      const extractionSchema = {
        companyName: 'string',
        industry: 'string',
        headquarters: 'string',
        founded: 'string',
        employees: 'string',
        revenue: 'string',
        description: 'string',
        keyPeople: 'array',
        products: 'array',
        recentNews: 'array'
      };

      const extractedInfo = companyUrls.length > 0 
        ? await this.firecrawl.extract(companyUrls.slice(0, 3), { schema: extractionSchema })
        : null;

      // 5. Analyze and compile findings
      const findings = this.analyzeCompanyData(searchResults, scrapedData, extractedInfo);

      const result: ResearchResult = {
        id: `research_${Date.now()}`,
        query,
        findings,
        metadata: {
          startTime,
          endTime: new Date().toISOString(),
          totalSources: searchResults.results?.length || 0,
          confidence: this.calculateConfidence(findings)
        }
      };

      // Store in database
      await this.storeResearchResult(result);

      return result;
    } catch (error) {
      console.error('Company intelligence research failed:', error);
      throw error;
    }
  }

  // Executive Profile Research
  async executiveProfiles(executiveName: string, companyName?: string): Promise<ResearchResult> {
    const query: ResearchQuery = {
      type: 'executive',
      query: executiveName,
      targetPerson: executiveName,
      targetCompany: companyName
    };

    const startTime = new Date().toISOString();

    try {
      // Search for executive information
      const searchQuery = companyName 
        ? `"${executiveName}" "${companyName}" executive profile biography`
        : `"${executiveName}" executive profile biography`;

      const searchResults = await this.firecrawl.search(searchQuery, { limit: 15 });

      // Extract LinkedIn profiles and news articles
      const linkedinUrls = searchResults.results
        ?.filter((r: any) => r.url.includes('linkedin.com'))
        ?.map((r: any) => r.url) || [];

      const newsUrls = searchResults.results
        ?.filter((r: any) => !r.url.includes('linkedin.com'))
        ?.map((r: any) => r.url) || [];

      // Scrape profile data
      const profileData = [];
      for (const url of [...linkedinUrls, ...newsUrls].slice(0, 5)) {
        try {
          const data = await this.firecrawl.scrapeUrl(url);
          profileData.push(data);
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error);
        }
      }

      // Extract structured executive data
      const executiveSchema = {
        name: 'string',
        currentPosition: 'string',
        company: 'string',
        previousPositions: 'array',
        education: 'array',
        skills: 'array',
        achievements: 'array',
        contactInfo: 'object'
      };

      const extractedProfile = await this.firecrawl.extract(
        [...linkedinUrls, ...newsUrls].slice(0, 3),
        { schema: executiveSchema }
      );

      const findings = this.analyzeExecutiveData(searchResults, profileData, extractedProfile);

      const result: ResearchResult = {
        id: `research_${Date.now()}`,
        query,
        findings,
        metadata: {
          startTime,
          endTime: new Date().toISOString(),
          totalSources: searchResults.results?.length || 0,
          confidence: this.calculateConfidence(findings)
        }
      };

      await this.storeResearchResult(result);
      return result;
    } catch (error) {
      console.error('Executive profile research failed:', error);
      throw error;
    }
  }

  // Competitor Analysis
  async competitorAnalysis(companyName: string, competitors?: string[]): Promise<ResearchResult> {
    const query: ResearchQuery = {
      type: 'competitor',
      query: `${companyName} competitors`,
      targetCompany: companyName
    };

    const startTime = new Date().toISOString();

    try {
      // If competitors not provided, find them
      if (!competitors || competitors.length === 0) {
        const competitorSearch = await this.firecrawl.search(
          `${companyName} competitors alternatives "similar to"`,
          { limit: 10 }
        );
        
        competitors = this.extractCompetitorNames(competitorSearch);
      }

      // Research each competitor
      const competitorData = [];
      for (const competitor of competitors.slice(0, 5)) {
        const data = await this.companyIntelligence(competitor, { depth: 1 });
        competitorData.push(data);
      }

      // Comparative analysis
      const findings = this.analyzeCompetitorData(companyName, competitorData);

      const result: ResearchResult = {
        id: `research_${Date.now()}`,
        query,
        findings,
        metadata: {
          startTime,
          endTime: new Date().toISOString(),
          totalSources: competitorData.length,
          confidence: this.calculateConfidence(findings)
        }
      };

      await this.storeResearchResult(result);
      return result;
    } catch (error) {
      console.error('Competitor analysis failed:', error);
      throw error;
    }
  }

  // News Monitoring
  async newsMonitoring(topics: string[], timeframe = '30d'): Promise<ResearchResult> {
    const query: ResearchQuery = {
      type: 'news',
      query: topics.join(' OR '),
      options: { timeframe }
    };

    const startTime = new Date().toISOString();

    try {
      // Search for recent news
      const newsResults = await this.firecrawl.search(
        `${topics.join(' OR ')} news latest ${this.getTimeframeQuery(timeframe)}`,
        { limit: 20 }
      );

      // Scrape news articles
      const articles = [];
      for (const result of newsResults.results?.slice(0, 10) || []) {
        try {
          const article = await this.firecrawl.scrapeUrl(result.url);
          articles.push(article);
        } catch (error) {
          console.error(`Failed to scrape ${result.url}:`, error);
        }
      }

      // Extract news data
      const newsSchema = {
        headline: 'string',
        date: 'string',
        source: 'string',
        summary: 'string',
        keyTopics: 'array',
        sentiment: 'string',
        companies: 'array',
        people: 'array'
      };

      const extractedNews = await this.firecrawl.extract(
        newsResults.results?.slice(0, 10).map((r: any) => r.url) || [],
        { schema: newsSchema }
      );

      const findings = this.analyzeNewsData(articles, extractedNews);

      const result: ResearchResult = {
        id: `research_${Date.now()}`,
        query,
        findings,
        metadata: {
          startTime,
          endTime: new Date().toISOString(),
          totalSources: newsResults.results?.length || 0,
          confidence: this.calculateConfidence(findings)
        }
      };

      await this.storeResearchResult(result);
      return result;
    } catch (error) {
      console.error('News monitoring failed:', error);
      throw error;
    }
  }

  // Relationship Mapping
  async relationshipMapping(
    targetEntity: string,
    entityType: 'person' | 'company'
  ): Promise<ResearchResult> {
    const query: ResearchQuery = {
      type: 'relationship',
      query: targetEntity,
      options: { entityType }
    };

    const startTime = new Date().toISOString();

    try {
      // Search for connections
      const searchQuery = entityType === 'person'
        ? `"${targetEntity}" connections colleagues "worked with" "partnered with"`
        : `"${targetEntity}" partnerships clients customers "works with" subsidiaries`;

      const searchResults = await this.firecrawl.search(searchQuery, { limit: 20 });

      // Map the website to find all pages
      const mainUrl = this.findMainWebsite(searchResults);
      const siteMap = mainUrl ? await this.firecrawl.mapWebsite(mainUrl) : [];

      // Extract relationship data
      const relationshipSchema = {
        entity: 'string',
        relatedEntities: 'array',
        relationshipTypes: 'array',
        dates: 'array',
        descriptions: 'array'
      };

      const urls = searchResults.results?.slice(0, 10).map((r: any) => r.url) || [];
      const relationships = await this.firecrawl.extract(urls, { schema: relationshipSchema });

      const findings = this.analyzeRelationshipData(targetEntity, relationships, siteMap);

      const result: ResearchResult = {
        id: `research_${Date.now()}`,
        query,
        findings,
        metadata: {
          startTime,
          endTime: new Date().toISOString(),
          totalSources: searchResults.results?.length || 0,
          confidence: this.calculateConfidence(findings)
        }
      };

      await this.storeResearchResult(result);
      return result;
    } catch (error) {
      console.error('Relationship mapping failed:', error);
      throw error;
    }
  }

  // Helper methods
  private analyzeCompanyData(searchResults: any, scrapedData: any[], extractedInfo: any): ResearchResult['findings'] {
    // Implement company data analysis logic
    return {
      summary: 'Company analysis completed',
      keyPoints: [],
      sources: [],
      entities: {
        companies: [],
        people: [],
        locations: [],
        dates: []
      },
      insights: []
    };
  }

  private analyzeExecutiveData(searchResults: any, profileData: any[], extractedProfile: any): ResearchResult['findings'] {
    // Implement executive data analysis logic
    return {
      summary: 'Executive profile analysis completed',
      keyPoints: [],
      sources: [],
      entities: {
        companies: [],
        people: [],
        locations: [],
        dates: []
      },
      insights: []
    };
  }

  private analyzeCompetitorData(companyName: string, competitorData: any[]): ResearchResult['findings'] {
    // Implement competitor analysis logic
    return {
      summary: 'Competitor analysis completed',
      keyPoints: [],
      sources: [],
      entities: {
        companies: [],
        people: [],
        locations: [],
        dates: []
      },
      insights: []
    };
  }

  private analyzeNewsData(articles: any[], extractedNews: any): ResearchResult['findings'] {
    // Implement news analysis logic
    return {
      summary: 'News monitoring completed',
      keyPoints: [],
      sources: [],
      entities: {
        companies: [],
        people: [],
        locations: [],
        dates: []
      },
      insights: []
    };
  }

  private analyzeRelationshipData(targetEntity: string, relationships: any, siteMap: string[]): ResearchResult['findings'] {
    // Implement relationship analysis logic
    return {
      summary: 'Relationship mapping completed',
      keyPoints: [],
      sources: [],
      entities: {
        companies: [],
        people: [],
        locations: [],
        dates: []
      },
      insights: []
    };
  }

  private extractCompetitorNames(searchResults: any): string[] {
    // Extract competitor names from search results
    return [];
  }

  private findMainWebsite(searchResults: any): string | null {
    // Find the main website from search results
    return null;
  }

  private getTimeframeQuery(timeframe: string): string {
    const match = timeframe.match(/(\d+)([dmy])/);
    if (!match) return '';
    
    const [, num, unit] = match;
    const unitMap: Record<string, string> = {
      'd': 'days',
      'm': 'months',
      'y': 'years'
    };
    
    return `past ${num} ${unitMap[unit] || 'days'}`;
  }

  private calculateConfidence(findings: ResearchResult['findings']): number {
    // Calculate confidence based on sources and data quality
    const sourceCount = findings.sources.length;
    const hasKeyPoints = findings.keyPoints.length > 0;
    const hasEntities = Object.values(findings.entities).some(arr => arr.length > 0);
    
    let confidence = 0.5;
    if (sourceCount > 5) confidence += 0.2;
    if (hasKeyPoints) confidence += 0.2;
    if (hasEntities) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private async storeResearchResult(result: ResearchResult) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await supabase
      .from('research_results')
      .insert({
        user_id: user.id,
        research_id: result.id,
        query_type: result.query.type,
        query_text: result.query.query,
        findings: result.findings,
        metadata: result.metadata,
        created_at: new Date().toISOString()
      });
  }
}

// Export singleton instance
let researchInstance: ResearchSystem | null = null;

export const getResearchSystem = () => {
  if (!researchInstance) {
    researchInstance = new ResearchSystem();
  }
  return researchInstance;
};