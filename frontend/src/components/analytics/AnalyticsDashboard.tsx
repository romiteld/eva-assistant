import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, Users, Mail, Briefcase, 
  CheckCircle, Clock, Zap, BarChart3,
  RefreshCw, Download, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetricsCard from './MetricsCard';
import ChartCard from './ChartCard';
import DateRangePicker from './DateRangePicker';
import { useSupabase } from '@/app/providers';
import { 
  DateRange, 
  LeadGenerationMetrics, 
  CampaignMetrics,
  AgentUsageMetrics,
  UserActivityMetrics,
  MetricData
} from '@/types/analytics';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { AnalyticsService } from '@/lib/services/analytics';

export default function AnalyticsDashboard() {
  const supabase = useSupabase();
  const analyticsService = new AnalyticsService(supabase);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: startOfDay(subDays(new Date(), 7)),
    endDate: endOfDay(new Date()),
    preset: 'last7days',
  });

  // Metrics states
  const [overviewMetrics, setOverviewMetrics] = useState<MetricData[]>([]);
  const [leadMetrics, setLeadMetrics] = useState<LeadGenerationMetrics | null>(null);
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentUsageMetrics | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserActivityMetrics | null>(null);

  // Fetch data functions
  const fetchOverviewMetrics = async () => {
    try {
      const metrics = await analyticsService.getOverviewMetrics(dateRange.startDate, dateRange.endDate);
      setOverviewMetrics(metrics);
    } catch (error) {
      console.error('Error fetching overview metrics:', error);
      // Fallback to mock data if service fails
      const mockMetrics: MetricData[] = [
        {
          label: 'Total Leads Generated',
          value: 1247,
          change: 12.5,
          changeType: 'increase',
          icon: 'users',
        },
        {
          label: 'Active Campaigns',
          value: 18,
          change: -5.2,
          changeType: 'decrease',
          icon: 'mail',
        },
        {
          label: 'Tasks Completed',
          value: 3842,
          change: 23.1,
          changeType: 'increase',
          icon: 'checkCircle',
        },
        {
          label: 'Avg Response Time',
          value: 2.4,
          change: -15.3,
          changeType: 'decrease',
          unit: 'time',
          icon: 'clock',
        },
      ];
      setOverviewMetrics(mockMetrics);
    }
  };

  const fetchLeadMetrics = async () => {
    try {
      const data = await analyticsService.getLeadGenerationMetrics(dateRange.startDate, dateRange.endDate);
      if (data) {
        setLeadMetrics(data);
      } else {
        // Fallback to mock data
        const mockData: LeadGenerationMetrics = {
          totalLeads: 1247,
          qualifiedLeads: 892,
          conversionRate: 71.5,
          averageScore: 8.2,
          leadsBySource: [
            { name: 'LinkedIn', value: 542 },
            { name: 'Firecrawl', value: 387 },
            { name: 'Direct', value: 218 },
            { name: 'Referral', value: 100 },
          ],
          leadsByStatus: [
            { name: 'New', value: 324 },
            { name: 'Contacted', value: 456 },
            { name: 'Qualified', value: 892 },
            { name: 'Converted', value: 178 },
          ],
          weeklyTrend: [
            { timestamp: '2024-01-01', leads: 145, qualified: 98 },
            { timestamp: '2024-01-02', leads: 178, qualified: 124 },
            { timestamp: '2024-01-03', leads: 203, qualified: 156 },
            { timestamp: '2024-01-04', leads: 167, qualified: 118 },
            { timestamp: '2024-01-05', leads: 189, qualified: 142 },
            { timestamp: '2024-01-06', leads: 212, qualified: 167 },
            { timestamp: '2024-01-07', leads: 153, qualified: 87 },
          ],
        };
        setLeadMetrics(mockData);
      }
    } catch (error) {
      console.error('Error fetching lead metrics:', error);
    }
  };

  const fetchCampaignMetrics = async () => {
    try {
      const data = await analyticsService.getCampaignMetrics(dateRange.startDate, dateRange.endDate);
      if (data) {
        setCampaignMetrics(data);
      } else {
        // Fallback to mock data
        const mockData: CampaignMetrics = {
          activeCampaigns: 18,
          totalReached: 5847,
          responseRate: 23.4,
          clickRate: 45.2,
          campaignPerformance: [
            {
              id: '1',
              name: 'Q1 Financial Advisor Outreach',
              sent: 1200,
              opened: 876,
              clicked: 423,
              responded: 234,
            },
            {
              id: '2',
              name: 'Senior Advisor Recruitment',
              sent: 800,
              opened: 612,
              clicked: 298,
              responded: 156,
            },
            {
              id: '3',
              name: 'Spring Talent Pipeline',
              sent: 1500,
              opened: 1098,
              clicked: 567,
              responded: 312,
            },
          ],
          dailyActivity: [
            { timestamp: '2024-01-01', sent: 234, opened: 178, clicked: 89 },
            { timestamp: '2024-01-02', sent: 312, opened: 245, clicked: 134 },
            { timestamp: '2024-01-03', sent: 428, opened: 334, clicked: 187 },
            { timestamp: '2024-01-04', sent: 376, opened: 289, clicked: 156 },
            { timestamp: '2024-01-05', sent: 445, opened: 367, clicked: 198 },
            { timestamp: '2024-01-06', sent: 502, opened: 412, clicked: 234 },
            { timestamp: '2024-01-07', sent: 289, opened: 198, clicked: 98 },
          ],
        };
        setCampaignMetrics(mockData);
      }
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
    }
  };

  const fetchAgentMetrics = async () => {
    try {
      const data = await analyticsService.getAgentUsageMetrics(dateRange.startDate, dateRange.endDate);
      if (data) {
        setAgentMetrics(data);
      } else {
        // Fallback to mock data
        const mockData: AgentUsageMetrics = {
          totalAgents: 8,
          activeAgents: 6,
          tasksCompleted: 3842,
          averageResponseTime: 2.4,
          agentPerformance: [
            {
              agentType: 'Lead Generation',
              tasksCompleted: 1234,
              successRate: 94.2,
              averageTime: 1.8,
            },
            {
              agentType: 'Content Creation',
              tasksCompleted: 876,
              successRate: 98.1,
              averageTime: 3.2,
            },
            {
              agentType: 'Email Automation',
              tasksCompleted: 967,
              successRate: 96.7,
              averageTime: 0.8,
            },
            {
              agentType: 'Research',
              tasksCompleted: 765,
              successRate: 91.3,
              averageTime: 4.5,
            },
          ],
          hourlyUsage: Array.from({ length: 24 }, (_, i) => ({
            timestamp: `${i}:00`,
            tasks: Math.floor(Math.random() * 200) + 50,
            activeAgents: Math.floor(Math.random() * 6) + 2,
          })),
        };
        setAgentMetrics(mockData);
      }
    } catch (error) {
      console.error('Error fetching agent metrics:', error);
    }
  };

  const fetchUserMetrics = async () => {
    try {
      const data = await analyticsService.getUserActivityMetrics(dateRange.startDate, dateRange.endDate);
      if (data) {
        setUserMetrics(data);
      } else {
        // Fallback to mock data
        const mockData: UserActivityMetrics = {
          dailyActiveUsers: 42,
          weeklyActiveUsers: 156,
          monthlyActiveUsers: 387,
          averageSessionDuration: 34.5,
          topFeatures: [
            { feature: 'Lead Generation', usage: 1234, percentage: 32.1 },
            { feature: 'Email Campaigns', usage: 987, percentage: 25.7 },
            { feature: 'AI Chat', usage: 765, percentage: 19.9 },
            { feature: 'Analytics', usage: 543, percentage: 14.1 },
            { feature: 'Task Management', usage: 312, percentage: 8.2 },
          ],
          userGrowth: [
            { timestamp: '2024-01-01', dau: 38, wau: 142, mau: 356 },
            { timestamp: '2024-01-02', dau: 41, wau: 148, mau: 362 },
            { timestamp: '2024-01-03', dau: 39, wau: 151, mau: 368 },
            { timestamp: '2024-01-04', dau: 44, wau: 153, mau: 371 },
            { timestamp: '2024-01-05', dau: 42, wau: 155, mau: 378 },
            { timestamp: '2024-01-06', dau: 40, wau: 156, mau: 383 },
            { timestamp: '2024-01-07', dau: 42, wau: 156, mau: 387 },
          ],
        };
        setUserMetrics(mockData);
      }
    } catch (error) {
      console.error('Error fetching user metrics:', error);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchOverviewMetrics(),
          fetchLeadMetrics(),
          fetchCampaignMetrics(),
          fetchAgentMetrics(),
          fetchUserMetrics(),
        ]);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleExport = () => {
    // Implement export functionality
    // TODO: Add export functionality
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Track your AI-powered recruitment performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAllData}
            disabled={isLoading}
            className="bg-gray-800 border-gray-700 hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            className="bg-gray-800 border-gray-700 hover:bg-gray-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewMetrics.map((metric, index) => (
          <MetricsCard key={index} metric={metric} />
        ))}
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="leads">Lead Generation</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="agents">Agent Usage</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          {leadMetrics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Leads by Source"
                  description="Distribution of leads across different acquisition channels"
                  data={leadMetrics.leadsBySource}
                  type="pie"
                  height={300}
                />
                <ChartCard
                  title="Lead Status Funnel"
                  description="Current distribution of leads by status"
                  data={leadMetrics.leadsByStatus}
                  type="bar"
                  xAxisKey="name"
                  dataKey="value"
                  height={300}
                />
              </div>
              <ChartCard
                title="Weekly Lead Trend"
                description="Lead generation and qualification trends over the past week"
                data={leadMetrics.weeklyTrend}
                type="line"
                xAxisKey="timestamp"
                dataKey={['leads', 'qualified']}
                height={350}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          {campaignMetrics && (
            <>
              <ChartCard
                title="Campaign Performance"
                description="Email campaign metrics and engagement rates"
                data={campaignMetrics.campaignPerformance}
                type="bar"
                xAxisKey="name"
                dataKey={['sent', 'opened', 'clicked', 'responded']}
                height={350}
              />
              <ChartCard
                title="Daily Campaign Activity"
                description="Email sending and engagement trends"
                data={campaignMetrics.dailyActivity}
                type="area"
                xAxisKey="timestamp"
                dataKey={['sent', 'opened', 'clicked']}
                height={300}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          {agentMetrics && (
            <>
              <ChartCard
                title="Agent Performance"
                description="Task completion and success rates by agent type"
                data={agentMetrics.agentPerformance}
                type="radar"
                xAxisKey="agentType"
                dataKey={['successRate']}
                height={350}
              />
              <ChartCard
                title="Hourly Agent Usage"
                description="Task processing volume throughout the day"
                data={agentMetrics.hourlyUsage}
                type="area"
                xAxisKey="timestamp"
                dataKey={['tasks', 'activeAgents']}
                height={300}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {userMetrics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Feature Usage"
                  description="Most used features by percentage"
                  data={userMetrics.topFeatures}
                  type="bar"
                  xAxisKey="feature"
                  dataKey="percentage"
                  height={300}
                />
                <ChartCard
                  title="User Growth Trend"
                  description="Daily, weekly, and monthly active users"
                  data={userMetrics.userGrowth}
                  type="line"
                  xAxisKey="timestamp"
                  dataKey={['dau', 'wau', 'mau']}
                  height={300}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}