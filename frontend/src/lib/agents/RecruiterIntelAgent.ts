import { Agent } from './base/Agent';
import { Message, AgentType, MessageType } from './base/types';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Action schemas
const RecruiterPerformanceAnalysisSchema = z.object({
  recruiter_id: z.string().uuid().optional(),
  team_id: z.string().optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  compare_to_previous: z.boolean().default(true),
  include_predictions: z.boolean().default(true),
});

const ExecutiveSummarySchema = z.object({
  format: z.enum(['brief', 'detailed', 'presentation']),
  focus_areas: z.array(z.enum(['revenue', 'efficiency', 'quality', 'growth', 'risk'])).optional(),
  time_range: z.number().default(90), // days
});

const StrategicRecommendationSchema = z.object({
  context: z.enum(['performance_improvement', 'team_optimization', 'market_expansion', 'cost_reduction']),
  constraints: z.object({
    budget: z.number().optional(),
    timeline: z.string().optional(),
    resources: z.array(z.string()).optional(),
  }).optional(),
});

const AlertConfigurationSchema = z.object({
  metric: z.string(),
  threshold: z.number(),
  comparison: z.enum(['above', 'below', 'equals', 'change_percent']),
  notification_channels: z.array(z.enum(['email', 'sms', 'dashboard', 'slack'])),
});

export class RecruiterIntelAgent extends Agent {
  private genAI: GoogleGenerativeAI;
  private alertConfigs: Map<string, any> = new Map();
  
