import { CompetitorAnalysisService } from '@/lib/services/competitor-analysis';
import { competitorAnalysisAdapter } from '@/lib/services/competitor-analysis-adapter';

// Mock the dependencies
jest.mock('@/lib/services/competitor-analysis-adapter');
jest.mock('@/lib/services/firecrawl');
jest.mock('@/lib/supabase/browser');

describe('CompetitorAnalysisService', () => {
  let service: CompetitorAnalysisService;

  beforeEach(() => {
    service = new CompetitorAnalysisService();
  });

  it('should initialize service correctly', () => {
    expect(service).toBeDefined();
  });

  it('should get competitors from adapter', async () => {
    const mockCompetitors = [
      {
        id: '1',
        name: 'Test Competitor',
        domain: 'test.com',
        industry: 'Technology',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];

    (competitorAnalysisAdapter.getCompetitors as jest.Mock).mockResolvedValue(mockCompetitors);

    const result = await service.getCompetitors();
    expect(result).toEqual(mockCompetitors);
    expect(competitorAnalysisAdapter.getCompetitors).toHaveBeenCalled();
  });

  it('should add competitor through adapter', async () => {
    const newCompetitor = {
      name: 'New Competitor',
      domain: 'new.com',
      industry: 'Technology'
    };

    const mockAddedCompetitor = {
      id: '2',
      ...newCompetitor,
      status: 'active',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01'
    };

    (competitorAnalysisAdapter.addCompetitor as jest.Mock).mockResolvedValue(mockAddedCompetitor);

    const result = await service.addCompetitor(newCompetitor);
    expect(result).toEqual(mockAddedCompetitor);
    expect(competitorAnalysisAdapter.addCompetitor).toHaveBeenCalledWith(newCompetitor);
  });

  it('should discover competitors with search functionality', async () => {
    const mockDiscovery = {
      suggestedCompetitors: [
        {
          name: 'Discovered Competitor',
          domain: 'discovered.com',
          reason: 'Similar business model',
          similarityScore: 85,
          sharedKeywords: ['technology', 'software'],
          overlappingMarkets: ['Technology']
        }
      ]
    };

    (competitorAnalysisAdapter.discoverCompetitors as jest.Mock).mockResolvedValue(mockDiscovery);

    const result = await service.discoverCompetitors('Technology', ['software', 'AI']);
    expect(result).toEqual(mockDiscovery);
    expect(competitorAnalysisAdapter.discoverCompetitors).toHaveBeenCalledWith(
      'Technology',
      ['software', 'AI'],
      undefined
    );
  });

  it('should analyze competitor with proper events', async () => {
    const competitorId = '1';
    let analysisStarted = false;
    let analysisCompleted = false;

    service.on('analysis:started', () => {
      analysisStarted = true;
    });

    service.on('analysis:completed', () => {
      analysisCompleted = true;
    });

    (competitorAnalysisAdapter.analyzeCompetitor as jest.Mock).mockResolvedValue();

    await service.analyzeCompetitor(competitorId);

    expect(analysisStarted).toBe(true);
    expect(analysisCompleted).toBe(true);
    expect(competitorAnalysisAdapter.analyzeCompetitor).toHaveBeenCalledWith(competitorId);
  });

  it('should handle analysis errors properly', async () => {
    const competitorId = '1';
    const mockError = new Error('Analysis failed');
    let errorCaught = false;

    service.on('analysis:error', () => {
      errorCaught = true;
    });

    (competitorAnalysisAdapter.analyzeCompetitor as jest.Mock).mockRejectedValue(mockError);

    await expect(service.analyzeCompetitor(competitorId)).rejects.toThrow('Analysis failed');
    expect(errorCaught).toBe(true);
  });

  it('should get alerts from adapter', async () => {
    const mockAlerts = [
      {
        id: '1',
        competitorId: '1',
        type: 'product_launch',
        severity: 'high',
        title: 'New Product Launch',
        description: 'Competitor launched a new product',
        detectedAt: '2023-01-01',
        source: 'Website',
        actionRequired: true
      }
    ];

    (competitorAnalysisAdapter.getAlerts as jest.Mock).mockResolvedValue(mockAlerts);

    const result = await service.getAlerts();
    expect(result).toEqual(mockAlerts);
    expect(competitorAnalysisAdapter.getAlerts).toHaveBeenCalled();
  });

  it('should get market trends from adapter', async () => {
    const mockTrends = [
      {
        id: '1',
        trend: 'AI Adoption',
        category: 'Technology',
        impact: 'positive',
        relevance: 90,
        recommendations: ['Invest in AI capabilities']
      }
    ];

    (competitorAnalysisAdapter.getMarketTrends as jest.Mock).mockResolvedValue(mockTrends);

    const result = await service.getMarketTrends('Technology');
    expect(result).toEqual(mockTrends);
    expect(competitorAnalysisAdapter.getMarketTrends).toHaveBeenCalledWith('Technology');
  });

  it('should compare competitors and generate comparison matrix', async () => {
    const competitorIds = ['1', '2'];
    const mockCompetitors = [
      {
        id: '1',
        name: 'Competitor A',
        domain: 'a.com',
        industry: 'Technology',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      },
      {
        id: '2',
        name: 'Competitor B',
        domain: 'b.com',
        industry: 'Technology',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];

    (competitorAnalysisAdapter.getCompetitors as jest.Mock).mockResolvedValue(mockCompetitors);

    const result = await service.compareCompetitors(competitorIds);

    expect(result).toHaveProperty('competitors');
    expect(result).toHaveProperty('features');
    expect(result).toHaveProperty('matrix');
    expect(result.competitors).toHaveLength(2);
    expect(result.features).toContain('pricing');
    expect(result.features).toContain('features');
    expect(result.matrix).toHaveProperty('1');
    expect(result.matrix).toHaveProperty('2');
  });

  it('should cleanup resources on destroy', () => {
    const spy = jest.spyOn(service, 'removeAllListeners');
    service.destroy();
    expect(spy).toHaveBeenCalled();
  });
});