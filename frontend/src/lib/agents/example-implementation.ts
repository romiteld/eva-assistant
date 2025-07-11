// Example implementation of the Agent Workload Balancing System
import { workloadBalancer, WorkloadTask, BalancingStrategy } from './workload-balancer';
import { AgentRegistry } from './a2a-orchestrator';
import { supabase } from '@/lib/supabase/browser';

// Example: Register custom agents in the system
export async function setupAgents() {
  try {
    // Create agents in the database
    const agents = [
      {
        name: 'Web Scraper Alpha',
        type: 'firecrawl',
        max_concurrent_tasks: 10,
        capabilities: ['scrape', 'crawl', 'search'],
        specializations: ['e-commerce', 'news'],
        priority: 8
      },
      {
        name: 'AI Analyst Beta',
        type: 'gemini',
        max_concurrent_tasks: 5,
        capabilities: ['analyze', 'summarize', 'classify'],
        specializations: ['sentiment', 'content-analysis'],
        priority: 7
      },
      {
        name: 'Data Processor Gamma',
        type: 'rag',
        max_concurrent_tasks: 8,
        capabilities: ['query', 'index', 'search'],
        specializations: ['document-processing'],
        priority: 6
      },
      {
        name: 'General Worker Delta',
        type: 'custom',
        max_concurrent_tasks: 15,
        capabilities: ['general'],
        specializations: [],
        priority: 5
      }
    ];

    for (const agent of agents) {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });

      if (!response.ok) {
        console.error(`Failed to create agent ${agent.name}`);
      }
    }

    console.log('✅ Agents setup completed');
  } catch (error) {
    console.error('Error setting up agents:', error);
  }
}

// Example: Assign a batch of web scraping tasks
export async function assignWebScrapingTasks(urls: string[]) {
  const tasks: WorkloadTask[] = urls.map((url, index) => ({
    id: `scrape-${Date.now()}-${index}`,
    type: 'scrape',
    priority: 0.7,
    estimatedDuration: 5000, // 5 seconds
    requiredCapabilities: ['scrape'],
    data: { url, options: { waitFor: 2000 } }
  }));

  // Use capability-based strategy for specialized tasks
  const balancer = new (workloadBalancer.constructor as any)(BalancingStrategy.CAPABILITY_MATCH);
  const results = await balancer.assignTasks(tasks);

  console.log('Scraping tasks assignment results:', {
    total: tasks.length,
    assigned: results.filter((r: any) => r.success).length,
    failed: results.filter((r: any) => !r.success).length
  });

  return results;
}

// Example: Complex workflow with dependencies
export async function executeComplexWorkflow(searchQuery: string) {
  const workflowTasks: WorkloadTask[] = [
    // Step 1: Search for content
    {
      id: 'search-1',
      type: 'search',
      priority: 0.9,
      estimatedDuration: 3000,
      requiredCapabilities: ['search'],
      data: { query: searchQuery }
    },
    // Step 2: Scrape top results (will be assigned after search completes)
    {
      id: 'scrape-results',
      type: 'scrape',
      priority: 0.8,
      estimatedDuration: 10000,
      requiredCapabilities: ['scrape'],
      data: { urls: [] } // Will be populated from search results
    },
    // Step 3: Analyze scraped content
    {
      id: 'analyze-content',
      type: 'analyze',
      priority: 0.7,
      estimatedDuration: 5000,
      requiredCapabilities: ['analyze'],
      data: { prompt: 'Summarize and extract key insights' }
    }
  ];

  // Execute workflow with automatic task assignment
  console.log('Starting complex workflow...');
  
  // Step 1: Assign search task
  const searchResult = await workloadBalancer.assignTask(workflowTasks[0]);
  console.log('Search task assigned:', searchResult);

  // Wait for search to complete and get results
  // In real implementation, you would monitor task status
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 2: Update scrape task with URLs from search results
  workflowTasks[1].data.urls = ['url1', 'url2', 'url3']; // Example URLs
  const scrapeResult = await workloadBalancer.assignTask(workflowTasks[1]);
  console.log('Scrape task assigned:', scrapeResult);

  // Step 3: Assign analysis task
  const analyzeResult = await workloadBalancer.assignTask(workflowTasks[2]);
  console.log('Analyze task assigned:', analyzeResult);

  return {
    search: searchResult,
    scrape: scrapeResult,
    analyze: analyzeResult
  };
}