  constructor() {
    super({
      name: 'Recruiter Intel Agent',
      type: AgentType.RECRUITER_INTEL,
      description: 'Provides intelligence and analytics for recruiters'
    });
    this.genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY!);
  }

  protected async processMessage(message: Message): Promise<void> {
    // Check if this is a request message
    if (message.type !== MessageType.REQUEST) {
      return;
    }
    
    // Type assertion to access request-specific properties
    const requestMessage = message as any;
    const { action, payload } = requestMessage;

    try {
      switch (action) {
        case 'analyze_performance':
          await this.analyzeRecruiterPerformance(payload);
          break;
          
        case 'generate_executive_summary':
          await this.generateExecutiveSummary(payload);
          break;
          
        case 'predict_performance':
          await this.predictPerformance(payload);
          break;
          
        case 'detect_anomalies':
          await this.detectAnomalies(payload);
          break;
          
        case 'generate_recommendations':
          await this.generateStrategicRecommendations(payload);
          break;
          
        case 'configure_alerts':
          await this.configureAlerts(payload);
          break;
          
        case 'benchmark_analysis':
          await this.performBenchmarkAnalysis(payload);
          break;
          
        case 'natural_language_query':
          await this.processNaturalLanguageQuery(payload);
          break;
          
        default:
          console.warn(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Error processing ${action}:`, error);
      this.emit('error', { action, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async analyzeRecruiterPerformance(payload: any) {
    const params = RecruiterPerformanceAnalysisSchema.parse(payload);
    
    try {
      // Fetch performance data
      const performanceData = await this.fetchPerformanceData(params);
      
      // Generate AI-powered analysis
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
      As an executive analytics expert for a recruiting firm, analyze the following performance data:
      
      ${JSON.stringify(performanceData, null, 2)}
      
      Provide a comprehensive analysis including:
      1. Performance Assessment - Overall rating and key achievements
      2. Trend Analysis - Performance trajectory and patterns
      3. Efficiency Metrics - Time-to-fill, conversion rates, quality scores
      4. Revenue Impact - Contribution to company revenue and profitability
      5. Risk Factors - Any concerning patterns or metrics
      6. Peer Comparison - How this recruiter compares to team/company averages
      7. Growth Opportunities - Specific areas for improvement
      
      Format as a structured JSON response with these sections.
      `;
      
      const result = await model.generateContent(prompt);
      const analysis = this.parseAIResponse(result.response.text());
      
      // Add predictions if requested
      if (params.include_predictions) {
        analysis.predictions = await this.generatePerformancePredictions(performanceData);
      }
      
      this.emit('performance_analyzed', {
        recruiter_id: params.recruiter_id,
        analysis,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error analyzing performance:', error);
      throw error;
    }
  }

  private async generateExecutiveSummary(payload: any) {
    const params = ExecutiveSummarySchema.parse(payload);
    
    try {
      // Gather comprehensive data
      const summaryData = await this.gatherExecutiveSummaryData(params);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      let promptTemplate = '';
      switch (params.format) {
        case 'brief':
          promptTemplate = this.getBriefSummaryPrompt();
          break;
        case 'detailed':
          promptTemplate = this.getDetailedSummaryPrompt();
          break;
        case 'presentation':
          promptTemplate = this.getPresentationSummaryPrompt();
          break;
      }
      
      const prompt = promptTemplate.replace('{{DATA}}', JSON.stringify(summaryData, null, 2));
      
      const result = await model.generateContent(prompt);
      const summary = this.parseAIResponse(result.response.text());
      
      this.emit('executive_summary_generated', {
        format: params.format,
        summary,
        data_points: summaryData.metrics_count,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error generating executive summary:', error);
      throw error;
    }
  }

  private async predictPerformance(payload: any) {
    try {
      const { recruiter_id, prediction_window } = payload;
      
      // Fetch historical data
      const historicalData = await this.fetchHistoricalData(recruiter_id, 365);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
      Based on the following historical recruiting performance data, predict future performance for the next ${prediction_window} days:
      
      ${JSON.stringify(historicalData, null, 2)}
      
      Provide predictions for:
      1. Expected placements
      2. Projected revenue
      3. Pipeline conversion probability
      4. Risk of underperformance
      5. Recommended actions to optimize outcomes
      
      Include confidence intervals and key assumptions.
      `;
      
      const result = await model.generateContent(prompt);
      const predictions = this.parseAIResponse(result.response.text());
      
      this.emit('performance_predicted', {
        recruiter_id,
        prediction_window,
        predictions,
        confidence_level: predictions.confidence || 0.75,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error predicting performance:', error);
      throw error;
    }
  }

  private async detectAnomalies(payload: any) {
    try {
      const { scope = 'company-wide', sensitivity = 'medium' } = payload;
      
      // Fetch recent activity data
      const activityData = await this.fetchRecentActivityData(scope);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
      Analyze the following recruiting activity data for anomalies with ${sensitivity} sensitivity:
      
      ${JSON.stringify(activityData, null, 2)}
      
      Identify:
      1. Unusual patterns in recruiter behavior
      2. Significant deviations from historical norms
      3. Potential risks or opportunities
      4. Suspicious activities that may require attention
      
      For each anomaly, provide:
      - Severity level (low, medium, high, critical)
      - Description
      - Potential impact
      - Recommended action
      `;
      
      const result = await model.generateContent(prompt);
      const anomalies = this.parseAIResponse(result.response.text());
      
      // Trigger alerts for high/critical anomalies
      if (anomalies.items) {
        const criticalAnomalies = anomalies.items.filter(
          (a: any) => a.severity === 'high' || a.severity === 'critical'
        );
        
        for (const anomaly of criticalAnomalies) {
          this.emit('critical_anomaly_detected', anomaly);
        }
      }
      
      this.emit('anomalies_detected', {
        scope,
        sensitivity,
        anomalies,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  private async generateStrategicRecommendations(payload: any) {
    const params = StrategicRecommendationSchema.parse(payload);
    
    try {
      // Gather context-specific data
      const contextData = await this.gatherContextData(params.context);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
      As a strategic advisor to the CEO of a recruiting firm, provide recommendations for ${params.context}:
      
      Current State:
      ${JSON.stringify(contextData, null, 2)}
      
      Constraints:
      ${JSON.stringify(params.constraints || {}, null, 2)}
      
      Provide strategic recommendations including:
      1. Executive Summary - Key insights and opportunities
      2. Strategic Initiatives - Specific actions with expected outcomes
      3. Implementation Roadmap - Phased approach with timelines
      4. Resource Requirements - People, technology, budget needed
      5. Risk Mitigation - Potential challenges and mitigation strategies
      6. Success Metrics - KPIs to track progress
      7. Expected ROI - Financial and operational benefits
      
      Prioritize recommendations by impact and feasibility.
      `;
      
      const result = await model.generateContent(prompt);
      const recommendations = this.parseAIResponse(result.response.text());
      
      this.emit('strategic_recommendations_generated', {
        context: params.context,
        recommendations,
        priority_score: this.calculatePriorityScore(recommendations),
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  private async configureAlerts(payload: any) {
    const config = AlertConfigurationSchema.parse(payload);
    
    try {
      // Store alert configuration
      const alertId = `alert_${Date.now()}`;
      this.alertConfigs.set(alertId, config);
      
      // Set up monitoring
      this.startAlertMonitoring(alertId, config);
      
      this.emit('alert_configured', {
        alert_id: alertId,
        config,
        status: 'active',
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error configuring alert:', error);
      throw error;
    }
  }

  private async performBenchmarkAnalysis(payload: any) {
    try {
      const { entity_id, entity_type, benchmark_against } = payload;
      
      // Fetch entity data and benchmark data
      const entityData = await this.fetchEntityData(entity_id, entity_type);
      const benchmarkData = await this.fetchBenchmarkData(benchmark_against);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
      Perform a comprehensive benchmark analysis:
      
      Entity Data:
      ${JSON.stringify(entityData, null, 2)}
      
      Benchmark Data:
      ${JSON.stringify(benchmarkData, null, 2)}
      
      Provide:
      1. Performance Comparison - Key metrics vs benchmarks
      2. Strengths - Areas where entity outperforms
      3. Gaps - Areas needing improvement
      4. Best Practices - What top performers do differently
      5. Action Plan - Specific steps to close gaps
      6. Expected Timeline - Realistic timeframe for improvements
      
      Include percentile rankings and statistical significance where applicable.
      `;
      
      const result = await model.generateContent(prompt);
      const benchmarkAnalysis = this.parseAIResponse(result.response.text());
      
      this.emit('benchmark_analysis_completed', {
        entity_id,
        entity_type,
        benchmark_against,
        analysis: benchmarkAnalysis,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error performing benchmark analysis:', error);
      throw error;
    }
  }

  private async processNaturalLanguageQuery(payload: any) {
    try {
      const { query, context = {} } = payload;
      
      // Fetch relevant data based on query intent
      const queryData = await this.gatherQueryData(query, context);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
      You are an AI assistant for the CEO of a recruiting firm. Answer the following question using the provided data:
      
      Question: ${query}
      
      Available Data:
      ${JSON.stringify(queryData, null, 2)}
      
      Provide a clear, concise, and actionable answer. Include:
      1. Direct answer to the question
      2. Supporting data and metrics
      3. Relevant insights or trends
      4. Recommended actions if applicable
      
      Format the response for executive consumption.
      `;
      
      const result = await model.generateContent(prompt);
      const response = this.parseAIResponse(result.response.text());
      
      this.emit('query_answered', {
        query,
        response,
        data_sources: Object.keys(queryData),
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error processing natural language query:', error);
      throw error;
    }
  }

  // Helper methods
  private async fetchPerformanceData(params: any): Promise<any> {
    // Fetch from API endpoints
    const response = await fetch(`/api/recruiters/metrics?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error('Failed to fetch performance data');
    return response.json();
  }

  private async fetchHistoricalData(recruiterId: string, days: number): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const response = await fetch(`/api/recruiters/${recruiterId}/history?start=${startDate.toISOString()}&end=${endDate.toISOString()}`);
    if (!response.ok) throw new Error('Failed to fetch historical data');
    return response.json();
  }

  private async fetchRecentActivityData(scope: string): Promise<any> {
    const response = await fetch(`/api/recruiters/activities?scope=${scope}&limit=1000`);
    if (!response.ok) throw new Error('Failed to fetch activity data');
    return response.json();
  }

  private async gatherExecutiveSummaryData(params: any): Promise<any> {
    // Gather data from multiple sources
    const [metrics, recruiters, trends, alerts] = await Promise.all([
      fetch(`/api/recruiters/metrics?period=${params.time_range}`).then(r => r.json()),
      fetch('/api/recruiters').then(r => r.json()),
      fetch(`/api/recruiters/trends?days=${params.time_range}`).then(r => r.json()),
      fetch('/api/recruiters/alerts?active=true').then(r => r.json()),
    ]);
    
    return {
      metrics,
      recruiters: recruiters.data,
      trends,
      alerts,
      focus_areas: params.focus_areas,
      metrics_count: Object.keys(metrics).length,
    };
  }

  private async gatherContextData(context: string): Promise<any> {
    // Gather context-specific data
    switch (context) {
      case 'performance_improvement':
        return this.gatherPerformanceData();
      case 'team_optimization':
        return this.gatherTeamData();
      case 'market_expansion':
        return this.gatherMarketData();
      case 'cost_reduction':
        return this.gatherCostData();
      default:
        return {};
    }
  }

  private async gatherPerformanceData(): Promise<any> {
    const response = await fetch('/api/recruiters/performance-summary');
    return response.json();
  }

  private async gatherTeamData(): Promise<any> {
    const response = await fetch('/api/recruiters/team-analytics');
    return response.json();
  }

  private async gatherMarketData(): Promise<any> {
    const response = await fetch('/api/recruiters/market-analysis');
    return response.json();
  }

  private async gatherCostData(): Promise<any> {
    const response = await fetch('/api/recruiters/cost-analysis');
    return response.json();
  }

  private async fetchEntityData(entityId: string, entityType: string): Promise<any> {
    const response = await fetch(`/api/recruiters/${entityType}/${entityId}`);
    return response.json();
  }

  private async fetchBenchmarkData(benchmarkType: string): Promise<any> {
    const response = await fetch(`/api/recruiters/benchmarks?type=${benchmarkType}`);
    return response.json();
  }

  private async gatherQueryData(query: string, context: any): Promise<any> {
    // Use simple keyword matching to determine what data to fetch
    const keywords = query.toLowerCase();
    const data: any = {};
    
    if (keywords.includes('revenue') || keywords.includes('money') || keywords.includes('earnings')) {
      data.revenue = await fetch('/api/recruiters/metrics?focus=revenue').then(r => r.json());
    }
    
    if (keywords.includes('performance') || keywords.includes('best') || keywords.includes('top')) {
      data.performance = await fetch('/api/recruiters?sort=performance').then(r => r.json());
    }
    
    if (keywords.includes('problem') || keywords.includes('issue') || keywords.includes('risk')) {
      data.risks = await fetch('/api/recruiters/at-risk').then(r => r.json());
    }
    
    return data;
  }

  private async generatePerformancePredictions(data: any): Promise<any> {
    // Simple prediction logic - in production, this would use ML models
    const recentTrend = this.calculateTrend(data);
    const seasonality = this.detectSeasonality(data);
    
    return {
      next_month: {
        placements: Math.round(recentTrend.placements * 1.1),
        revenue: Math.round(recentTrend.revenue * 1.1),
        confidence: 0.75,
      },
      next_quarter: {
        placements: Math.round(recentTrend.placements * 3.2),
        revenue: Math.round(recentTrend.revenue * 3.2),
        confidence: 0.65,
      },
      factors: {
        trend: recentTrend.direction,
        seasonality: seasonality,
      },
    };
  }

  private calculateTrend(data: any): any {
    // Simplified trend calculation
    return {
      direction: 'upward',
      placements: data.avg_placements || 0,
      revenue: data.avg_revenue || 0,
    };
  }

  private detectSeasonality(data: any): string {
    // Simplified seasonality detection
    const currentMonth = new Date().getMonth();
    if ([11, 0, 1].includes(currentMonth)) return 'low_season';
    if ([2, 3, 4, 8, 9, 10].includes(currentMonth)) return 'high_season';
    return 'normal_season';
  }

  private calculatePriorityScore(recommendations: any): number {
    // Calculate priority based on impact and feasibility
    if (!recommendations.initiatives) return 0;
    
    const scores = recommendations.initiatives.map((i: any) => {
      const impact = i.expected_impact || 0.5;
      const feasibility = i.feasibility || 0.5;
      return impact * feasibility;
    });
    
    return scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  }

  private startAlertMonitoring(alertId: string, config: any): void {
    // Set up periodic monitoring
    setInterval(async () => {
      try {
        const currentValue = await this.fetchMetricValue(config.metric);
        const shouldTrigger = this.evaluateAlertCondition(currentValue, config);
        
        if (shouldTrigger) {
          this.triggerAlert(alertId, config, currentValue);
        }
      } catch (error) {
        console.error(`Error monitoring alert ${alertId}:`, error);
      }
    }, 60000); // Check every minute
  }

  private async fetchMetricValue(metric: string): Promise<number> {
    const response = await fetch(`/api/recruiters/metrics/current?metric=${metric}`);
    const data = await response.json();
    return data.value;
  }

  private evaluateAlertCondition(value: number, config: any): boolean {
    switch (config.comparison) {
      case 'above':
        return value > config.threshold;
      case 'below':
        return value < config.threshold;
      case 'equals':
        return value === config.threshold;
      case 'change_percent':
        // Would need historical value for comparison
        return false;
      default:
        return false;
    }
  }

  private triggerAlert(alertId: string, config: any, currentValue: number): void {
    this.emit('alert_triggered', {
      alert_id: alertId,
      metric: config.metric,
      threshold: config.threshold,
      current_value: currentValue,
      timestamp: new Date().toISOString(),
    });
    
    // Send notifications based on configured channels
    config.notification_channels.forEach((channel: string) => {
      this.sendNotification(channel, {
        alert_id: alertId,
        message: `Alert: ${config.metric} is ${config.comparison} ${config.threshold} (current: ${currentValue})`,
      });
    });
  }

  private sendNotification(channel: string, notification: any): void {
    // Emit notification event for other systems to handle
    this.emit('send_notification', {
      channel,
      notification,
    });
  }

  private parseAIResponse(text: string): any {
    try {
      // Extract JSON from AI response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: return structured text
      return {
        content: text,
        parsed: false,
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        content: text,
        parsed: false,
        error: 'Failed to parse response',
      };
    }
  }

  private getBriefSummaryPrompt(): string {
    return `
    Generate a brief executive summary (max 1 page) from the following data:
    
    {{DATA}}
    
    Include only the most critical insights:
    1. Overall Performance - Single paragraph assessment
    2. Key Metrics - Top 3-5 numbers the CEO needs to know
    3. Critical Issues - Any urgent matters requiring attention
    4. Opportunities - Top 2-3 growth opportunities
    5. Recommended Actions - 3-5 immediate next steps
    
    Keep it concise and action-oriented.
    `;
  }

  private getDetailedSummaryPrompt(): string {
    return `
    Generate a comprehensive executive report from the following data:
    
    {{DATA}}
    
    Structure the report as follows:
    1. Executive Overview - High-level state of the business
    2. Performance Analysis - Detailed metrics and trends
    3. Team Performance - Individual and team assessments
    4. Market Position - Competitive analysis and opportunities
    5. Financial Impact - Revenue analysis and projections
    6. Risk Assessment - Current and emerging risks
    7. Strategic Recommendations - Detailed action plan
    8. Appendix - Supporting data and calculations
    
    Be thorough but maintain executive-level clarity.
    `;
  }

  private getPresentationSummaryPrompt(): string {
    return `
    Create a board presentation structure from the following data:
    
    {{DATA}}
    
    Design slides for:
    1. Title Slide - Recruiting Performance Review
    2. Executive Summary - 3 key takeaways
    3. Performance Dashboard - Visual KPIs
    4. Revenue Analysis - Trends and projections
    5. Team Performance - Rankings and highlights
    6. Market Opportunities - Growth potential
    7. Strategic Initiatives - Proposed actions
    8. Financial Projections - Expected outcomes
    9. Next Steps - Clear action items with owners
    
    Format as presentation-ready content with bullet points.
    `;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    // Set up periodic anomaly detection
    setInterval(() => {
      this.detectAnomalies({ scope: 'company-wide', sensitivity: 'medium' });
    }, 3600000); // Every hour
    
    // Set up daily executive summary generation
    const scheduleDaily = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(6, 0, 0, 0); // 6 AM daily
      
      const timeout = tomorrow.getTime() - now.getTime();
      setTimeout(() => {
        this.generateExecutiveSummary({
          format: 'brief',
          focus_areas: ['revenue', 'efficiency', 'risk'],
          time_range: 1,
        });
        scheduleDaily(); // Schedule next day
      }, timeout);
    };
    
    scheduleDaily();
    
    console.log('RecruiterIntelAgent initialized with automated monitoring');
  }

  protected async processRequest(message: any): Promise<any> {
    const action = this.actions.get(message.action);
    if (!action) {
      throw new Error(`Unknown action: ${message.action}`);
    }

    const input = action.inputSchema.parse(message.payload);
    const handler = (action as any).handler;
    const result = await handler(input, { from: message.from, correlationId: message.id });
    
    return result;
  }

  protected async onInitialize(): Promise<void> {
    console.log('RecruiterIntelAgent initialized');
  }

  protected async onShutdown(): Promise<void> {
    console.log('RecruiterIntelAgent shutting down');
  }
}