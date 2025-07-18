'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BrainCircuit, 
  Play, 
  Pause, 
  RotateCw,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Loader2
} from 'lucide-react';
import { agentOrchestrator, Agent, AgentExecution } from '@/lib/services/agent-orchestrator';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function OrchestratorPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Load agents and execution history
  const loadData = useCallback(async () => {
    try {
      const [agentList, executionHistory, logs, metrics] = await Promise.all([
        agentOrchestrator.listAgents(),
        agentOrchestrator.getExecutionHistory(20),
        agentOrchestrator.getActivityLogs(50),
        agentOrchestrator.getPerformanceMetrics()
      ]);
      setAgents(agentList);
      setExecutions(executionHistory);
      setActivityLogs(logs);
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error('Agent Orchestrator Error:', error);
      
      // Check if it's a network/edge function error
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      const isEdgeFunctionError = errorMessage.includes('404') || errorMessage.includes('Agent orchestrator error');
      
      toast({
        title: isEdgeFunctionError ? 'Edge Function Not Deployed' : 'Error loading data',
        description: isEdgeFunctionError 
          ? 'The Agent Orchestrator Edge Function needs to be deployed. Run: supabase functions deploy agent-orchestrator'
          : errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Auto-refresh active agents
  useEffect(() => {
    loadData();

    // Set up auto-refresh for active agents
    const interval = setInterval(() => {
      const hasActiveAgents = agents.some(a => a.status === 'active');
      if (hasActiveAgents) {
        loadData();
      }
    }, 2000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [agents, loadData]);

  const handleExecuteAgent = async (agentId: string) => {
    try {
      setExecuting(agentId);
      await agentOrchestrator.executeAgent(agentId);
      toast({
        title: 'Agent started',
        description: `${agentId} is now running`
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Execution failed',
        description: error instanceof Error ? error.message : 'Failed to execute agent',
        variant: 'destructive'
      });
    } finally {
      setExecuting(null);
    }
  };

  const handlePauseAgent = async (agentId: string) => {
    try {
      await agentOrchestrator.pauseAgent(agentId);
      toast({
        title: 'Agent paused',
        description: `${agentId} has been paused`
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Pause failed',
        description: error instanceof Error ? error.message : 'Failed to pause agent',
        variant: 'destructive'
      });
    }
  };

  const handleResumeAgent = async (agentId: string) => {
    try {
      await agentOrchestrator.resumeAgent(agentId);
      toast({
        title: 'Agent resumed',
        description: `${agentId} has been resumed`
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Resume failed',
        description: error instanceof Error ? error.message : 'Failed to resume agent',
        variant: 'destructive'
      });
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      await agentOrchestrator.stopAgent(agentId);
      toast({
        title: 'Agent stopped',
        description: `${agentId} has been stopped`
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Stop failed',
        description: error instanceof Error ? error.message : 'Failed to stop agent',
        variant: 'destructive'
      });
    }
  };

  const handlePauseAll = async () => {
    try {
      const activeAgents = agents.filter(a => a.status === 'active').map(a => a.id);
      if (activeAgents.length > 0) {
        await agentOrchestrator.pauseAgents(activeAgents);
        toast({
          title: 'All agents paused',
          description: `${activeAgents.length} agents have been paused`
        });
        await loadData();
      }
    } catch (error) {
      toast({
        title: 'Pause all failed',
        description: error instanceof Error ? error.message : 'Failed to pause all agents',
        variant: 'destructive'
      });
    }
  };

  const handleStartAll = async () => {
    try {
      const idleAgents = agents.filter(a => a.status === 'idle').map(a => a.id);
      if (idleAgents.length > 0) {
        await agentOrchestrator.startAgents(idleAgents);
        toast({
          title: 'All agents started',
          description: `${idleAgents.length} agents have been started`
        });
        await loadData();
      }
    } catch (error) {
      toast({
        title: 'Start all failed',
        description: error instanceof Error ? error.message : 'Failed to start all agents',
        variant: 'destructive'
      });
    }
  };

  // Calculate statistics
  const activeCount = agents.filter(a => a.status === 'active').length;
  const completedCount = executions.filter(e => e.status === 'completed').length;
  const successRate = executions.length > 0 
    ? Math.round((completedCount / executions.length) * 100)
    : 0;
  const avgResponseTime = executions
    .filter(e => e.completed_at && e.started_at)
    .reduce((acc, e) => {
      const duration = new Date(e.completed_at!).getTime() - new Date(e.started_at).getTime();
      return acc + duration;
    }, 0) / (completedCount || 1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return 'bg-green-500/20 text-green-400 border-green-500/20';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/20';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return <Activity className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'paused':
        return <PauseCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Agent Orchestrator v2</h1>
            <p className="text-gray-400 mt-2">Coordinate and monitor all AI agents from one place</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePauseAll}>
              <Pause className="w-4 h-4 mr-1" />
              Pause All
            </Button>
            <Button size="sm" onClick={handleStartAll}>
              <Play className="w-4 h-4 mr-1" />
              Start All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activeCount}</div>
              <p className="text-xs text-gray-400">Currently running</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                Completed Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{completedCount}</div>
              <p className="text-xs text-gray-400">Total executions</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{successRate}%</div>
              <p className="text-xs text-gray-400">Success rate</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Avg Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {(avgResponseTime / 1000).toFixed(1)}s
              </div>
              <p className="text-xs text-gray-400">Response time</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="agents">Active Agents</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
            <TabsTrigger value="logs">Activity Logs</TabsTrigger>
            <TabsTrigger value="metrics">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <BrainCircuit className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-white">{agent.name}</h3>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(agent.status)}
                      >
                        <span className="flex items-center gap-1">
                          {getStatusIcon(agent.status)}
                          {agent.status}
                        </span>
                      </Badge>
                      {agent.type && (
                        <Badge variant="outline" className="text-xs">
                          {agent.type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {agent.status === 'idle' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleExecuteAgent(agent.id)}
                          disabled={executing === agent.id}
                        >
                          {executing === agent.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {agent.status === 'active' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handlePauseAgent(agent.id)}
                          >
                            <PauseCircle className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleStopAgent(agent.id)}
                          >
                            <StopCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {agent.status === 'paused' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleResumeAgent(agent.id)}
                        >
                          <PlayCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {agent.status === 'active' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          {agent.currentTask || 'Processing...'}
                        </span>
                        <span className="text-gray-400">{agent.progress}%</span>
                      </div>
                      <Progress value={agent.progress} className="h-2" />
                    </div>
                  )}
                  {agent.description && (
                    <p className="text-sm text-gray-400 mt-2">{agent.description}</p>
                  )}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.capabilities.map((capability, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/20"
                        >
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {agent.lastActivity && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last activity: {format(new Date(agent.lastActivity), 'MMM d, h:mm a')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Execution History</CardTitle>
                <CardDescription>Recent agent executions and their results</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {executions.map((execution) => (
                      <div 
                        key={execution.id} 
                        className="p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {agents.find(a => a.id === execution.agent_id)?.name || execution.agent_id}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={getStatusColor(execution.status)}
                            >
                              {execution.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-400">
                            {format(new Date(execution.started_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {execution.completed_at && (
                          <p className="text-xs text-gray-500">
                            Duration: {(
                              (new Date(execution.completed_at).getTime() - 
                               new Date(execution.started_at).getTime()) / 1000
                            ).toFixed(1)}s
                          </p>
                        )}
                        {execution.error && (
                          <p className="text-xs text-red-400 mt-1">{execution.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Activity Logs</CardTitle>
                <CardDescription>Real-time agent activity and system events</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {activityLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="secondary" 
                              className={
                                log.log_level === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                                log.log_level === 'warn' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' :
                                log.log_level === 'info' ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' :
                                'bg-gray-500/20 text-gray-400 border-gray-500/20'
                              }
                            >
                              {log.log_level.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-white">
                              {log.agent_registry?.name || log.agent_id}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {format(new Date(log.timestamp), 'MMM d, h:mm:ss a')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-1">{log.message}</p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer hover:text-gray-400">
                              View details
                            </summary>
                            <pre className="mt-1 bg-black/20 p-2 rounded text-xs overflow-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                    {activityLogs.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        No activity logs yet. Execute an agent to see logs appear here.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Performance Metrics</CardTitle>
                <CardDescription>Agent execution performance and success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {performanceMetrics.map((metric) => (
                      <div 
                        key={metric.id} 
                        className="p-4 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                            <span className="font-medium text-white">
                              {metric.agent_registry?.name || metric.agent_id}
                            </span>
                            <Badge variant={metric.success ? 'default' : 'destructive'}>
                              {metric.success ? 'Success' : 'Failed'}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-400">
                            {format(new Date(metric.start_time), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Duration</span>
                            <div className="font-medium text-white">
                              {metric.duration_ms ? `${(metric.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">Tasks</span>
                            <div className="font-medium text-white">
                              {metric.tasks_completed || 0}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">Accuracy</span>
                            <div className="font-medium text-white">
                              {metric.accuracy_score ? `${(metric.accuracy_score * 100).toFixed(1)}%` : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">Confidence</span>
                            <div className="font-medium text-white">
                              {metric.confidence_score ? `${(metric.confidence_score * 100).toFixed(1)}%` : 'N/A'}
                            </div>
                          </div>
                        </div>

                        {metric.api_calls_count > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <span className="text-xs text-gray-400">
                              API Calls: {metric.api_calls_count}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {performanceMetrics.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        No performance metrics yet. Execute an agent to see metrics appear here.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}