'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { workloadBalancer } from '@/lib/agents/workload-balancer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Users, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Cpu,
  HardDrive,
  BarChart3,
  PlayCircle,
  PauseCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  current_load: number;
  current_tasks: number;
  max_concurrent_tasks: number;
  success_rate: number;
  health_status: string;
  cpu_usage: number;
  memory_usage: number;
  tasks_last_hour: number;
  avg_duration_last_hour: number;
}

interface WorkloadStats {
  totalAgents: number;
  availableAgents: number;
  averageLoad: number;
  totalActiveTasks: number;
}

interface MetricData {
  timestamp: string;
  load_percentage: number;
  active_tasks: number;
  cpu_usage: number;
  memory_usage: number;
}

export default function AgentWorkloadMonitor() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<WorkloadStats | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [autoRebalance, setAutoRebalance] = useState(false);
  const [metricsEnabled, setMetricsEnabled] = useState(false);

  // Fetch agents and stats
  const fetchData = useCallback(async () => {
    try {
      // Fetch agents
      const agentsRes = await fetch('/api/agents?available=false');
      const agentsData = await agentsRes.json();
      
      if (agentsData.error) throw new Error(agentsData.error);
      setAgents(agentsData.agents || []);

      // Fetch stats
      const statsRes = await fetch('/api/agents/stats?timeRange=1h');
      const statsData = await statsRes.json();
      
      if (statsData.error) throw new Error(statsData.error);
      setStats(statsData.currentStats);
      setMetrics(statsData.metrics || []);

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    fetchData();

    // Subscribe to agent updates
    const agentChannel = supabase
      .channel('agent-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to task updates
    const taskChannel = supabase
      .channel('task-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Listen to workload balancer events
    const handleTaskAssigned = (data: any) => {
      console.log('Task assigned:', data);
      fetchData();
    };

    const handleRebalanceComplete = (data: any) => {
      console.log('Rebalance complete:', data);
      setRebalancing(false);
      fetchData();
    };

    workloadBalancer.on('task:assigned', handleTaskAssigned);
    workloadBalancer.on('rebalance:complete', handleRebalanceComplete);

    return () => {
      agentChannel.unsubscribe();
      taskChannel.unsubscribe();
      workloadBalancer.off('task:assigned', handleTaskAssigned);
      workloadBalancer.off('rebalance:complete', handleRebalanceComplete);
    };
  }, [fetchData]);

  // Handle manual rebalance
  const handleRebalance = async () => {
    setRebalancing(true);
    try {
      const res = await fetch('/api/agents/rebalance', {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      // Show success message
      console.log('Rebalance result:', data.result);
    } catch (err) {
      console.error('Error rebalancing:', err);
      setError(err instanceof Error ? err.message : 'Failed to rebalance');
      setRebalancing(false);
    }
  };

  // Toggle auto-rebalance
  const toggleAutoRebalance = async () => {
    try {
      const res = await fetch('/api/agents/rebalance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !autoRebalance,
          intervalMs: 60000 // 1 minute
        })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setAutoRebalance(!autoRebalance);
    } catch (err) {
      console.error('Error toggling auto-rebalance:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle auto-rebalance');
    }
  };

  // Toggle metrics collection
  const toggleMetrics = async () => {
    try {
      const res = await fetch('/api/agents/stats/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !metricsEnabled,
          intervalMs: 300000 // 5 minutes
        })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setMetricsEnabled(!metricsEnabled);
    } catch (err) {
      console.error('Error toggling metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle metrics');
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'overloaded': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  // Get health color
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Agent Workload Monitor</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant={autoRebalance ? "default" : "outline"}
            size="sm"
            onClick={toggleAutoRebalance}
          >
            {autoRebalance ? <PauseCircle className="h-4 w-4 mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Auto-Rebalance
          </Button>
          <Button
            variant={metricsEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleMetrics}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Metrics
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleRebalance}
            disabled={rebalancing}
          >
            <Activity className="h-4 w-4 mr-1" />
            {rebalancing ? 'Rebalancing...' : 'Rebalance Now'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Agents</p>
                  <p className="text-2xl font-bold">{stats.totalAgents}</p>
                </div>
                <Users className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available</p>
                  <p className="text-2xl font-bold">{stats.availableAgents}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Load</p>
                  <p className="text-2xl font-bold">{stats.averageLoad.toFixed(1)}%</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Tasks</p>
                  <p className="text-2xl font-bold">{stats.totalActiveTasks}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Load Distribution Chart */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workload Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="load_percentage" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  name="Load %"
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu_usage" 
                  stroke="#82ca9d" 
                  fill="#82ca9d" 
                  name="CPU %"
                />
                <Area 
                  type="monotone" 
                  dataKey="memory_usage" 
                  stroke="#ffc658" 
                  fill="#ffc658" 
                  name="Memory %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Agent List */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agents.map(agent => (
              <div key={agent.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`} />
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge variant="outline">{agent.type}</Badge>
                    <span className={`text-sm ${getHealthColor(agent.health_status)}`}>
                      {agent.health_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{agent.current_tasks}/{agent.max_concurrent_tasks} tasks</span>
                    <span>{agent.success_rate.toFixed(1)}% success</span>
                    <span>{agent.tasks_last_hour} tasks/hr</span>
                    {agent.avg_duration_last_hour > 0 && (
                      <span>~{formatDuration(agent.avg_duration_last_hour)}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Workload</span>
                      <span>{agent.current_load.toFixed(1)}%</span>
                    </div>
                    <Progress value={agent.current_load} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">CPU</span>
                      <span>{agent.cpu_usage.toFixed(1)}%</span>
                    </div>
                    <Progress value={agent.cpu_usage} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Memory</span>
                      <span>{agent.memory_usage.toFixed(1)}%</span>
                    </div>
                    <Progress value={agent.memory_usage} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}