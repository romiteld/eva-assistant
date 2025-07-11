import { EventEmitter } from 'eventemitter3';
import { AgentRegistry } from '../base/AgentRegistry';
import { MessageBus } from '../base/MessageBus';
import { AgentType, AgentState } from '../base/types';

interface AgentMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalDuration: number;
  avgDuration: number;
  lastActivity: number;
  errorRate: number;
  throughput: number;
}

interface SystemMetrics {
  totalAgents: number;
  activeAgents: number;
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  systemUptime: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface HealthCheck {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  issues: string[];
}

export class AgentMonitor extends EventEmitter {
  private static instance: AgentMonitor;
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private startTime: number;
  private monitoringInterval?: NodeJS.Timeout;
  private metricsWindow: number = 60000; // 1 minute window for rate calculations

  private constructor() {
    super();
    this.registry = AgentRegistry.getInstance();
    this.messageBus = MessageBus.getInstance();
    this.startTime = Date.now();
  }

  static getInstance(): AgentMonitor {
    if (!AgentMonitor.instance) {
      AgentMonitor.instance = new AgentMonitor();
    }
    return AgentMonitor.instance;
  }

  start(): void {
    // Subscribe to agent events
    this.setupEventListeners();
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
      this.calculateMetrics();
      this.checkAlerts();
    }, 30000); // Every 30 seconds
    
