import { useState, useCallback, useEffect, useRef } from 'react';
import { WorkflowEngine } from '@/lib/workflows/WorkflowEngine';
import { WorkflowState } from '@/lib/agents/base/types';
import { useToast } from '@/hooks/use-toast';

interface WorkflowExecution {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: string;
  progress?: number;
}

interface UseWorkflowEngineReturn {
  workflows: WorkflowState[];
  executions: Record<string, WorkflowExecution>;
  createWorkflow: (config: any) => Promise<WorkflowState>;
  executeWorkflow: (workflowId: string) => Promise<void>;
  cancelWorkflow: (workflowId: string) => Promise<void>;
  retryWorkflow: (workflowId: string) => Promise<void>;
  getWorkflowStatus: (workflowId: string) => WorkflowExecution | undefined;
  isLoading: boolean;
}

export function useWorkflowEngine(): UseWorkflowEngineReturn {
  const [workflows, setWorkflows] = useState<WorkflowState[]>([]);
  const [executions, setExecutions] = useState<Record<string, WorkflowExecution>>({});
  const [isLoading, setIsLoading] = useState(false);
  const engineRef = useRef<WorkflowEngine | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize workflow engine
    const initEngine = async () => {
      try {
        // For now, pass a mock workflow agent
        const mockWorkflowAgent = {
          sendRequest: async (agentId: string, action: string, input: any) => {
            // Simulate agent execution
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { success: true, data: input };
          }
        };
        
        const engine = new WorkflowEngine(mockWorkflowAgent);
        await engine.initialize();
        engineRef.current = engine;

        // Set up event listeners
        engine.on('workflow:created', (workflow: WorkflowState) => {
          setWorkflows(prev => [...prev, workflow]);
        });

        engine.on('workflow:started', (workflow: WorkflowState) => {
          setExecutions(prev => ({
            ...prev,
            [workflow.id]: { 
              id: workflow.id, 
              status: 'running',
              progress: 0
            }
          }));
        });

        engine.on('workflow:completed', (workflow: WorkflowState) => {
          setExecutions(prev => ({
            ...prev,
            [workflow.id]: { 
              id: workflow.id, 
              status: 'completed',
              progress: 100
            }
          }));
        });

        engine.on('workflow:failed', (workflow: WorkflowState) => {
          setExecutions(prev => ({
            ...prev,
            [workflow.id]: { 
              id: workflow.id, 
              status: 'failed',
              error: workflow.error,
              progress: 0
            }
          }));
        });

        engine.on('workflow:cancelled', (workflow: WorkflowState) => {
          setExecutions(prev => ({
            ...prev,
            [workflow.id]: { 
              id: workflow.id, 
              status: 'cancelled',
              progress: 0
            }
          }));
        });

        engine.on('step:completed', ({ workflow, step }) => {
          const completedSteps = workflow.steps.filter((s: { status: string }) => s.status === 'completed').length;
          const progress = Math.round((completedSteps / workflow.steps.length) * 100);
          
          setExecutions(prev => ({
            ...prev,
            [workflow.id]: { 
              ...prev[workflow.id],
              progress
            }
          }));
        });
      } catch (error) {
        console.error('Failed to initialize workflow engine:', error);
        toast({
          title: 'Initialization Error',
          description: 'Failed to initialize workflow engine',
          variant: 'destructive'
        });
      }
    };

    initEngine();

    return () => {
      if (engineRef.current) {
        engineRef.current.shutdown();
      }
    };
  }, [toast]);

  const createWorkflow = useCallback(async (config: any): Promise<WorkflowState> => {
    if (!engineRef.current) {
      throw new Error('Workflow engine not initialized');
    }

    setIsLoading(true);
    try {
      const workflow = await engineRef.current.createWorkflow(config);
      return workflow;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const executeWorkflow = useCallback(async (workflowId: string) => {
    if (!engineRef.current) {
      throw new Error('Workflow engine not initialized');
    }

    try {
      await engineRef.current.executeWorkflow(workflowId);
    } catch (error) {
      toast({
        title: 'Execution Error',
        description: error instanceof Error ? error.message : 'Failed to execute workflow',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const cancelWorkflow = useCallback(async (workflowId: string) => {
    if (!engineRef.current) {
      throw new Error('Workflow engine not initialized');
    }

    try {
      await engineRef.current.cancelWorkflow(workflowId);
      toast({
        title: 'Workflow Cancelled',
        description: 'The workflow has been cancelled'
      });
    } catch (error) {
      toast({
        title: 'Cancel Error',
        description: error instanceof Error ? error.message : 'Failed to cancel workflow',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const retryWorkflow = useCallback(async (workflowId: string) => {
    if (!engineRef.current) {
      throw new Error('Workflow engine not initialized');
    }

    try {
      await engineRef.current.retryWorkflow(workflowId);
    } catch (error) {
      toast({
        title: 'Retry Error',
        description: error instanceof Error ? error.message : 'Failed to retry workflow',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const getWorkflowStatus = useCallback((workflowId: string): WorkflowExecution | undefined => {
    return executions[workflowId];
  }, [executions]);

  return {
    workflows,
    executions,
    createWorkflow,
    executeWorkflow,
    cancelWorkflow,
    retryWorkflow,
    getWorkflowStatus,
    isLoading
  };
}