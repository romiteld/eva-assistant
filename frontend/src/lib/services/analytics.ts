import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { 
  LeadGenerationMetrics, 
  CampaignMetrics, 
  AgentUsageMetrics, 
  UserActivityMetrics,
  MetricData 
} from '@/types/analytics';
import { startOfDay, endOfDay, format, eachDayOfInterval, subDays } from 'date-fns';

export class AnalyticsService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getOverviewMetrics(startDate: Date, endDate: Date): Promise<MetricData[]> {
    try {
      // Fetch various metrics from different tables
      const [leads, campaigns, tasks, agents] = await Promise.all([
        this.getLeadCount(startDate, endDate),
        this.getActiveCampaignCount(),
        this.getTaskCompletionCount(startDate, endDate),
        this.getAverageResponseTime(startDate, endDate),
      ]);

      // Calculate period comparisons
      const previousStartDate = subDays(startDate, 7);
      const previousEndDate = subDays(endDate, 7);

      const [prevLeads, prevTasks] = await Promise.all([
        this.getLeadCount(previousStartDate, previousEndDate),
        this.getTaskCompletionCount(previousStartDate, previousEndDate),
      ]);

      const leadChange = prevLeads > 0 ? ((leads - prevLeads) / prevLeads) * 100 : 0;
      const taskChange = prevTasks > 0 ? ((tasks - prevTasks) / prevTasks) * 100 : 0;

      return [
        {
          label: 'Total Leads Generated',
          value: leads,
          change: leadChange,
          changeType: leadChange >= 0 ? 'increase' : 'decrease',
          icon: 'users',
        },
        {
          label: 'Active Campaigns',
          value: campaigns,
          icon: 'mail',
        },
        {
          label: 'Tasks Completed',
          value: tasks,
          change: taskChange,
          changeType: taskChange >= 0 ? 'increase' : 'decrease',
          icon: 'checkCircle',
        },
        {
          label: 'Avg Response Time',
          value: agents.avgResponseTime,
          change: agents.responseTimeChange,
          changeType: agents.responseTimeChange <= 0 ? 'decrease' : 'increase',
          unit: 'time',
          icon: 'clock',
        },
      ];
    } catch (error) {
      console.error('Error fetching overview metrics:', error);
      return [];
    }
  }

  async getLeadGenerationMetrics(startDate: Date, endDate: Date): Promise<LeadGenerationMetrics | null> {
    try {
      // Fetch leads data
      const { data: leads, error } = await this.supabase
        .from('leads')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Process lead data
      const totalLeads = leads?.length || 0;
      const qualifiedLeads = leads?.filter(lead => lead.status === 'qualified').length || 0;
      const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;
      const averageScore = leads?.reduce((sum, lead) => sum + (lead.score || 0), 0) / totalLeads || 0;

      // Group by source
      const leadsBySource = this.groupByProperty(leads || [], 'source');
      
      // Group by status
      const leadsByStatus = this.groupByProperty(leads || [], 'status');

      // Generate weekly trend
      const weeklyTrend = await this.getWeeklyLeadTrend(startDate, endDate);

      return {
        totalLeads,
        qualifiedLeads,
        conversionRate,
        averageScore,
        leadsBySource,
        leadsByStatus,
        weeklyTrend,
      };
    } catch (error) {
      console.error('Error fetching lead generation metrics:', error);
      return null;
    }
  }

  async getCampaignMetrics(startDate: Date, endDate: Date): Promise<CampaignMetrics | null> {
    try {
      // Fetch campaign data
      const { data: campaigns, error } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      // Fetch campaign statistics
      const { data: stats, error: statsError } = await this.supabase
        .from('campaign_statistics')
        .select('*')
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString());

      if (statsError) throw statsError;

      const activeCampaigns = campaigns?.length || 0;
      const totalReached = stats?.reduce((sum, stat) => sum + (stat.sent || 0), 0) || 0;
      const totalOpened = stats?.reduce((sum, stat) => sum + (stat.opened || 0), 0) || 0;
      const totalClicked = stats?.reduce((sum, stat) => sum + (stat.clicked || 0), 0) || 0;
      const totalResponded = stats?.reduce((sum, stat) => sum + (stat.responded || 0), 0) || 0;

      const responseRate = totalReached > 0 ? (totalResponded / totalReached) * 100 : 0;
      const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

      // Get campaign performance details
      const campaignPerformance = campaigns?.map(campaign => {
        const campaignStats = stats?.filter(stat => stat.campaign_id === campaign.id) || [];
        return {
          id: campaign.id,
          name: campaign.name,
          sent: campaignStats.reduce((sum, stat) => sum + (stat.sent || 0), 0),
          opened: campaignStats.reduce((sum, stat) => sum + (stat.opened || 0), 0),
          clicked: campaignStats.reduce((sum, stat) => sum + (stat.clicked || 0), 0),
          responded: campaignStats.reduce((sum, stat) => sum + (stat.responded || 0), 0),
        };
      }) || [];

      // Generate daily activity
      const dailyActivity = await this.getDailyCampaignActivity(startDate, endDate);

      return {
        activeCampaigns,
        totalReached,
        responseRate,
        clickRate,
        campaignPerformance,
        dailyActivity,
      };
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
      return null;
    }
  }

  async getAgentUsageMetrics(startDate: Date, endDate: Date): Promise<AgentUsageMetrics | null> {
    try {
      // Fetch agent data
      const { data: agents, error } = await this.supabase
        .from('agents')
        .select('*');

      if (error) throw error;

      // Fetch agent tasks
      const { data: tasks, error: tasksError } = await this.supabase
        .from('agent_tasks')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (tasksError) throw tasksError;

      const totalAgents = agents?.length || 0;
      const activeAgents = agents?.filter(agent => agent.status === 'busy' || agent.status === 'available').length || 0;
      const tasksCompleted = tasks?.filter(task => task.status === 'completed').length || 0;
      
      // Calculate average response time
      const completedTasks = tasks?.filter(task => task.status === 'completed' && task.completed_at) || [];
      const totalResponseTime = completedTasks.reduce((sum, task) => {
        const created = new Date(task.created_at).getTime();
        const completed = new Date(task.completed_at!).getTime();
        return sum + (completed - created) / 1000; // Convert to seconds
      }, 0);
      const averageResponseTime = completedTasks.length > 0 ? totalResponseTime / completedTasks.length : 0;

      // Agent performance by type
      const agentPerformance = agents?.map(agent => {
        const agentTasks = tasks?.filter(task => task.agent_id === agent.id) || [];
        const completed = agentTasks.filter(task => task.status === 'completed').length;
        const total = agentTasks.length;
        const successRate = total > 0 ? (completed / total) * 100 : 0;
        
        const agentResponseTime = agentTasks
          .filter(task => task.status === 'completed' && task.completed_at)
          .reduce((sum, task) => {
            const created = new Date(task.created_at).getTime();
            const completed = new Date(task.completed_at!).getTime();
            return sum + (completed - created) / 1000;
          }, 0);
        const avgTime = completed > 0 ? agentResponseTime / completed : 0;

        return {
          agentType: agent.name || 'Unknown',
          tasksCompleted: completed,
          successRate,
          averageTime: avgTime,
        };
      }) || [];

      // Generate hourly usage
      const hourlyUsage = await this.getHourlyAgentUsage(startDate, endDate);

      return {
        totalAgents,
        activeAgents,
        tasksCompleted,
        averageResponseTime,
        agentPerformance,
        hourlyUsage,
      };
    } catch (error) {
      console.error('Error fetching agent usage metrics:', error);
      return null;
    }
  }

  async getUserActivityMetrics(startDate: Date, endDate: Date): Promise<UserActivityMetrics | null> {
    try {
      // Fetch user activity data
      const { data: sessions, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Calculate active users
      const uniqueUsers = new Set(sessions?.map(session => session.user_id) || []);
      const dailyActiveUsers = uniqueUsers.size;

      // For weekly and monthly, we'd need more data
      // These are estimates for now
      const weeklyActiveUsers = dailyActiveUsers * 3.5;
      const monthlyActiveUsers = dailyActiveUsers * 15;

      // Calculate average session duration
      const totalDuration = sessions?.reduce((sum, session) => {
        if (session.ended_at) {
          const duration = new Date(session.ended_at).getTime() - new Date(session.created_at).getTime();
          return sum + duration / 60000; // Convert to minutes
        }
        return sum;
      }, 0) || 0;
      const averageSessionDuration = sessions?.length ? totalDuration / sessions.length : 0;

      // Feature usage (mock data for now)
      const topFeatures = [
        { feature: 'Lead Generation', usage: 1234, percentage: 32.1 },
        { feature: 'Email Campaigns', usage: 987, percentage: 25.7 },
        { feature: 'AI Chat', usage: 765, percentage: 19.9 },
        { feature: 'Analytics', usage: 543, percentage: 14.1 },
        { feature: 'Task Management', usage: 312, percentage: 8.2 },
      ];

      // Generate user growth trend
      const userGrowth = await this.getUserGrowthTrend(startDate, endDate);

      return {
        dailyActiveUsers,
        weeklyActiveUsers: Math.round(weeklyActiveUsers),
        monthlyActiveUsers: Math.round(monthlyActiveUsers),
        averageSessionDuration,
        topFeatures,
        userGrowth,
      };
    } catch (error) {
      console.error('Error fetching user activity metrics:', error);
      return null;
    }
  }

  // Helper methods
  private async getLeadCount(startDate: Date, endDate: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    return count || 0;
  }

  private async getActiveCampaignCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    return count || 0;
  }

  private async getTaskCompletionCount(startDate: Date, endDate: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());
    
    return count || 0;
  }

  private async getAverageResponseTime(startDate: Date, endDate: Date): Promise<{ avgResponseTime: number; responseTimeChange: number }> {
    // This would calculate actual response times from agent tasks
    // For now, returning mock data
    return { avgResponseTime: 2.4, responseTimeChange: -15.3 };
  }

  private groupByProperty(items: any[], property: string): { name: string; value: number }[] {
    const grouped = items.reduce((acc, item) => {
      const key = item[property] || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value: value as number }));
  }

  private async getWeeklyLeadTrend(startDate: Date, endDate: Date): Promise<any[]> {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    const trend = await Promise.all(
      days.map(async (day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        
        const { count: leads } = await this.supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());
        
        const { count: qualified } = await this.supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'qualified')
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());
        
        return {
          timestamp: format(day, 'yyyy-MM-dd'),
          leads: leads || 0,
          qualified: qualified || 0,
        };
      })
    );
    
    return trend;
  }

  private async getDailyCampaignActivity(startDate: Date, endDate: Date): Promise<any[]> {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // This would fetch actual campaign statistics
    // For now, returning mock data
    return days.map(day => ({
      timestamp: format(day, 'yyyy-MM-dd'),
      sent: Math.floor(Math.random() * 500) + 200,
      opened: Math.floor(Math.random() * 400) + 150,
      clicked: Math.floor(Math.random() * 200) + 50,
    }));
  }

  private async getHourlyAgentUsage(startDate: Date, endDate: Date): Promise<any[]> {
    // This would fetch actual hourly usage data
    // For now, returning mock data for 24 hours
    return Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${i}:00`,
      tasks: Math.floor(Math.random() * 200) + 50,
      activeAgents: Math.floor(Math.random() * 6) + 2,
    }));
  }

  private async getUserGrowthTrend(startDate: Date, endDate: Date): Promise<any[]> {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // This would fetch actual user activity data
    // For now, returning mock data
    return days.map((day, index) => ({
      timestamp: format(day, 'yyyy-MM-dd'),
      dau: Math.floor(Math.random() * 10) + 35,
      wau: Math.floor(Math.random() * 20) + 140,
      mau: Math.floor(Math.random() * 50) + 350 + index * 5,
    }));
  }
}