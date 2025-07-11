import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { WorkloadTask, AssignmentResult, BalancingStrategy } from '@/lib/agents/workload-balancer';

interface UseAgentWorkloadOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  strategy?: BalancingStrategy;
}

interface AgentWorkloadState {
  agents: any[];
  stats: any;
  loading: boolean;
  error: string | null;
}

export function useAgentWorkload(options: UseAgentWorkloadOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    strategy = BalancingStrategy.HYBRID
  } = options;

  const [state, setState] = useState<AgentWorkloadState>({
    agents: [],
    stats: null,
    loading: true,
    error: null
  });

  // Fetch agents and stats
  const fetchWorkloadData = useCallback(async () => {
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/agents/stats?timeRange=1h')
      ]);

      const agentsData = await agentsRes.json();
      const statsData = await statsRes.json();

      if (agentsData.error) throw new Error(agentsData.error);
      if (statsData.error) throw new Error(statsData.error);

      setState({
        agents: agentsData.agents || [],
        stats: statsData.currentStats,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workload data'
      }));
    }
  }, []);

  // Assign a single task
  const assignTask = useCallback(async (task: WorkloadTask): Promise<AssignmentResult> => {
    try {
      const response = await fetch('/api/agents/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, strategy })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign task');
      }

      // Refresh data after assignment
      if (autoRefresh) {
        fetchWorkloadData();
      }

      return {
        success: true,
        agentId: data.assignment.agentId,
        taskId: data.assignment.taskId
      };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [strategy, autoRefresh, fetchWorkloadData]);

  // Assign multiple tasks
  const assignTasks = useCallback(async (tasks: WorkloadTask[]): Promise<{
    summary: any;
    assignments: any[];
    failures: any[];
  }> => {
    try {
      const response = await fetch('/api/agents/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, strategy })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign tasks');
      }

      // Refresh data after assignments
      if (autoRefresh) {
        fetchWorkloadData();
      }

      return data;
    } catch (error) {
      throw error;
    }
  }, [strategy, autoRefresh, fetchWorkloadData]);

  // Trigger manual rebalance
  const rebalance = useCallback(async (): Promise<any> => {
    try {
      const response = await fetch('/api/agents/rebalance', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to rebalance');
      }

      // Refresh data after rebalance
      if (autoRefresh) {
        fetchWorkloadData();
      }

      return data.result;
    } catch (error) {
      throw error;
    }
  }, [autoRefresh, fetchWorkloadData]);

  // Get agent by ID
  const getAgent = useCallback((agentId: string) => {
    return state.agents.find(agent => agent.id === agentId);
  }, [state.agents]);

  // Get agents by status
  const getAgentsByStatus = useCallback((status: string) => {
    return state.agents.filter(agent => agent.status === status);
  }, [state.agents]);

  // Get available agents for a task
  const getAvailableAgentsForTask = useCallback((taskType?: string, requiredCapabilities?: string[]) => {
    return state.agents.filter(agent => {
      // Check if agent is available
      if (agent.status === 'offline' || agent.current_load >= 90) {
        return false;
      }

      // Check capabilities if required
      if (requiredCapabilities && requiredCapabilities.length > 0) {
        const hasAllCapabilities = requiredCapabilities.every(cap =>
          agent.capabilities?.includes(cap)
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }

      // Check specialization if task type provided
      if (taskType && agent.specializations?.includes(taskType)) {
        return true; // Prioritize specialized agents
      }

      return true;
    }).sort((a, b) => a.current_load - b.current_load);
  }, [state.agents]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!autoRefresh) return;

    // Initial fetch
    fetchWorkloadData();

    // Set up interval
    const interval = setInterval(fetchWorkloadData, refreshInterval);

    // Set up real-time subscriptions
    const agentChannel = supabase
      .channel('agent-workload-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents'
        },
        () => {
          fetchWorkloadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks'
        },
        () => {
          fetchWorkloadData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      agentChannel.unsubscribe();
    };
  }, [autoRefresh, refreshInterval, fetchWorkloadData]);

  return {
    // State
    agents: state.agents,
    stats: state.stats,
    loading: state.loading,
    error: state.error,
    
    // Actions
    assignTask,
    assignTasks,
    rebalance,
    refresh: fetchWorkloadData,
    
    // Helpers
    getAgent,
    getAgentsByStatus,
    getAvailableAgentsForTask
  };
}

// Hook for monitoring a specific agent
export function useAgentMonitor(agentId: string) {
  const [agent, setAgent] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentData = useCallback(async () => {
    if (!agentId) return;

    try {
      setLoading(true);

      // Fetch agent details
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentError) throw agentError;
      setAgent(agentData);

      // Fetch recent tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

      // Fetch metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('agent_metrics')
        .select('*')
        .eq('agent_id', agentId)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent data');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Update agent configuration
  const updateAgent = useCallback(async (updates: any) => {
    try {
      const response = await fetch('/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, ...updates })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update agent');
      }

      setAgent(data.agent);
      return data.agent;
    } catch (error) {
      throw error;
    }
  }, [agentId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!agentId) return;

    fetchAgentData();

    const channel = supabase
      .channel(`agent-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `id=eq.${agentId}`
        },
        () => {
          fetchAgentData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
          filter: `agent_id=eq.${agentId}`
        },
        () => {
          fetchAgentData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [agentId, fetchAgentData]);

  return {
    agent,
    metrics,
    tasks,
    loading,
    error,
    refresh: fetchAgentData,
    updateAgent
  };
}