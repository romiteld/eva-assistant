import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { StateGraph, END, START } from '@langchain/langgraph';
import { WorkflowState, AgentType } from '../agents/base/types';
import { AgentRegistry } from '../agents/base/AgentRegistry';
import { MessageBus } from '../agents/base/MessageBus';
import { StateManager } from './StateManager';

interface WorkflowConfig {
  name: string;
  steps: WorkflowStep[];
  context: Record<string, any>;
  timeout?: number;
}

interface WorkflowStep {
  id: string;
  agent: AgentType;
  action: string;
  input: any;
  dependencies?: string[];
  condition?: {
    type: 'always' | 'on_success' | 'on_failure' | 'custom';
    expression?: string;
  };
  // Runtime properties
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface WorkflowExecution {
  id: string;
  workflow: WorkflowState;
  graph: StateGraph<any>;
  controller: AbortController;
  promise: Promise<any>;
}

export class WorkflowEngine extends EventEmitter {
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private stateManager: StateManager;
  private executions: Map<string, WorkflowExecution> = new Map();
  private workflowAgent: any;

  constructor(workflowAgent: any) {
    super();
    this.workflowAgent = workflowAgent;
    this.registry = AgentRegistry.getInstance();
    this.messageBus = MessageBus.getInstance();
    this.stateManager = new StateManager();
  }

  async initialize(): Promise<void> {
    // Set up event listeners
    this.messageBus.on('message-delivered', this.handleMessageDelivered.bind(this));
    this.messageBus.on('delivery-failed', this.handleDeliveryFailed.bind(this));
  }

  async shutdown(): Promise<void> {
    // Cancel all active executions
    for (const [id, execution] of this.executions) {
      execution.controller.abort();
    }
    this.executions.clear();
  }

  async createWorkflow(config: WorkflowConfig): Promise<WorkflowState> {
    const workflow: WorkflowState = {
      id: uuidv4(),
      name: config.name,
      status: 'pending',
      steps: config.steps.map(step => ({
        ...step,
        status: 'pending',
        input: step.input,
      })),
      context: config.context,
      startTime: Date.now(),
    };

    await this.stateManager.saveWorkflow(workflow);
    this.emit('workflow:created', workflow);
    
    return workflow;
  }

  async executeWorkflow(workflowId: string): Promise<any> {
    const workflow = await this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Build LangGraph
    const graph = this.buildGraph(workflow);
    const controller = new AbortController();

    // Create execution
    const execution: WorkflowExecution = {
      id: workflowId,
      workflow,
      graph,
      controller,
      promise: this.runGraph(graph, workflow, controller.signal),
    };

    this.executions.set(workflowId, execution);

    // Update workflow status
    workflow.status = 'running';
    await this.stateManager.updateWorkflow(workflow);
    this.emit('workflow:started', workflow);

    try {
      const result = await execution.promise;
      
      // Update workflow status
      workflow.status = 'completed';
      workflow.endTime = Date.now();
      await this.stateManager.updateWorkflow(workflow);
      this.emit('workflow:completed', workflow);
      
      return { status: 'completed', result };
    } catch (error) {
      // Update workflow status
      workflow.status = 'failed';
      workflow.endTime = Date.now();
      workflow.error = (error as Error).message;
      await this.stateManager.updateWorkflow(workflow);
      this.emit('workflow:failed', workflow);
      
      return { status: 'failed', error: (error as Error).message };
    } finally {
      this.executions.delete(workflowId);
    }
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (!execution) {
      throw new Error('Workflow not found or not running');
    }

    execution.controller.abort();
    
    const workflow = execution.workflow;
    workflow.status = 'cancelled';
    workflow.endTime = Date.now();
    await this.stateManager.updateWorkflow(workflow);
    
    this.emit('workflow:cancelled', workflow);
  }

  async retryWorkflow(
    workflowId: string,
    retryConfig?: { maxAttempts?: number; backoffMs?: number; backoffMultiplier?: number }
  ): Promise<any> {
    const workflow = await this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Reset workflow state
    workflow.status = 'pending';
    workflow.steps.forEach(step => {
      if (step.status === 'failed') {
        step.status = 'pending';
        delete step.error;
      }
    });
    delete workflow.error;
    delete workflow.endTime;

    await this.stateManager.updateWorkflow(workflow);
    
    // Re-execute
    return this.executeWorkflow(workflowId);
  }

  async retryStep(
    workflowId: string,
    stepId: string,
    retryConfig?: { maxAttempts?: number; backoffMs?: number; backoffMultiplier?: number }
  ): Promise<any> {
    const workflow = await this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error('Step not found');
    }

    // Reset step state
    step.status = 'pending';
    delete step.error;
    workflow.currentStep = stepId;

    await this.stateManager.updateWorkflow(workflow);
    
    // Execute single step
    return this.executeStep(workflow, step);
  }

  async rollbackWorkflow(
    workflowId: string,
    toStep?: string,
    preserveState?: boolean
  ): Promise<string> {
    const workflow = await this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Find rollback point
    let rollbackIndex = 0;
    if (toStep) {
      rollbackIndex = workflow.steps.findIndex(s => s.id === toStep);
      if (rollbackIndex === -1) {
        throw new Error('Step not found');
      }
    }

    // Reset steps after rollback point
    for (let i = rollbackIndex; i < workflow.steps.length; i++) {
      workflow.steps[i].status = 'pending';
      delete workflow.steps[i].output;
      delete workflow.steps[i].error;
      delete workflow.steps[i].endTime;
    }

    // Optionally preserve state
    if (!preserveState) {
      workflow.context = {};
    }

    workflow.status = 'pending';
    delete workflow.error;
    delete workflow.endTime;

    await this.stateManager.updateWorkflow(workflow);
    
    return toStep || 'start';
  }

