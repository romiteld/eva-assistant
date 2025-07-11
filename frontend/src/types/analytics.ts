export interface MetricData {
  label: string;
  value: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  unit?: string;
  icon?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

export interface TimeSeriesData {
  timestamp: string;
  [key: string]: any;
}

export interface LeadGenerationMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  averageScore: number;
  leadsBySource: ChartDataPoint[];
  leadsByStatus: ChartDataPoint[];
  weeklyTrend: TimeSeriesData[];
}

export interface CampaignMetrics {
  activeCampaigns: number;
  totalReached: number;
  responseRate: number;
  clickRate: number;
  campaignPerformance: {
    id: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
    responded: number;
  }[];
  dailyActivity: TimeSeriesData[];
}

export interface AgentUsageMetrics {
  totalAgents: number;
  activeAgents: number;
  tasksCompleted: number;
  averageResponseTime: number;
  agentPerformance: {
    agentType: string;
    tasksCompleted: number;
    successRate: number;
    averageTime: number;
  }[];
  hourlyUsage: TimeSeriesData[];
}

export interface UserActivityMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  topFeatures: {
    feature: string;
    usage: number;
    percentage: number;
  }[];
  userGrowth: TimeSeriesData[];
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'custom';
}