import { AgentInitializer } from '../AgentInitializer';
import { MessageBus } from '../base/MessageBus';
import { MessageType } from '../base/types';

/**
 * Example implementation of RecruiterIntelAgent usage
 * 
 * This demonstrates how the CEO of a recruiting firm can leverage
 * the RecruiterIntelAgent for executive-level insights and decisions.
 */

export class RecruiterIntelExample {
  private initializer: AgentInitializer;
  private messageBus: MessageBus;

  constructor() {
    this.initializer = AgentInitializer.getInstance();
    this.messageBus = MessageBus.getInstance();
  }

  async initialize() {
    await this.initializer.initialize();
  }

  /**
   * Example 1: Generate Daily Executive Summary
   */
  async generateDailyExecutiveSummary() {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const summary = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'generate_executive_summary',
      {
        period: 'daily',
        focusAreas: ['revenue', 'productivity', 'risks'],
        format: 'brief',
      }
    );

    console.log('Daily Executive Summary:', summary);
    return summary;
  }

  /**
   * Example 2: Analyze Top Performer Performance
   */
  async analyzeTopPerformers() {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const topPerformers = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'identify_top_performers',
      {
        metric: 'revenue',
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        limit: 5,
        includeReasons: true,
      }
    );

    console.log('Top Performers:', topPerformers);
    return topPerformers;
  }

  /**
   * Example 3: Predict Quarterly Performance
   */
  async predictQuarterlyPerformance() {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const predictions = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'predict_performance',
      {
        teamId: 'sales-team-1',
        timeframe: 'quarter',
        confidence: 'moderate',
      }
    );

    console.log('Quarterly Predictions:', predictions);
    return predictions;
  }

  /**
   * Example 4: Natural Language Query
   */
  async askNaturalLanguageQuestion(question: string) {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const answer = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'natural_language_query',
      {
        query: question,
        outputFormat: 'text',
      }
    );

    console.log('Answer:', answer);
    return answer;
  }

  /**
   * Example 5: Setup Performance Alert
   */
  async setupPerformanceAlert() {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const alert = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'create_alert',
      {
        name: 'Revenue Drop Alert',
        condition: {
          metric: 'daily_revenue',
          operator: '<',
          value: 50000,
          aggregation: 'sum',
        },
        frequency: 'daily',
        recipients: ['ceo@recruitingfirm.com'],
        actions: ['email', 'dashboard'],
      }
    );

    console.log('Alert Created:', alert);
    return alert;
  }

  /**
   * Example 6: Detect Anomalies
   */
  async detectPerformanceAnomalies() {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const anomalies = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'detect_anomalies',
      {
        scope: 'company',
        sensitivity: 'medium',
        timeWindow: 30,
      }
    );

    console.log('Anomalies Detected:', anomalies);
    return anomalies;
  }

  /**
   * Example 7: Get Strategic Recommendations
   */
  async getStrategicRecommendations() {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const recommendations = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'recommend_actions',
      {
        context: 'growth_optimization',
        maxRecommendations: 5,
      }
    );

    console.log('Strategic Recommendations:', recommendations);
    return recommendations;
  }

  /**
   * Example 8: Benchmark Team Performance
   */
  async benchmarkTeamPerformance(teamId: string) {
    const recruiterIntelAgent = this.initializer.getAgent('recruiter_intel-agent');
    
    const benchmarks = await recruiterIntelAgent.sendRequest(
      recruiterIntelAgent.getId(),
      'benchmark_analysis',
      {
        entity: 'team',
        entityId: teamId,
        benchmarkAgainst: 'company',
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      }
    );

    console.log('Benchmark Analysis:', benchmarks);
    return benchmarks;
  }

  /**
   * Example 9: Complex Workflow - Monthly Performance Review
   */
  async monthlyPerformanceReview() {
    const workflowAgent = this.initializer.getAgent('workflow-agent');
    
    const workflow = {
      workflowName: 'Monthly Performance Review',
      steps: [
        {
          agent: 'recruiter_intel',
          action: 'analyze_recruiter_performance',
          input: {
            dateRange: {
              start: '2024-01-01',
              end: '2024-01-31',
            },
          },
        },
        {
          agent: 'recruiter_intel',
          action: 'identify_top_performers',
          input: {
            metric: 'overall',
            period: {
              start: '2024-01-01',
              end: '2024-01-31',
            },
            limit: 10,
          },
        },
        {
          agent: 'recruiter_intel',
          action: 'detect_anomalies',
          input: {
            scope: 'company',
            sensitivity: 'high',
          },
        },
        {
          agent: 'recruiter_intel',
          action: 'recommend_actions',
          input: {
            context: 'performance_improvement',
          },
        },
        {
          agent: 'recruiter_intel',
          action: 'generate_executive_summary',
          input: {
            period: 'monthly',
            focusAreas: ['revenue', 'productivity', 'quality', 'trends'],
            format: 'detailed',
          },
        },
      ],
      context: {
        reviewMonth: 'January 2024',
        reviewType: 'monthly',
      },
    };

    const result = await workflowAgent.sendRequest(
      workflowAgent.getId(),
      'orchestrate',
      workflow
    );

    console.log('Monthly Review Complete:', result);
    return result;
  }

  /**
   * Example 10: Real-time Dashboard Updates
   */
  async subscribeToRealTimeUpdates() {
    // Subscribe to performance events
    this.messageBus.subscribe('dashboard', async (message) => {
      if (message.type === MessageType.EVENT) {
        const eventMessage = message as any; // Type assertion for event message
        switch (eventMessage.event) {
          case 'performance_analyzed':
            console.log('Performance Updated:', eventMessage.data);
            break;
          case 'anomalies_detected':
            console.log('New Anomalies:', eventMessage.data);
            break;
          case 'alert_triggered':
            console.log('Alert Triggered:', eventMessage.data);
            break;
          case 'top_performers_identified':
            console.log('Top Performers Updated:', eventMessage.data);
            break;
        }
      }
    });
  }
}

// Usage example
async function main() {
  const example = new RecruiterIntelExample();
  
  try {
    await example.initialize();
    
    // Generate daily summary
    await example.generateDailyExecutiveSummary();
    
    // Ask a natural language question
    await example.askNaturalLanguageQuestion(
      "Which recruiters had the highest placement rate last month and what made them successful?"
    );
    
    // Setup alerts
    await example.setupPerformanceAlert();
    
    // Subscribe to real-time updates
    await example.subscribeToRealTimeUpdates();
    
    // Run monthly review workflow
    await example.monthlyPerformanceReview();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
if (require.main === module) {
  main();
}