  private buildGraph(workflow: WorkflowState): StateGraph<any> {
    const graph = new StateGraph({
      workflowId: null,
      currentStep: null,
      context: null,
      results: null,
      error: null,
    } as any);

    // Add nodes for each step
    for (const step of workflow.steps) {
      graph.addNode(step.id, async (state) => {
        try {
          const result = await this.executeStep(workflow, step);
          return {
            ...state,
            currentStep: step.id,
            results: { ...state.results, [step.id]: result },
          };
        } catch (error) {
          return {
            ...state,
            error: (error as Error).message,
          };
        }
      });
    }

    // Add edges based on dependencies and conditions
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      
      if (i === 0) {
        graph.addEdge(START, step.id as any);
      }

      // Handle dependencies
      if ('dependencies' in step && step.dependencies && (step.dependencies as string[]).length > 0) {
        for (const dep of (step.dependencies as string[])) {
          graph.addEdge(dep as any, step.id as any);
        }
      } else if (i > 0) {
        // Default sequential flow
        graph.addEdge(workflow.steps[i - 1].id as any, step.id as any);
      }

      // Handle conditions
      if ('condition' in step && step.condition) {
        graph.addConditionalEdges(
          step.id as any,
          (state) => this.evaluateCondition(state, (step as WorkflowStep).condition!),
          {
            continue: i < workflow.steps.length - 1 ? workflow.steps[i + 1].id as any : END,
            skip: i < workflow.steps.length - 1 ? workflow.steps[i + 1].id as any : END,
            end: END,
          }
        );
      } else if (i === workflow.steps.length - 1) {
        graph.addEdge(step.id as any, END as any);
      }
    }

    return graph.compile() as any;
  }

  private async runGraph(
    graph: any,
    workflow: WorkflowState,
    signal: AbortSignal
  ): Promise<any> {
    const initialState = {
      workflowId: workflow.id,
      currentStep: null,
      context: workflow.context,
      results: {},
      error: null,
    };

    const stream = await graph.stream(initialState, {
      recursionLimit: 100,
    });

    let finalState = initialState;
    
    for await (const state of stream) {
      if (signal.aborted) {
        throw new Error('Workflow cancelled');
      }
      finalState = state;
      
      // Update workflow state
      if (state.currentStep) {
        workflow.currentStep = state.currentStep;
        await this.stateManager.updateWorkflow(workflow);
      }
    }

    if (finalState.error) {
      throw new Error(finalState.error);
    }

    return finalState.results;
  }

  private async executeStep(
    workflow: WorkflowState,
    step: WorkflowStep
  ): Promise<any> {
    // Update step status
    step.status = 'running';
    step.startTime = Date.now();
    await this.stateManager.updateWorkflow(workflow);
    this.emit('step:started', { workflow, step });

    try {
      // Find agent
      const agent = this.registry.getBestAgentForCapability(step.action);
      if (!agent) {
        throw new Error(`No agent available for action: ${step.action}`);
      }

      // Process input with context
      const processedInput = this.processStepInput(step.input, workflow.context);

      // Execute action
      const result = await this.workflowAgent.sendRequest(
        agent.getId(),
        step.action,
        processedInput
      );

      // Update step status
      step.status = 'completed';
      step.output = result;
      step.endTime = Date.now();
      await this.stateManager.updateWorkflow(workflow);
      this.emit('step:completed', { workflow, step });

      // Update context with result
      workflow.context[step.id] = result;

      return result;
    } catch (error) {
      // Update step status
      step.status = 'failed';
      step.error = (error as Error).message;
      step.endTime = Date.now();
      await this.stateManager.updateWorkflow(workflow);
      this.emit('step:failed', { workflow, step, error });

      throw error;
    }
  }

  private processStepInput(input: any, context: Record<string, any>): any {
    // Replace context references in input
    if (typeof input === 'string') {
      return input.replace(/\{\{(\w+)\.?(\w+)?\}\}/g, (match, key, prop) => {
        const value = context[key];
        if (prop && value && typeof value === 'object') {
          return value[prop] || match;
        }
        return value || match;
      });
    } else if (typeof input === 'object' && input !== null) {
      const processed: any = Array.isArray(input) ? [] : {};
      for (const [key, value] of Object.entries(input)) {
        processed[key] = this.processStepInput(value, context);
      }
      return processed;
    }
    return input;
  }

  private evaluateCondition(
    state: any,
    condition: { type: string; expression?: string }
  ): string {
    switch (condition.type) {
      case 'always':
        return 'continue';
      case 'on_success':
        return state.error ? 'skip' : 'continue';
      case 'on_failure':
        return state.error ? 'continue' : 'skip';
      case 'custom':
        if (condition.expression) {
          try {
            // Simple expression evaluation (in production, use a safe evaluator)
            const result = new Function('state', `return ${condition.expression}`)(state);
            return result ? 'continue' : 'skip';
          } catch {
            return 'skip';
          }
        }
        return 'continue';
      default:
        return 'continue';
    }
  }

  private handleMessageDelivered(event: any): void {
    // Handle message delivery events
  }

  private handleDeliveryFailed(event: any): void {
    // Handle delivery failure events
  }
}