// Example: Monitor and rebalance workload
export async function startWorkloadManagement() {
  // Start auto-rebalancing every minute
  workloadBalancer.startAutoRebalancing(60000);
  
  // Start metrics collection every 5 minutes
  workloadBalancer.startMetricsCollection(300000);

  // Listen to workload events
  workloadBalancer.on('task:assigned', (data) => {
    console.log(`✅ Task ${data.taskId} assigned to ${data.agentName}`);
  });

  workloadBalancer.on('task:rebalanced', (data) => {
    console.log(`🔄 Task ${data.taskId} moved from agent ${data.fromAgentId} to ${data.toAgentId}`);
  });

  workloadBalancer.on('rebalance:complete', (result) => {
    console.log(`✨ Rebalancing complete: ${result.tasksReassigned} tasks moved in ${result.duration}ms`);
  });

  workloadBalancer.on('metrics:collected', (metrics) => {
    console.log(`📊 Metrics collected for ${metrics.length} agents`);
  });

  console.log('✅ Workload management started');
}

// Example: Simulate heavy load and test rebalancing
export async function simulateHeavyLoad() {
  console.log('🚀 Starting heavy load simulation...');

  // Generate 100 random tasks
  const tasks: WorkloadTask[] = Array.from({ length: 100 }, (_, i) => ({
    id: `load-test-${i}`,
    type: ['scrape', 'analyze', 'query'][Math.floor(Math.random() * 3)],
    priority: Math.random(),
    estimatedDuration: Math.floor(Math.random() * 10000) + 1000,
    requiredCapabilities: [],
    data: { test: true, index: i }
  }));

  // Assign all tasks
  console.log('Assigning 100 tasks...');
  const results = await workloadBalancer.assignTasks(tasks);

  // Get workload stats
  const stats = await workloadBalancer.getWorkloadStats();
  console.log('Current workload stats:', stats);

  // Trigger manual rebalance after 5 seconds
  setTimeout(async () => {
    console.log('Triggering manual rebalance...');
    const rebalanceResult = await workloadBalancer.rebalanceWorkload();
    console.log('Rebalance result:', rebalanceResult);
  }, 5000);

  return { results, stats };
}

// Example: Health check and monitoring
export async function performHealthCheck() {
  try {
    // Get all agents
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*');

    if (error) throw error;

    // Update health status for each agent
    for (const agent of agents || []) {
      // Simulate health metrics (in real implementation, these would come from actual monitoring)
      const health = {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        responseTime: Math.floor(Math.random() * 1000),
        isResponding: Math.random() > 0.1
      };

      await workloadBalancer.updateAgentHealth(agent.id, health);
    }

    console.log(`✅ Health check completed for ${agents?.length || 0} agents`);
  } catch (error) {
    console.error('Error performing health check:', error);
  }
}

// Example: Generate workload report
export async function generateWorkloadReport(timeRange = '24h') {
  try {
    const response = await fetch(`/api/agents/stats?timeRange=${timeRange}`);
    const data = await response.json();

    const report = {
      summary: {
        totalAgents: data.currentStats.totalAgents,
        availableAgents: data.currentStats.availableAgents,
        averageLoad: `${data.currentStats.averageLoad.toFixed(1)}%`,
        totalActiveTasks: data.currentStats.totalActiveTasks
      },
      taskMetrics: {
        totalTasks: data.taskStats.total,
        completedTasks: data.taskStats.completed,
        failedTasks: data.taskStats.failed,
        inProgressTasks: data.taskStats.inProgress,
        averageDuration: `${(data.taskStats.avgDuration / 1000).toFixed(1)}s`,
        successRate: `${((data.taskStats.completed / data.taskStats.total) * 100).toFixed(1)}%`
      },
      agentPerformance: data.currentStats.agentDetails.map((agent: any) => ({
        name: agent.name,
        load: `${agent.current_load.toFixed(1)}%`,
        tasksCompleted: agent.tasks_last_hour,
        avgResponseTime: agent.avg_duration_last_hour ? `${(agent.avg_duration_last_hour / 1000).toFixed(1)}s` : 'N/A',
        successRate: `${agent.success_rate.toFixed(1)}%`
      }))
    };

    console.log('📊 Workload Report:', report);
    return report;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

// Example: Clean up and shutdown
export async function shutdownWorkloadSystem() {
  console.log('Shutting down workload system...');
  
  // Stop auto-rebalancing
  workloadBalancer.stopAutoRebalancing();
  
  // Stop metrics collection
  workloadBalancer.stopMetricsCollection();
  
  // Clean up event listeners
  workloadBalancer.destroy();
  
  console.log('✅ Workload system shutdown complete');
}

// Export all examples
export const WorkloadExamples = {
  setupAgents,
  assignWebScrapingTasks,
  executeComplexWorkflow,
  startWorkloadManagement,
  simulateHeavyLoad,
  performHealthCheck,
  generateWorkloadReport,
  shutdownWorkloadSystem
};