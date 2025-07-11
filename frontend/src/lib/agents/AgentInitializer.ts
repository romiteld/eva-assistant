import { ScrapingAgent } from './ScrapingAgent';
import { AnalysisAgent } from './AnalysisAgent';
import { CommunicationAgent } from './CommunicationAgent';
import { CalendarAgent } from './CalendarAgent';
import { ContentAgent } from './ContentAgent';
import { DataAgent } from './DataAgent';
import { WorkflowAgent } from './WorkflowAgent';
import { RecruiterIntelAgent } from './RecruiterIntelAgent';
import { AgentRegistry } from './base/AgentRegistry';
import { AgentMonitor } from './monitoring/AgentMonitor';
import { AgentLogger } from './monitoring/AgentLogger';
import { WorkflowTemplates } from '../workflows/WorkflowTemplates';

export class AgentInitializer {
  private static instance: AgentInitializer;
  private initialized = false;
  private agents: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): AgentInitializer {
    if (!AgentInitializer.instance) {
      AgentInitializer.instance = new AgentInitializer();
    }
    return AgentInitializer.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Agents already initialized');
      return;
    }

    console.log('Initializing Agent-to-Agent system...');

    try {
      // Start monitoring
      const monitor = AgentMonitor.getInstance();
      monitor.start();

      // Initialize logger
      const logger = AgentLogger.getInstance({
        level: parseInt(process.env.LOG_LEVEL || '1'), // INFO by default
        maxEntries: 10000,
        persistLogs: true,
        logToConsole: process.env.NODE_ENV === 'development',
        structuredLogging: true,
      });

      // Create and initialize agents
      const agents = [
        new ScrapingAgent(),
        new AnalysisAgent(),
        new CommunicationAgent(),
        new CalendarAgent(),
        new ContentAgent(),
        new DataAgent(),
        new WorkflowAgent(),
        new RecruiterIntelAgent(),
      ];

      // Initialize all agents in parallel
      await Promise.all(
        agents.map(async (agent) => {
          try {
            await agent.initialize();
            this.agents.set(agent.getId(), agent);
            logger.info(
              agent.getId(),
              'initialization',
              `Agent ${agent.getName()} initialized successfully`
            );
          } catch (error) {
            logger.error(
              agent.getId(),
              'initialization',
              `Failed to initialize agent ${agent.getName()}`,
              error as Error
            );
            throw error;
          }
        })
      );

      this.initialized = true;
      console.log('Agent-to-Agent system initialized successfully');

      // Log system stats
      const registry = AgentRegistry.getInstance();
      const stats = registry.getStats();
      logger.info(
        undefined,
        'system',
        'Agent system initialized',
        stats
      );
    } catch (error) {
      console.error('Failed to initialize agents:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('Shutting down Agent-to-Agent system...');

    try {
      // Shutdown all agents
      const registry = AgentRegistry.getInstance();
      await registry.shutdown();

      // Stop monitoring
      const monitor = AgentMonitor.getInstance();
      monitor.stop();

      this.agents.clear();
      this.initialized = false;

      console.log('Agent-to-Agent system shut down successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }

  getAgent(agentId: string): any {
    return this.agents.get(agentId);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Helper method to run a simple workflow
  async runWorkflow(templateId: string, context: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const workflowAgent = Array.from(this.agents.values()).find(
      agent => agent.getType() === 'workflow'
    );

    if (!workflowAgent) {
      throw new Error('Workflow agent not found');
    }

    return workflowAgent.sendRequest(
      workflowAgent.getId(),
      'orchestrate',
      {
        workflowName: `Template: ${templateId}`,
        ...WorkflowTemplates.createWorkflowFromTemplate(templateId, context),
      }
    );
  }
}