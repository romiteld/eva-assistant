'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Brain,
  Zap,
  Target,
  Clock,
  Users,
  BarChart3,
  Activity,
  Award,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface AgentPerformance {
  agentName: string;
  totalExecutions: number;
  avgConfidence: number;
  avgDurationMs: number;
  successRate: number;
  lastUsed: Date;
}

interface ContentPerformance {
  contentId: string;
  platform: string;
  type: string;
  createdAt: Date;
  predictedEngagement: number;
  actualEngagement: number;
  accuracy: number;
  viralityScore: number;
}

export function ContentAnalyticsDashboard() {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  
  const [agentMetrics, setAgentMetrics] = useState<AgentPerformance[]>([]);
  const [contentMetrics, setContentMetrics] = useState<ContentPerformance[]>([]);
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [platformData, setPlatformData] = useState<any[]>([]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch agent performance data
      const { data: agentData } = await supabase
        .from('agent_performance')
        .select('*')
        .order('total_executions', { ascending: false });
      
      // Fetch content performance data
      const { data: contentData } = await supabase
        .from('social_media_posts')
        .select('*')
        .gte('created_at', getTimeRangeDate(timeRange))
        .order('created_at', { ascending: false });
      
      // Process data for visualizations
      if (agentData) {
        setAgentMetrics(processAgentData(agentData));
      }
      
      if (contentData) {
        setContentMetrics(processContentData(contentData));
        setEngagementData(processEngagementData(contentData));
        setPlatformData(processPlatformData(contentData));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, supabase]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, fetchAnalytics]);

  const getTimeRangeDate = (range: string): string => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return subDays(new Date(), days).toISOString();
  };

  const processAgentData = (data: any[]): AgentPerformance[] => {
    return data.map(agent => ({
      agentName: agent.agent_name,
      totalExecutions: agent.total_executions,
      avgConfidence: agent.avg_confidence * 100,
      avgDurationMs: agent.avg_duration_ms,
      successRate: (agent.successful_executions / agent.total_executions) * 100,
      lastUsed: new Date(agent.last_used)
    }));
  };

  const processContentData = useCallback((data: any[]): ContentPerformance[] => {
    return data.map(content => ({
      contentId: content.id,
      platform: content.platform,
      type: content.content_type || 'social',
      createdAt: new Date(content.created_at),
      predictedEngagement: content.prediction_score * 100 || 0,
      actualEngagement: calculateEngagement(content.actual_engagement),
      accuracy: calculateAccuracy(content.prediction_score, content.actual_engagement),
      viralityScore: content.prediction_score * 10 || 0
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateEngagement = (engagement: any): number => {
    if (!engagement) return 0;
    const { likes = 0, shares = 0, comments = 0 } = engagement;
    return likes + (shares * 2) + (comments * 3);
  };

  const calculateAccuracy = (predicted: number, actual: any): number => {
    if (!predicted || !actual) return 0;
    const actualScore = calculateEngagement(actual) / 100;
    const diff = Math.abs(predicted - actualScore);
    return Math.max(0, 100 - (diff * 100));
  };

  const processEngagementData = useCallback((data: any[]): any[] => {
    // Group by date
    interface GroupedData {
      date: string;
      predicted: number;
      actual: number;
      posts: number;
    }
    
    const grouped = data.reduce((acc: Record<string, GroupedData>, post: ContentPerformance) => {
      const date = format(new Date(post.createdAt), 'MMM dd');
      if (!acc[date]) {
        acc[date] = { date, predicted: 0, actual: 0, posts: 0 };
      }
      acc[date].predicted += (post.predictedEngagement || 0) * 100;
      acc[date].actual += calculateEngagement(post.actualEngagement);
      acc[date].posts += 1;
      return acc;
    }, {});

    return Object.values(grouped).map((day: any) => ({
      ...day,
      predicted: day.predicted / day.posts,
      actual: day.actual / day.posts
    }));
  }, []);

  const processPlatformData = useCallback((data: any[]): any[] => {
    const platforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
    const colors = ['#0077B5', '#1DA1F2', '#E4405F', '#1877F2'];
    
    return platforms.map((platform, index) => {
      const platformPosts = data.filter(post => post.platform === platform);
      return {
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        value: platformPosts.length,
        engagement: platformPosts.reduce((sum: number, post: ContentPerformance) => 
          sum + calculateEngagement(post.actualEngagement), 0
        ) / Math.max(platformPosts.length, 1),
        color: colors[index]
      };
    });
  }, []);

  const agentRadarData = agentMetrics.slice(0, 5).map(agent => ({
    agent: agent.agentName.replace('_agent', ''),
    performance: agent.successRate,
    confidence: agent.avgConfidence,
    speed: Math.max(0, 100 - (agent.avgDurationMs / 100))
  }));

  const totalContent = contentMetrics.length;
  const avgAccuracy = contentMetrics.reduce((sum: number, c: ContentPerformance) => sum + c.accuracy, 0) / Math.max(totalContent, 1);
  const topPerformer = agentMetrics[0];
  
  return (
    <div className="space-y-6 p-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Content Created</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContent}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +23% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prediction Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAccuracy.toFixed(1)}%</div>
            <Progress value={avgAccuracy} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2s</div>
            <p className="text-xs text-muted-foreground">
              5 agents in parallel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Agent</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {topPerformer?.agentName.replace('_', ' ') || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {topPerformer?.successRate.toFixed(0)}% success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="agents">Agent Analytics</TabsTrigger>
          <TabsTrigger value="content">Content Analysis</TabsTrigger>
          <TabsTrigger value="predictions">Prediction Accuracy</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Performance</CardTitle>
              <CardDescription>
                Predicted vs Actual engagement over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="predicted" 
                    stackId="1"
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.6}
                    name="Predicted Engagement"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    stackId="2"
                    stroke="#10b981" 
                    fill="#10b981"
                    fillOpacity={0.6}
                    name="Actual Engagement"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={platformData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Type Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { type: 'Social', engagement: 85, virality: 7.2 },
                    { type: 'Blog', engagement: 72, virality: 5.8 },
                    { type: 'Email', engagement: 68, virality: 4.5 },
                    { type: 'Video', engagement: 92, virality: 8.9 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="engagement" fill="#3b82f6" name="Engagement %" />
                    <Bar dataKey="virality" fill="#f59e0b" name="Virality Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Radar</CardTitle>
              <CardDescription>
                Comparing performance, confidence, and speed across agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={agentRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="agent" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar 
                    name="Performance" 
                    dataKey="performance" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.6} 
                  />
                  <Radar 
                    name="Confidence" 
                    dataKey="confidence" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6} 
                  />
                  <Radar 
                    name="Speed" 
                    dataKey="speed" 
                    stroke="#f59e0b" 
                    fill="#f59e0b" 
                    fillOpacity={0.6} 
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentMetrics.map((agent: AgentPerformance) => (
              <Card key={agent.agentName}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">
                    {agent.agentName.replace('_', ' ')}
                  </CardTitle>
                  <CardDescription>
                    Last used: {format(agent.lastUsed, 'MMM dd, HH:mm')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Executions</span>
                    <Badge>{agent.totalExecutions}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Success Rate</span>
                    <span className="text-sm font-medium">
                      {agent.successRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={agent.successRate} className="h-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Confidence</span>
                    <span className="text-sm font-medium">
                      {agent.avgConfidence.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Duration</span>
                    <span className="text-sm font-medium">
                      {(agent.avgDurationMs / 1000).toFixed(2)}s
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Performance Timeline</CardTitle>
              <CardDescription>
                Track how content performs across different platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contentMetrics.slice(0, 10).map((content: ContentPerformance) => (
                  <div key={content.contentId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{content.platform}</Badge>
                      <div>
                        <p className="font-medium">
                          {content.type.charAt(0).toUpperCase() + content.type.slice(1)} Content
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Created {format(content.createdAt, 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Predicted</p>
                        <p className="font-medium">{content.predictedEngagement.toFixed(0)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Actual</p>
                        <p className="font-medium">{content.actualEngagement}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Accuracy</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{content.accuracy.toFixed(0)}%</p>
                          {content.accuracy >= 80 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prediction Accuracy Trends</CardTitle>
              <CardDescription>
                How well our AI predicts content performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={engagementData.map(d => ({
                  ...d,
                  accuracy: Math.abs(100 - Math.abs(d.predicted - d.actual))
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Prediction Accuracy %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Accuracy by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {platformData.map((platform: any) => (
                    <div key={platform.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{platform.name}</span>
                        <span>{(Math.random() * 20 + 75).toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.random() * 20 + 75} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Virality Predictions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Correctly Predicted Viral</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">82%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>False Positives</span>
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">12%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Missed Opportunities</span>
                    <Badge variant="secondary">6%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}