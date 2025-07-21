// Agent Workload Balancing System
import { supabase } from '@/lib/supabase/browser';
import { EventEmitter } from 'events';

export interface WorkloadTask {
  id: string;
  type: string;
  priority: number; // 0-1
  estimatedDuration?: number; // milliseconds
  requiredCapabilities?: string[];
  data: Record<string, unknown>;
}

export interface DatabaseAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  current_load: number;
  current_tasks: number;
  max_concurrent_tasks: number;
  success_rate: number;
  capabilities?: string[];
  specializations?: string[];
  health_status: string;
}

export interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime?: number;
  errorRate?: number;
}

export interface WorkloadStatsData {
  totalAgents: number;
  availableAgents: number;
  averageLoad: number;
  totalActiveTasks: number;
  agentDetails: DatabaseAgent[];
}

export interface AgentWorkloadInfo {
  id: string;
  name: string;
  type: string;
  status: 'available' | 'busy' | 'offline' | 'overloaded';
  currentLoad: number; // percentage
  currentTasks: number;
  maxConcurrentTasks: number;
  successRate: number;
  capabilities: string[];
  specializations: string[];
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface AssignmentResult {
  success: boolean;
  agentId?: string;
  taskId?: string;
  reason?: string;
}

export interface RebalanceResult {
  tasksReassigned: number;
  fromAgents: string[];
  toAgents: string[];
  duration: number; // milliseconds
}

// Workload balancing strategies
export enum BalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  CAPABILITY_MATCH = 'capability_match',
  PERFORMANCE_BASED = 'performance_based',
  HYBRID = 'hybrid'
}

export class WorkloadBalancer extends EventEmitter {
  private strategy: BalancingStrategy;
  private rebalanceInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(strategy: BalancingStrategy = BalancingStrategy.HYBRID) {
    super();
    this.strategy = strategy;
  }

