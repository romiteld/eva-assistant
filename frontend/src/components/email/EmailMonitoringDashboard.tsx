'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  TrendingUp,
  Filter,
  Play,
  Pause,
  Settings,
  BarChart3,
  Activity,
  Target,
  Inbox
} from 'lucide-react';
import { EmailProcessingResult } from '@/lib/automation/email-rules';
import { supabase } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface EmailStats {
  total: number;
  processed: number;
  pending: number;
  failed: number;
  avgProcessingTime: number;
  successRate: number;
}

interface ProcessedEmail {
  id: string;
  from_email: string;
  from_name?: string;
  subject: string;
  received_at: string;
  processed_at?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  priority: number;
  automation_result?: EmailProcessingResult;
  error_message?: string;
}

interface RuleStats {
  rule_name: string;
  matches: number;
  success_rate: number;
  avg_duration: number;
  last_match?: string;
}

export function EmailMonitoringDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<EmailStats>({
    total: 0,
    processed: 0,
    pending: 0,
    failed: 0,
    avgProcessingTime: 0,
    successRate: 0
  });
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [ruleStats, setRuleStats] = useState<RuleStats[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartData, setChartData] = useState<any[]>([]);

  // Fetch dashboard data
  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch email stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_email_processing_stats', {
          user_id: user.id,
          time_range: timeRange
        });

      if (statsError) throw statsError;

      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

      // Fetch recent emails
      const { data: emailsData, error: emailsError } = await supabase
        .from('processed_emails')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(50);

      if (emailsError) throw emailsError;
      setEmails(emailsData || []);

      // Fetch rule statistics
      const { data: rulesData, error: rulesError } = await supabase
        .from('email_automation_rule_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('matches', { ascending: false });

      if (rulesError) throw rulesError;
      setRuleStats(rulesData || []);

      // Fetch chart data
      const { data: chartData, error: chartError } = await supabase
        .rpc('get_email_processing_timeline', {
          user_id: user.id,
          time_range: timeRange
        });

      if (chartError) throw chartError;
      setChartData(chartData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [user, timeRange, autoRefresh]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('email-monitoring')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processed_emails',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const priorityColors = ['gray', 'blue', 'yellow', 'orange', 'red'];
  const getPriorityColor = (priority: number) => {
    const index = Math.min(Math.floor(priority / 2), 4);
    return priorityColors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Monitoring Dashboard</h2>
          <p className="text-gray-600">Real-time email processing and automation insights</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-1 border rounded-md"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          {/* Auto Refresh Toggle */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          
          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.avgProcessingTime / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">
              Target: &lt;30s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Processing Timeline Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Processing Timeline</CardTitle>
                <CardDescription>Email processing volume over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="processed"
                      stroke="#3B82F6"
                      name="Processed"
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#EF4444"
                      name="Failed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Rule Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Rules</CardTitle>
                <CardDescription>Most frequently matched automation rules</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ruleStats.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rule_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="matches" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Email Activity</CardTitle>
              <CardDescription>Latest processed emails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {emails.slice(0, 5).map((email) => (
                  <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={getStatusColor(email.status)}>
                        {getStatusIcon(email.status)}
                      </div>
                      <div>
                        <p className="font-medium">{email.subject}</p>
                        <p className="text-sm text-gray-600">
                          From: {email.from_name || email.from_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-${getPriorityColor(email.priority)}-600`}>
                        P{email.priority}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Email Processing Queue</CardTitle>
              <CardDescription>All emails in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${getStatusColor(email.status)}`}>
                          {getStatusIcon(email.status)}
                          <span className="capitalize">{email.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{email.from_name || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{email.from_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {email.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-${getPriorityColor(email.priority)}-600`}>
                          {email.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Automation Rule Performance</CardTitle>
              <CardDescription>Statistics for your email automation rules</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Matches</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Avg Duration</TableHead>
                    <TableHead>Last Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ruleStats.map((rule) => (
                    <TableRow key={rule.rule_name}>
                      <TableCell className="font-medium">{rule.rule_name}</TableCell>
                      <TableCell>{rule.matches}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={rule.success_rate} className="w-20" />
                          <span>{rule.success_rate.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{(rule.avg_duration / 1000).toFixed(2)}s</TableCell>
                      <TableCell>
                        {rule.last_match
                          ? formatDistanceToNow(new Date(rule.last_match), { addSuffix: true })
                          : 'Never'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Email Priority Distribution</CardTitle>
                <CardDescription>Breakdown of emails by priority level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High (8-10)', value: emails.filter(e => e.priority >= 8).length, fill: '#EF4444' },
                        { name: 'Medium (5-7)', value: emails.filter(e => e.priority >= 5 && e.priority < 8).length, fill: '#F59E0B' },
                        { name: 'Low (0-4)', value: emails.filter(e => e.priority < 5).length, fill: '#3B82F6' },
                      ]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                    >
                      {['#EF4444', '#F59E0B', '#3B82F6'].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Processing Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Processing Performance Trends</CardTitle>
                <CardDescription>Average processing time over the period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="avg_duration"
                      stroke="#10B981"
                      name="Avg Duration (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key performance indicators for email processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {emails.filter(e => e.automation_result?.matched).length}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Automated Emails</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {emails.filter(e => e.automation_result?.actions.some(a => a.type === 'create_deal')).length}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Deals Created</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {((stats.processed / stats.total) * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Processing Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}