    console.log('Agent monitoring started');
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.removeAllListeners();
    console.log('Agent monitoring stopped');
  }

  private setupEventListeners(): void {
    // Listen to registry events
    this.registry.on('agent-registered', (event) => {
      this.initializeAgentMetrics(event.agent.id);
    });
    
    this.registry.on('agent-unregistered', (event) => {
      this.agentMetrics.delete(event.agentId);
      this.healthChecks.delete(event.agentId);
    });
    
    this.registry.on('agent-offline', (event) => {
      this.updateHealthCheck(event.agentId, 'unhealthy', ['Agent offline']);
    });
    
    // Listen to message bus events
    this.messageBus.on('message-delivered', (event) => {
      this.recordMessageDelivery(event.agentId);
    });
    
    this.messageBus.on('delivery-failed', (event) => {
      this.recordDeliveryFailure(event.agentId, event.error);
    });
    
    // Listen to all agents for performance metrics
    const agents = this.registry.getAllAgents();
    for (const agent of agents) {
      this.subscribeToAgentEvents(agent.getId());
    }
  }

  private subscribeToAgentEvents(agentId: string): void {
    const agent = this.registry.getAgent(agentId);
    if (!agent) return;
    
    agent.on('request-processed', (event) => {
      this.recordRequestMetrics(agentId, event);
    });
    
    agent.on('error', (event) => {
      this.recordError(agentId, event);
    });
    
    agent.on('heartbeat', () => {
      this.updateHealthCheck(agentId, 'healthy', []);
    });
  }

  private initializeAgentMetrics(agentId: string): void {
    this.agentMetrics.set(agentId, {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalDuration: 0,
      avgDuration: 0,
      lastActivity: Date.now(),
      errorRate: 0,
      throughput: 0,
    });
    
    this.healthChecks.set(agentId, {
      agentId,
      status: 'healthy',
      lastCheck: Date.now(),
      issues: [],
    });
  }

  private recordRequestMetrics(agentId: string, event: any): void {
    const metrics = this.agentMetrics.get(agentId);
    if (!metrics) return;
    
    metrics.requestCount++;
    metrics.lastActivity = Date.now();
    
    if (event.success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
    
    if (event.duration) {
      metrics.totalDuration += event.duration;
      metrics.avgDuration = metrics.totalDuration / metrics.requestCount;
    }
    
    this.emit('metrics:updated', { agentId, metrics });
  }

  private recordMessageDelivery(agentId: string): void {
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.lastActivity = Date.now();
    }
  }

  private recordDeliveryFailure(agentId: string, error: any): void {
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.errorCount++;
    }
    
    this.updateHealthCheck(agentId, 'degraded', [`Message delivery failed: ${error.message}`]);
  }

  private recordError(agentId: string, error: any): void {
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.errorCount++;
    }
    
    const healthCheck = this.healthChecks.get(agentId);
    if (healthCheck) {
      healthCheck.issues.push(`Error: ${error.message || error.error}`);
      if (healthCheck.issues.length > 5) {
        healthCheck.issues.shift(); // Keep only last 5 issues
      }
    }
  }

  private performHealthChecks(): void {
    const now = Date.now();
    
    for (const [agentId, healthCheck] of this.healthChecks) {
      const agent = this.registry.getAgent(agentId);
      const agentState = this.registry.getAgentState(agentId);
      const metrics = this.agentMetrics.get(agentId);
      
      const issues: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // Check if agent exists
      if (!agent || !agentState) {
        status = 'unhealthy';
        issues.push('Agent not found in registry');
      } else {
        // Check agent status
        if (agentState.status === 'error') {
          status = 'unhealthy';
          issues.push('Agent in error state');
        } else if (agentState.status === 'offline') {
          status = 'unhealthy';
          issues.push('Agent offline');
        }
        
        // Check last heartbeat
        const heartbeatTimeout = 90000; // 90 seconds
        if (now - agentState.lastHeartbeat > heartbeatTimeout) {
          status = status === 'healthy' ? 'degraded' : status;
          issues.push('No recent heartbeat');
        }
        
        // Check error rate
        if (metrics && metrics.requestCount > 10) {
          const errorRate = metrics.errorCount / metrics.requestCount;
          if (errorRate > 0.5) {
            status = 'unhealthy';
            issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
          } else if (errorRate > 0.2) {
            status = status === 'healthy' ? 'degraded' : status;
            issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(1)}%`);
          }
        }
        
        // Check response time
        if (metrics && metrics.avgDuration > 5000) {
          status = status === 'healthy' ? 'degraded' : status;
          issues.push(`Slow response time: ${metrics.avgDuration.toFixed(0)}ms`);
        }
      }
      
      healthCheck.status = status;
      healthCheck.lastCheck = now;
      healthCheck.issues = issues;
      
      if (status !== 'healthy') {
        this.emit('health:degraded', { agentId, status, issues });
      }
    }
  }

  private calculateMetrics(): void {
    const now = Date.now();
    const windowStart = now - this.metricsWindow;
    
    // Calculate rates and throughput
    for (const [agentId, metrics] of this.agentMetrics) {
      // Simple throughput calculation (requests per minute)
      metrics.throughput = (metrics.requestCount / ((now - this.startTime) / 60000));
      
      // Error rate
      metrics.errorRate = metrics.requestCount > 0 
        ? metrics.errorCount / metrics.requestCount 
        : 0;
    }
    
    // Emit system metrics
    this.emit('metrics:system', this.getSystemMetrics());
  }

  private checkAlerts(): void {
    const systemMetrics = this.getSystemMetrics();
    
    // Check system-wide alerts
    if (systemMetrics.totalErrors > 100) {
      this.emit('alert:error', {
        level: 'critical',
        message: `High system error count: ${systemMetrics.totalErrors}`,
        timestamp: Date.now(),
      });
    }
    
    if (systemMetrics.avgResponseTime > 3000) {
      this.emit('alert:performance', {
        level: 'warning',
        message: `High average response time: ${systemMetrics.avgResponseTime.toFixed(0)}ms`,
        timestamp: Date.now(),
      });
    }
    
    // Check agent-specific alerts
    for (const [agentId, metrics] of this.agentMetrics) {
      if (metrics.errorRate > 0.5 && metrics.requestCount > 10) {
        this.emit('alert:agent', {
          level: 'error',
          agentId,
          message: `Agent ${agentId} has high error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
          timestamp: Date.now(),
        });
      }
    }
  }

  private updateHealthCheck(
    agentId: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    issues: string[]
  ): void {
    const healthCheck = this.healthChecks.get(agentId);
    if (healthCheck) {
      healthCheck.status = status;
      healthCheck.issues = issues;
      healthCheck.lastCheck = Date.now();
    }
  }

  // Public API
  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    return this.agentMetrics.get(agentId);
  }

  getAllAgentMetrics(): Map<string, AgentMetrics> {
    return new Map(this.agentMetrics);
  }

  getSystemMetrics(): SystemMetrics {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    let activeAgents = 0;
    
    for (const [agentId, metrics] of this.agentMetrics) {
      totalRequests += metrics.requestCount;
      totalErrors += metrics.errorCount;
      totalDuration += metrics.totalDuration;
      
      const agentState = this.registry.getAgentState(agentId);
      if (agentState && agentState.status !== 'offline') {
        activeAgents++;
      }
    }
    
    return {
      totalAgents: this.agentMetrics.size,
      activeAgents,
      totalRequests,
      totalErrors,
      avgResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      systemUptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage?.().heapUsed,
      cpuUsage: process.cpuUsage?.().user,
    };
  }

  getHealthCheck(agentId: string): HealthCheck | undefined {
    return this.healthChecks.get(agentId);
  }

  getAllHealthChecks(): Map<string, HealthCheck> {
    return new Map(this.healthChecks);
  }

  getHealthSummary(): {
    healthy: number;
    degraded: number;
    unhealthy: number;
    checks: HealthCheck[];
  } {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    const checks: HealthCheck[] = [];
    
    for (const healthCheck of this.healthChecks.values()) {
      checks.push(healthCheck);
      switch (healthCheck.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
      }
    }
    
    return { healthy, degraded, unhealthy, checks };
  }

  resetMetrics(agentId?: string): void {
    if (agentId) {
      const metrics = this.agentMetrics.get(agentId);
      if (metrics) {
        metrics.requestCount = 0;
        metrics.successCount = 0;
        metrics.errorCount = 0;
        metrics.totalDuration = 0;
        metrics.avgDuration = 0;
        metrics.errorRate = 0;
        metrics.throughput = 0;
      }
    } else {
      // Reset all metrics
      for (const metrics of this.agentMetrics.values()) {
        metrics.requestCount = 0;
        metrics.successCount = 0;
        metrics.errorCount = 0;
        metrics.totalDuration = 0;
        metrics.avgDuration = 0;
        metrics.errorRate = 0;
        metrics.throughput = 0;
      }
    }
  }
}