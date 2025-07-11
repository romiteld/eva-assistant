import { z } from 'zod';
import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage, WorkflowState } from './base/types';
import { WorkflowEngine } from '../workflows/WorkflowEngine';
import { WorkflowTemplates } from '../workflows/WorkflowTemplates';

// Input/Output schemas
const OrchestrateSchema = z.object({
  workflowName: z.string(),
  steps: z.array(z.object({
    id: z.string(),
    agent: z.nativeEnum(AgentType),
    action: z.string(),
    input: z.any(),
    dependencies: z.array(z.string()).optional(),
    condition: z.object({
      type: z.enum(['always', 'on_success', 'on_failure', 'custom']),
      expression: z.string().optional(),
    }).optional(),
  })),
  context: z.record(z.string(), z.any()).optional(),
  timeout: z.number().optional(),
});

const CoordinateSchema = z.object({
  agents: z.array(z.object({
    type: z.nativeEnum(AgentType),
    actions: z.array(z.object({
      name: z.string(),
      input: z.any(),
      priority: z.number().optional(),
    })),
  })),
  strategy: z.enum(['parallel', 'sequential', 'priority']).optional(),
  maxConcurrency: z.number().optional(),
});

const MonitorSchema = z.object({
  workflowId: z.string().optional(),
  metrics: z.array(z.enum(['performance', 'errors', 'throughput', 'latency'])).optional(),
  includeAgentMetrics: z.boolean().optional(),
});

const RetrySchema = z.object({
  workflowId: z.string(),
  stepId: z.string().optional(),
  retryConfig: z.object({
    maxAttempts: z.number().default(3),
    backoffMs: z.number().default(1000),
    backoffMultiplier: z.number().default(2),
  }).optional(),
});

const RollbackSchema = z.object({
  workflowId: z.string(),
  toStep: z.string().optional(),
  preserveState: z.boolean().optional(),
});

