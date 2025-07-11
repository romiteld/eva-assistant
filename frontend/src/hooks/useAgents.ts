import { useState, useEffect, useCallback } from 'react';
import { AgentType } from '@/lib/agents/base/types';
import { AgentInitializer } from '@/lib/agents/AgentInitializer';
import { AgentRegistry } from '@/lib/agents/base/AgentRegistry';
import { AgentMonitor } from '@/lib/agents/monitoring/AgentMonitor';
import { useToast } from './use-toast';

interface UseAgentsReturn {
  initialized: boolean;
  loading: boolean;
  error: Error | null;
  agents: any[];
  executeAction: (agentType: AgentType, action: string, payload: any) => Promise<any>;
  runWorkflow: (templateId: string, context: Record<string, any>) => Promise<any>;
  getAgentStatus: (agentId: string) => any;
  getSystemMetrics: () => any;
}

export function useAgents(): UseAgentsReturn {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const { toast } = useToast();

  // Initialize agents on mount
  useEffect(() => {
    const initAgents = async () => {
      try {
        setLoading(true);
        const initializer = AgentInitializer.getInstance();
        
        if (!initializer.isInitialized()) {
          await initializer.initialize();
        }
        
        // Get all agents from registry
        const registry = AgentRegistry.getInstance();
        const allAgents = registry.getAllAgents();
        setAgents(allAgents);
        
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize agents:', err);
        setError(err as Error);
        toast({
          title: 'Failed to initialize AI agents',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    initAgents();
  }, [toast]);

  // Execute an action on a specific agent
  const executeAction = useCallback(async (
    agentType: AgentType,
    action: string,
    payload: any
  ) => {
    if (!initialized) {
      throw new Error('Agents not initialized');
    }

    try {
      const registry = AgentRegistry.getInstance();
      const agentsOfType = registry.getAgentsByType(agentType);
      
      if (agentsOfType.length === 0) {
        throw new Error(`No agents of type ${agentType} available`);
      }

      // Get the best available agent
      const agent = registry.getBestAgentForCapability(action) || agentsOfType[0];
      
      if (!agent) {
        throw new Error(`No agent available for action ${action}`);
      }

      // Execute the action
      const result = await agent.sendRequest(agent.getId(), action, payload);
      
      toast({
        title: `Action ${action} completed successfully`,
        variant: 'success'
      });
      return result;
    } catch (err) {
      console.error(`Failed to execute action ${action}:`, err);
      toast({
        title: `Failed to execute ${action}`,
        variant: 'destructive'
      });
      throw err;
    }
  }, [initialized, toast]);

  // Run a workflow from template
  const runWorkflow = useCallback(async (
    templateId: string,
    context: Record<string, any>
  ) => {
    if (!initialized) {
      throw new Error('Agents not initialized');
    }

    try {
      const initializer = AgentInitializer.getInstance();
      const result = await initializer.runWorkflow(templateId, context);
      
      toast({
        title: 'Workflow started successfully',
        variant: 'success'
      });
      return result;
    } catch (err) {
      console.error(`Failed to run workflow ${templateId}:`, err);
      toast({
        title: 'Failed to start workflow',
        variant: 'destructive'
      });
      throw err;
    }
  }, [initialized, toast]);

  // Get agent status
  const getAgentStatus = useCallback((agentId: string) => {
    if (!initialized) return null;

    const registry = AgentRegistry.getInstance();
    const monitor = AgentMonitor.getInstance();
    
    return {
      state: registry.getAgentState(agentId),
      metrics: monitor.getAgentMetrics(agentId),
      health: monitor.getHealthCheck(agentId),
    };
  }, [initialized]);

  // Get system metrics
  const getSystemMetrics = useCallback(() => {
    if (!initialized) return null;

    const monitor = AgentMonitor.getInstance();
    return monitor.getSystemMetrics();
  }, [initialized]);

  return {
    initialized,
    loading,
    error,
    agents,
    executeAction,
    runWorkflow,
    getAgentStatus,
    getSystemMetrics,
  };
}

// Hook for monitoring agent events
export function useAgentEvents(agentId?: string) {
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (!agentId) return;

    const monitor = AgentMonitor.getInstance();
    
    const handleMetricsUpdate = (event: any) => {
      if (event.agentId === agentId) {
        setMetrics(event.metrics);
      }
    };

    const handleHealthDegraded = (event: any) => {
      if (event.agentId === agentId) {
        setEvents(prev => [...prev, { type: 'health:degraded', ...event, timestamp: Date.now() }]);
      }
    };

    monitor.on('metrics:updated', handleMetricsUpdate);
    monitor.on('health:degraded', handleHealthDegraded);

    // Get initial metrics
    const initialMetrics = monitor.getAgentMetrics(agentId);
    if (initialMetrics) {
      setMetrics(initialMetrics);
    }

    return () => {
      monitor.off('metrics:updated', handleMetricsUpdate);
      monitor.off('health:degraded', handleHealthDegraded);
    };
  }, [agentId]);

  return { events, metrics };
}