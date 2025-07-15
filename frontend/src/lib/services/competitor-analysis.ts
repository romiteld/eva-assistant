import { EventEmitter } from 'events';
import { competitorAnalysisAdapter } from './competitor-analysis-adapter';
import { 
  Competitor, 
  CompetitorAlert,
  MarketTrend,
  CompetitorDiscovery,
} from '@/types/competitor-analysis';

export class CompetitorAnalysisService extends EventEmitter {
  private adapter = competitorAnalysisAdapter;
  private activeAnalyses = new Map<string, any>();
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Set up periodic analysis
    this.startPeriodicAnalysis();
  }

  private startPeriodicAnalysis() {
    // Run analysis every hour
    this.updateInterval = setInterval(() => {
      this.runScheduledAnalyses();
    }, 60 * 60 * 1000);
  }

  private async runScheduledAnalyses() {
    // Simplified scheduled analysis
    try {
      const competitors = await this.adapter.getCompetitors();
      for (const competitor of competitors) {
        // Only analyze if last analyzed more than 24 hours ago
        if (competitor.lastAnalyzed) {
          const lastAnalyzed = new Date(competitor.lastAnalyzed);
          const hoursSinceAnalysis = (Date.now() - lastAnalyzed.getTime()) / (1000 * 60 * 60);
          if (hoursSinceAnalysis > 24) {
            await this.analyzeCompetitor(competitor.id);
          }
        }
      }
    } catch (error) {
      console.error('Error in scheduled analysis:', error);
    }
  }

  // Public API methods
  async getCompetitors(): Promise<Competitor[]> {
    try {
      return await this.adapter.getCompetitors();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async addCompetitor(competitor: Partial<Competitor>): Promise<Competitor> {
    try {
      const newCompetitor = await this.adapter.addCompetitor(competitor);
      this.emit('competitor:added', newCompetitor);
      return newCompetitor;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async removeCompetitor(competitorId: string): Promise<void> {
    try {
      await this.adapter.removeCompetitor(competitorId);
      this.emit('competitor:removed', { id: competitorId });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAlerts(): Promise<CompetitorAlert[]> {
    try {
      return await this.adapter.getAlerts();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getMarketTrends(industry: string): Promise<MarketTrend[]> {
    try {
      return await this.adapter.getMarketTrends(industry);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Analysis methods
  async analyzeCompetitor(competitorId: string): Promise<void> {
    this.emit('analysis:started', { competitorId });
    
    try {
      // Mark as active analysis
      this.activeAnalyses.set(competitorId, { startTime: Date.now() });
      
      // Perform analysis
      await this.adapter.analyzeCompetitor(competitorId);
      
      // Clean up
      this.activeAnalyses.delete(competitorId);
      this.emit('analysis:completed', { competitorId });
    } catch (error) {
      this.activeAnalyses.delete(competitorId);
      this.emit('analysis:error', { competitorId, error });
      throw error;
    }
  }

  async discoverCompetitors(
    industry: string, 
    keywords: string[], 
    currentDomain?: string
  ): Promise<CompetitorDiscovery> {
    this.emit('discovery:started');
    
    try {
      const discovery = await this.adapter.discoverCompetitors(industry, keywords, currentDomain);
      this.emit('discovery:completed', discovery);
      return discovery;
    } catch (error) {
      this.emit('discovery:error', error);
      throw error;
    }
  }

  // Cleanup
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
let serviceInstance: CompetitorAnalysisService | null = null;

export function getCompetitorAnalysisService(): CompetitorAnalysisService {
  if (!serviceInstance) {
    serviceInstance = new CompetitorAnalysisService();
  }
  return serviceInstance;
}

export function destroyCompetitorAnalysisService() {
  if (serviceInstance) {
    serviceInstance.destroy();
    serviceInstance = null;
  }
}