  // Get available agents sorted by workload score
  async getAvailableAgents(taskType?: string, requiredCapabilities?: string[]): Promise<AgentWorkloadInfo[]> {
    try {
      // Build query
      let query = supabase
        .from('agents')
        .select('*')
        .neq('status', 'offline')
        .lt('current_load', 90); // Not overloaded

      // Filter by capabilities if required
      if (requiredCapabilities && requiredCapabilities.length > 0) {
        query = query.contains('capabilities', requiredCapabilities);
      }

      const { data: agents, error } = await query;
      if (error) throw error;

      // Calculate scores and sort
      const scoredAgents = await Promise.all(
        agents.map(async (agent) => {
          const score = await this.calculateAgentScore(agent, taskType, requiredCapabilities);
          return { ...agent, score };
        })
      );

      // Sort by score (higher is better)
      return scoredAgents
        .sort((a, b) => b.score - a.score)
        .map(({ score, ...agent }) => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          currentLoad: agent.current_load,
          currentTasks: agent.current_tasks,
          maxConcurrentTasks: agent.max_concurrent_tasks,
          successRate: agent.success_rate,
          capabilities: agent.capabilities || [],
          specializations: agent.specializations || [],
          healthStatus: agent.health_status
        }));
    } catch (error) {
      console.error('Error getting available agents:', error);
      throw error;
    }
  }

  // Calculate agent score based on strategy
  private async calculateAgentScore(
    agent: DatabaseAgent,
    taskType?: string,
    requiredCapabilities?: string[]
  ): Promise<number> {
    switch (this.strategy) {
      case BalancingStrategy.ROUND_ROBIN:
        // Simple sequential scoring
        return 100 - agent.current_load;

      case BalancingStrategy.LEAST_LOADED:
        // Pure load-based scoring
        return 100 - agent.current_load;

      case BalancingStrategy.CAPABILITY_MATCH:
        // Capability-focused scoring
        let capScore = 50 - (agent.current_load / 2);
        if (requiredCapabilities) {
          const matchCount = requiredCapabilities.filter(cap => 
            agent.capabilities?.includes(cap)
          ).length;
          capScore += (matchCount * 10);
        }
        if (taskType && agent.specializations?.includes(taskType)) {
          capScore += 20;
        }
        return capScore;

      case BalancingStrategy.PERFORMANCE_BASED:
        // Performance-focused scoring
        const perfScore = (agent.success_rate || 100) * 0.6 +
                         (100 - agent.current_load) * 0.4;
        return perfScore;

      case BalancingStrategy.HYBRID:
      default:
        // Call database function for complex scoring
        const { data, error } = await supabase.rpc('calculate_agent_score', {
          p_agent_id: agent.id,
          p_task_type: taskType || '',
          p_required_capabilities: requiredCapabilities || []
        }) as { data: number | null; error: any };
        
        if (error) {
          console.error('Error calculating agent score:', error);
          return 0;
        }
        
        return data ?? 0;
    }
  }

  // Assign a task to the best available agent
  async assignTask(task: WorkloadTask): Promise<AssignmentResult> {
    try {
      // Get available agents
      const agents = await this.getAvailableAgents(
        task.type,
        task.requiredCapabilities
      );

      if (agents.length === 0) {
        return {
          success: false,
          reason: 'No available agents found'
        };
      }

      // Select best agent (first in sorted list)
      const selectedAgent = agents[0];

      // Create task assignment
      const { data: assignment, error } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: selectedAgent.id,
          task_id: task.id,
          task_type: task.type,
          priority: task.priority,
          estimated_duration: task.estimatedDuration,
          status: 'assigned'
        })
        .select()
        .single();

      if (error) throw error;

      // Emit assignment event
      this.emit('task:assigned', {
        taskId: task.id,
        agentId: selectedAgent.id,
        agentName: selectedAgent.name
      });

      return {
        success: true,
        agentId: selectedAgent.id,
        taskId: assignment.id
      };
    } catch (error) {
      console.error('Error assigning task:', error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Batch assign multiple tasks
  async assignTasks(tasks: WorkloadTask[]): Promise<AssignmentResult[]> {
    // Sort tasks by priority (higher first)
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);
    
    const results: AssignmentResult[] = [];
    
    for (const task of sortedTasks) {
      const result = await this.assignTask(task);
      results.push(result);
      
      // Small delay to allow load updates
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  // Rebalance workload across agents
  async rebalanceWorkload(): Promise<RebalanceResult> {
    const startTime = Date.now();
    const result: RebalanceResult = {
      tasksReassigned: 0,
      fromAgents: [],
      toAgents: [],
      duration: 0
    };

    try {
      // Get all agents with their current workload
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .neq('status', 'offline')
        .order('current_load', { ascending: false });

      if (agentsError) throw agentsError;

      // Calculate average load
      const totalLoad = agents.reduce((sum, agent) => sum + agent.current_load, 0);
      const avgLoad = totalLoad / agents.length;

      // Identify overloaded and underloaded agents
      const overloadedAgents = agents.filter(a => a.current_load > avgLoad + 20);
      const underloadedAgents = agents.filter(a => a.current_load < avgLoad - 20);

      // Rebalance tasks from overloaded to underloaded agents
      for (const overloaded of overloadedAgents) {
        // Get reassignable tasks
        const { data: tasks, error: tasksError } = await supabase
          .from('agent_tasks')
          .select('*')
          .eq('agent_id', overloaded.id)
          .eq('status', 'assigned') // Only reassign not-yet-started tasks
          .order('priority', { ascending: true }) // Move low priority tasks first
          .limit(Math.ceil((overloaded.current_load - avgLoad) / 20));

        if (tasksError) continue;

        for (const task of tasks || []) {
          // Find best underloaded agent
          const targetAgent = underloadedAgents
            .sort((a, b) => a.current_load - b.current_load)[0];

          if (!targetAgent || targetAgent.current_load >= avgLoad) break;

          // Reassign task
          const { error: updateError } = await supabase
            .from('agent_tasks')
            .update({ agent_id: targetAgent.id })
            .eq('id', task.id);

          if (!updateError) {
            result.tasksReassigned++;
            if (!result.fromAgents.includes(overloaded.id)) {
              result.fromAgents.push(overloaded.id);
            }
            if (!result.toAgents.includes(targetAgent.id)) {
              result.toAgents.push(targetAgent.id);
            }

            // Update local load tracking
            targetAgent.current_load += 20;
            overloaded.current_load -= 20;

            // Emit rebalance event
            this.emit('task:rebalanced', {
              taskId: task.id,
              fromAgentId: overloaded.id,
              toAgentId: targetAgent.id
            });
          }
        }
      }

      result.duration = Date.now() - startTime;
      
      // Emit rebalance complete event
      this.emit('rebalance:complete', result);
      
      return result;
    } catch (error) {
      console.error('Error rebalancing workload:', error);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  // Start automatic rebalancing
  startAutoRebalancing(intervalMs: number = 60000): void {
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval);
    }

    this.rebalanceInterval = setInterval(async () => {
      const result = await this.rebalanceWorkload();
      if (result.tasksReassigned > 0) {
        console.log(`Rebalanced ${result.tasksReassigned} tasks in ${result.duration}ms`);
      }
    }, intervalMs);

    this.emit('rebalancing:started');
  }

  // Stop automatic rebalancing
  stopAutoRebalancing(): void {
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval);
      this.rebalanceInterval = null;
      this.emit('rebalancing:stopped');
    }
  }

  // Collect and store agent metrics
  async collectMetrics(): Promise<void> {
    try {
      const { data: agents, error } = await supabase
        .from('agents')
        .select('*');

      if (error) throw error;

      // Prepare metrics data
      const metrics = agents.map((agent: DatabaseAgent & {
        total_tasks_completed?: number;
        total_tasks_failed?: number;
        cpu_usage?: number;
        memory_usage?: number;
        average_task_duration?: number;
      }) => ({
        agent_id: agent.id,
        load_percentage: agent.current_load,
        active_tasks: agent.current_tasks,
        completed_tasks: (agent as any).total_tasks_completed || 0,
        failed_tasks: (agent as any).total_tasks_failed || 0,
        cpu_usage: (agent as any).cpu_usage || 0,
        memory_usage: (agent as any).memory_usage || 0,
        average_response_time: (agent as any).average_task_duration || 0,
        success_rate: agent.success_rate
      }));

      // Insert metrics
      const { error: insertError } = await supabase
        .from('agent_metrics')
        .insert(metrics);

      if (insertError) throw insertError;

      this.emit('metrics:collected', metrics);
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  // Start metrics collection
  startMetricsCollection(intervalMs: number = 300000): void { // 5 minutes
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Collect immediately
    this.collectMetrics();

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    this.emit('metrics:started');
  }

  // Stop metrics collection
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      this.emit('metrics:stopped');
    }
  }

  // Get workload statistics
  async getWorkloadStats(): Promise<WorkloadStatsData> {
    try {
      const { data, error } = await supabase
        .from('agent_workload_summary')
        .select('*');

      if (error) throw error;

      // Calculate aggregate stats
      const totalAgents = data?.length || 0;
      const availableAgents = data?.filter((a: any) => a.status === 'available').length || 0;
      const avgLoad = totalAgents > 0 ? 
        data.reduce((sum: number, a: any) => sum + (a.current_load || 0), 0) / totalAgents : 0;
      const totalTasks = data?.reduce((sum: number, a: any) => sum + (a.current_tasks || 0), 0) || 0;

      return {
        totalAgents,
        availableAgents,
        averageLoad: isNaN(avgLoad) ? 0 : Math.round(avgLoad * 100) / 100,
        totalActiveTasks: totalTasks,
        agentDetails: (data || []) as DatabaseAgent[]
      };
    } catch (error) {
      console.error('Error getting workload stats:', error);
      throw error;
    }
  }

  // Update agent health status
  async updateAgentHealth(agentId: string, health: HealthMetrics): Promise<void> {
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          cpu_usage: health.cpuUsage,
          memory_usage: health.memoryUsage,
          health_status: this.determineHealthStatus(health),
          last_health_check: new Date().toISOString()
        })
        .eq('id', agentId);

      if (error) throw error;

      this.emit('agent:health-updated', { agentId, health });
    } catch (error) {
      console.error('Error updating agent health:', error);
    }
  }

  // Determine health status based on metrics
  private determineHealthStatus(health: HealthMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    if (health.cpuUsage > 90 || health.memoryUsage > 90) {
      return 'unhealthy';
    } else if (health.cpuUsage > 70 || health.memoryUsage > 70) {
      return 'degraded';
    }
    return 'healthy';
  }

  // Clean up resources
  destroy(): void {
    this.stopAutoRebalancing();
    this.stopMetricsCollection();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const workloadBalancer = new WorkloadBalancer();