const ReportSchema = z.object({
  workflowId: z.string().optional(),
  reportType: z.enum(['summary', 'detailed', 'performance', 'errors']),
  format: z.enum(['json', 'markdown', 'html']).optional(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
});

export class WorkflowAgent extends Agent {
  private workflowEngine: WorkflowEngine;
  private activeWorkflows: Map<string, WorkflowState> = new Map();
  private workflowHistory: WorkflowState[] = [];

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'Workflow Agent',
      type: AgentType.WORKFLOW,
      description: 'Orchestrates and coordinates multi-agent workflows',
      ...config,
    });

    this.workflowEngine = new WorkflowEngine(this);
    this.registerActions();
  }

  protected async onInitialize(): Promise<void> {
    await this.workflowEngine.initialize();
    
    // Subscribe to workflow events
    this.workflowEngine.on('workflow:started', (workflow) => {
      this.activeWorkflows.set(workflow.id, workflow);
    });
    
    this.workflowEngine.on('workflow:completed', (workflow) => {
      this.activeWorkflows.delete(workflow.id);
      this.workflowHistory.push(workflow);
    });
    
    this.workflowEngine.on('workflow:failed', (workflow) => {
      this.activeWorkflows.delete(workflow.id);
      this.workflowHistory.push(workflow);
    });
  }

  protected async onShutdown(): Promise<void> {
    // Cancel all active workflows
    for (const [workflowId, workflow] of this.activeWorkflows) {
      await this.workflowEngine.cancelWorkflow(workflowId);
    }
    
    await this.workflowEngine.shutdown();
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
      case 'orchestrate':
        return this.orchestrate(payload);
      case 'coordinate':
        return this.coordinate(payload);
      case 'monitor':
        return this.monitor(payload);
      case 'retry':
        return this.retry(payload);
      case 'rollback':
        return this.rollback(payload);
      case 'report':
        return this.report(payload);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private registerActions(): void {
    this.registerAction('orchestrate', {
      name: 'orchestrate',
      description: 'Orchestrate a multi-step workflow',
      inputSchema: OrchestrateSchema,
      outputSchema: z.object({
        workflowId: z.string(),
        status: z.string(),
        result: z.any().optional(),
        error: z.string().optional(),
      }),
    });

    this.registerAction('coordinate', {
      name: 'coordinate',
      description: 'Coordinate multiple agents',
      inputSchema: CoordinateSchema,
      outputSchema: z.object({
        results: z.array(z.object({
          agent: z.string(),
          action: z.string(),
          success: z.boolean(),
          data: z.any().optional(),
          error: z.string().optional(),
        })),
        summary: z.object({
          total: z.number(),
          successful: z.number(),
          failed: z.number(),
          duration: z.number(),
        }),
      }),
    });

    this.registerAction('monitor', {
      name: 'monitor',
      description: 'Monitor workflow and agent performance',
      inputSchema: MonitorSchema,
      outputSchema: z.object({
        workflows: z.array(z.object({
          id: z.string(),
          name: z.string(),
          status: z.string(),
          progress: z.number(),
          currentStep: z.string().optional(),
        })),
        metrics: z.record(z.string(), z.any()),
        alerts: z.array(z.object({
          level: z.enum(['info', 'warning', 'error']),
          message: z.string(),
          timestamp: z.string(),
        })),
      }),
    });

    this.registerAction('retry', {
      name: 'retry',
      description: 'Retry a failed workflow or step',
      inputSchema: RetrySchema,
      outputSchema: z.object({
        retryId: z.string(),
        workflowId: z.string(),
        status: z.string(),
        attempt: z.number(),
      }),
    });

    this.registerAction('rollback', {
      name: 'rollback',
      description: 'Rollback a workflow to a previous state',
      inputSchema: RollbackSchema,
      outputSchema: z.object({
        workflowId: z.string(),
        rolledBackTo: z.string(),
        status: z.string(),
        statePreserved: z.boolean(),
      }),
    });

    this.registerAction('report', {
      name: 'report',
      description: 'Generate workflow reports',
      inputSchema: ReportSchema,
      outputSchema: z.object({
        reportId: z.string(),
        type: z.string(),
        content: z.any(),
        generatedAt: z.string(),
      }),
    });
  }

  private async orchestrate(input: z.infer<typeof OrchestrateSchema>) {
    try {
      const workflow = await this.workflowEngine.createWorkflow({
        name: input.workflowName,
        steps: input.steps,
        context: input.context || {},
        timeout: input.timeout,
      });

      const result = await this.workflowEngine.executeWorkflow(workflow.id);

      this.broadcast('workflow_completed', {
        workflowId: workflow.id,
        name: input.workflowName,
        duration: Date.now() - workflow.startTime,
      });

      return {
        workflowId: workflow.id,
        status: result.status,
        result: result.result,
        error: result.error,
      };
    } catch (error) {
      this.broadcast('workflow_failed', {
        name: input.workflowName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async coordinate(input: z.infer<typeof CoordinateSchema>) {
    const startTime = Date.now();
    const results: any[] = [];
    
    try {
      const strategy = input.strategy || 'parallel';
      const maxConcurrency = input.maxConcurrency || 5;
      
      if (strategy === 'sequential') {
        // Execute sequentially
        for (const agentConfig of input.agents) {
          for (const action of agentConfig.actions) {
            const result = await this.executeAgentAction(
              agentConfig.type,
              action.name,
              action.input
            );
            results.push(result);
          }
        }
      } else if (strategy === 'parallel' || strategy === 'priority') {
        // Execute in parallel with concurrency limit
        const tasks = input.agents.flatMap(agentConfig =>
          agentConfig.actions.map(action => ({
            agent: agentConfig.type,
            action: action.name,
            input: action.input,
            priority: action.priority || 0,
          }))
        );
        
        // Sort by priority if priority strategy
        if (strategy === 'priority') {
          tasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        }
        
        // Execute with concurrency control
        for (let i = 0; i < tasks.length; i += maxConcurrency) {
          const batch = tasks.slice(i, i + maxConcurrency);
          const batchResults = await Promise.allSettled(
            batch.map(task =>
              this.executeAgentAction(task.agent, task.action, task.input)
            )
          );
          results.push(...batchResults.map((result, index) => ({
            ...batch[index],
            ...(result.status === 'fulfilled' ? result.value : { success: false, error: result.reason.message }),
          })));
        }
      }
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: Date.now() - startTime,
      };
      
      this.broadcast('coordination_completed', {
        agentCount: input.agents.length,
        actionCount: results.length,
        summary,
      });
      
      return { results, summary };
    } catch (error) {
      this.broadcast('coordination_failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async monitor(input: z.infer<typeof MonitorSchema>) {
    try {
      const workflows = [];
      const metrics: any = {};
      const alerts: any[] = [];
      
      // Get workflow status
      if (input.workflowId) {
        const workflow = this.activeWorkflows.get(input.workflowId);
        if (workflow) {
          workflows.push({
            id: workflow.id,
            name: workflow.name,
            status: workflow.status,
            progress: this.calculateProgress(workflow),
            currentStep: workflow.currentStep,
          });
        }
      } else {
        // Get all active workflows
        for (const [id, workflow] of this.activeWorkflows) {
          workflows.push({
            id: workflow.id,
            name: workflow.name,
            status: workflow.status,
            progress: this.calculateProgress(workflow),
            currentStep: workflow.currentStep,
          });
        }
      }
      
      // Collect metrics
      if (input.metrics) {
        for (const metric of input.metrics) {
          switch (metric) {
            case 'performance':
              metrics.performance = await this.getPerformanceMetrics();
              break;
            case 'errors':
              metrics.errors = await this.getErrorMetrics();
              break;
            case 'throughput':
              metrics.throughput = await this.getThroughputMetrics();
              break;
            case 'latency':
              metrics.latency = await this.getLatencyMetrics();
              break;
          }
        }
      }
      
      // Check for alerts
      if (metrics.errors?.errorRate > 0.1) {
        alerts.push({
          level: 'error' as const,
          message: 'High error rate detected',
          timestamp: new Date().toISOString(),
        });
      }
      
      if (metrics.latency?.p95 > 5000) {
        alerts.push({
          level: 'warning' as const,
          message: 'High latency detected',
          timestamp: new Date().toISOString(),
        });
      }
      
      return { workflows, metrics, alerts };
    } catch (error) {
      throw error;
    }
  }

  private async retry(input: z.infer<typeof RetrySchema>) {
    try {
      const workflow = this.activeWorkflows.get(input.workflowId) ||
        this.workflowHistory.find(w => w.id === input.workflowId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }
      
      const retryId = `retry_${Date.now()}`;
      
      // Retry specific step or entire workflow
      if (input.stepId) {
        await this.workflowEngine.retryStep(
          input.workflowId,
          input.stepId,
          input.retryConfig
        );
      } else {
        await this.workflowEngine.retryWorkflow(
          input.workflowId,
          input.retryConfig
        );
      }
      
      this.broadcast('workflow_retried', {
        workflowId: input.workflowId,
        stepId: input.stepId,
        retryId,
      });
      
      return {
        retryId,
        workflowId: input.workflowId,
        status: 'retrying',
        attempt: 1,
      };
    } catch (error) {
      this.broadcast('retry_failed', {
        workflowId: input.workflowId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async rollback(input: z.infer<typeof RollbackSchema>) {
    try {
      const workflow = this.activeWorkflows.get(input.workflowId) ||
        this.workflowHistory.find(w => w.id === input.workflowId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }
      
      const rolledBackTo = await this.workflowEngine.rollbackWorkflow(
        input.workflowId,
        input.toStep,
        input.preserveState
      );
      
      this.broadcast('workflow_rolled_back', {
        workflowId: input.workflowId,
        rolledBackTo,
      });
      
      return {
        workflowId: input.workflowId,
        rolledBackTo,
        status: 'rolled_back',
        statePreserved: input.preserveState || false,
      };
    } catch (error) {
      this.broadcast('rollback_failed', {
        workflowId: input.workflowId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async report(input: z.infer<typeof ReportSchema>) {
    try {
      const reportId = `report_${Date.now()}`;
      let content: any;
      
      switch (input.reportType) {
        case 'summary':
          content = await this.generateSummaryReport(input);
          break;
        case 'detailed':
          content = await this.generateDetailedReport(input);
          break;
        case 'performance':
          content = await this.generatePerformanceReport(input);
          break;
        case 'errors':
          content = await this.generateErrorReport(input);
          break;
      }
      
      // Format report if requested
      if (input.format === 'markdown') {
        content = this.formatAsMarkdown(content);
      } else if (input.format === 'html') {
        content = this.formatAsHtml(content);
      }
      
      this.broadcast('report_generated', {
        reportId,
        type: input.reportType,
      });
      
      return {
        reportId,
        type: input.reportType,
        content,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper methods
  private async executeAgentAction(
    agentType: AgentType,
    action: string,
    input: any
  ) {
    try {
      // Find best agent for the task
      const agent = this.registry.getBestAgentForCapability(action);
      if (!agent) {
        throw new Error(`No agent available for action: ${action}`);
      }
      
      const result = await this.sendRequest(agent.getId(), action, input);
      
      return {
        agent: agentType,
        action,
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        agent: agentType,
        action,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private calculateProgress(workflow: WorkflowState): number {
    const completedSteps = workflow.steps.filter(
      s => s.status === 'completed'
    ).length;
    return (completedSteps / workflow.steps.length) * 100;
  }

  private async getPerformanceMetrics() {
    // Aggregate performance data
    return {
      avgExecutionTime: 1234,
      successRate: 0.95,
      throughput: 100,
    };
  }

  private async getErrorMetrics() {
    return {
      errorRate: 0.05,
      errorCount: 10,
      topErrors: ['Timeout', 'API Error'],
    };
  }

  private async getThroughputMetrics() {
    return {
      requestsPerSecond: 10,
      completedWorkflows: 100,
      activeWorkflows: this.activeWorkflows.size,
    };
  }

  private async getLatencyMetrics() {
    return {
      p50: 100,
      p95: 500,
      p99: 1000,
    };
  }

  private async generateSummaryReport(input: any) {
    const workflows = input.workflowId
      ? [this.activeWorkflows.get(input.workflowId) || this.workflowHistory.find(w => w.id === input.workflowId)]
      : [...this.activeWorkflows.values(), ...this.workflowHistory];
    
    return {
      totalWorkflows: workflows.length,
      completedWorkflows: workflows.filter(w => w?.status === 'completed').length,
      failedWorkflows: workflows.filter(w => w?.status === 'failed').length,
      avgDuration: workflows.reduce((sum, w) => sum + ((w?.endTime || Date.now()) - (w?.startTime || 0)), 0) / workflows.length,
    };
  }

  private async generateDetailedReport(input: any) {
    // Generate detailed workflow report
    return {
      workflows: [],
      steps: [],
      agents: [],
      timeline: [],
    };
  }

  private async generatePerformanceReport(input: any) {
    return await this.getPerformanceMetrics();
  }

  private async generateErrorReport(input: any) {
    return await this.getErrorMetrics();
  }

  private formatAsMarkdown(content: any): string {
    return `# Workflow Report\n\n${JSON.stringify(content, null, 2)}`;
  }

  private formatAsHtml(content: any): string {
    return `<html><body><h1>Workflow Report</h1><pre>${JSON.stringify(content, null, 2)}</pre></body></html>`;
  }
}