import { EventEmitter } from 'eventemitter3';
import { Agent } from './Agent';
import { AgentType, AgentState, AgentCapability } from './types';

interface AgentInfo {
  agent: Agent;
  state: AgentState;
  capabilities: AgentCapability;
  lastHeartbeat: number;
}

export class AgentRegistry extends EventEmitter {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentInfo> = new Map();
  private agentsByType: Map<AgentType, Set<string>> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.startHealthCheck();
  }

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  // Register an agent
  async register(agent: Agent): Promise<void> {
    const info: AgentInfo = {
      agent,
      state: agent.getState(),
      capabilities: agent.getCapabilities(),
      lastHeartbeat: Date.now(),
    };
    
    this.agents.set(agent.getId(), info);
    
    // Update type index
    const type = agent.getType();
    if (!this.agentsByType.has(type)) {
      this.agentsByType.set(type, new Set());
    }
    this.agentsByType.get(type)!.add(agent.getId());
    
    this.emit('agent-registered', { agent: agent.getState() });
  }

  // Unregister an agent
  async unregister(agentId: string): Promise<void> {
    const info = this.agents.get(agentId);
    if (!info) {
      return;
    }
    
    // Remove from type index
    const type = info.agent.getType();
    this.agentsByType.get(type)?.delete(agentId);
    
    // Remove from registry
    this.agents.delete(agentId);
    
    this.emit('agent-unregistered', { agentId });
  }

  // Update agent heartbeat
  async updateHeartbeat(agentId: string): Promise<void> {
    const info = this.agents.get(agentId);
    if (info) {
      info.lastHeartbeat = Date.now();
      info.state = info.agent.getState();
    }
  }

  // Get agent by ID
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  // Get agents by type
  getAgentsByType(type: AgentType): Agent[] {
    const agentIds = this.agentsByType.get(type) || new Set();
    const agents: Agent[] = [];
    
    for (const id of agentIds) {
      const agent = this.agents.get(id)?.agent;
      if (agent) {
        agents.push(agent);
      }
    }
    
    return agents;
  }

  // Get all agents
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values()).map(info => info.agent);
  }

  // Get agent state
  getAgentState(agentId: string): AgentState | undefined {
    return this.agents.get(agentId)?.state;
  }

  // Get agent capabilities
  getAgentCapabilities(agentId: string): AgentCapability | undefined {
    return this.agents.get(agentId)?.capabilities;
  }

  // Find agents by capability
  findAgentsByCapability(capability: string): Agent[] {
    const agents: Agent[] = [];
    
    for (const info of this.agents.values()) {
      if (info.capabilities.actions[capability]) {
        agents.push(info.agent);
      }
    }
    
    return agents;
  }

  // Get best agent for a capability (based on availability)
  getBestAgentForCapability(capability: string): Agent | undefined {
    const agents = this.findAgentsByCapability(capability);
    
    // Sort by status priority: idle > busy > error
    agents.sort((a, b) => {
      const statusPriority = { idle: 0, busy: 1, error: 2, offline: 3 };
      const aStatus = this.getAgentState(a.getId())?.status || 'offline';
      const bStatus = this.getAgentState(b.getId())?.status || 'offline';
      return statusPriority[aStatus] - statusPriority[bStatus];
    });
    
    return agents[0];
  }

  // Health check
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute
      
      for (const [agentId, info] of this.agents) {
        if (now - info.lastHeartbeat > timeout) {
          // Update status to offline
          if (info.state.status !== 'offline') {
            info.state.status = 'offline';
            this.emit('agent-offline', { agentId });
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop health check
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // Get registry statistics
  getStats() {
    const stats: Record<string, any> = {
      totalAgents: this.agents.size,
      agentsByType: {},
      agentsByStatus: {},
    };
    
    // Count by type
    for (const [type, agentIds] of this.agentsByType) {
      stats.agentsByType[type] = agentIds.size;
    }
    
    // Count by status
    for (const info of this.agents.values()) {
      const status = info.state.status;
      stats.agentsByStatus[status] = (stats.agentsByStatus[status] || 0) + 1;
    }
    
    return stats;
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.stopHealthCheck();
    
    // Shutdown all agents
    const shutdownPromises = Array.from(this.agents.values()).map(info =>
      info.agent.shutdown().catch(error =>
        console.error(`Error shutting down agent ${info.agent.getId()}:`, error)
      )
    );
    
    await Promise.allSettled(shutdownPromises);
    
    this.agents.clear();
    this.agentsByType.clear();
  }
}