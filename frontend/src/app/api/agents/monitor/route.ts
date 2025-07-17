import { NextRequest, NextResponse } from 'next/server';
import { AgentMonitor } from '@/lib/agents/monitoring/AgentMonitor';
import { AgentLogger, LogLevel } from '@/lib/agents/monitoring/AgentLogger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';

// GET /api/agents/monitor - Get monitoring data
export const GET = withAuthAndRateLimit(handleGetMonitor, API_SECURITY_TYPES.API);

async function handleGetMonitor(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const agentId = searchParams.get('agentId');
    
    const monitor = AgentMonitor.getInstance();
    const logger = AgentLogger.getInstance();
    
    switch (type) {
      case 'health':
        if (agentId) {
          const health = monitor.getHealthCheck(agentId);
          return NextResponse.json({ health });
        }
        const healthSummary = monitor.getHealthSummary();
        return NextResponse.json(healthSummary);
        
      case 'metrics':
        if (agentId) {
          const metrics = monitor.getAgentMetrics(agentId);
          return NextResponse.json({ metrics });
        }
        const allMetrics = monitor.getAllAgentMetrics();
        const systemMetrics = monitor.getSystemMetrics();
        return NextResponse.json({
          agents: Object.fromEntries(allMetrics),
          system: systemMetrics,
        });
        
      case 'logs':
        const level = searchParams.get('level');
        const category = searchParams.get('category');
        const limit = searchParams.get('limit');
        
        const logs = logger.getLogs({
          agentId: agentId ?? undefined,
          category: category ?? undefined,
          level: level ? parseInt(level) as LogLevel : undefined,
          limit: limit ? parseInt(limit) : 100,
        });
        
        return NextResponse.json({ logs });
        
      case 'stats':
        const logStats = logger.getLogStats();
        const systemMetricsStats = monitor.getSystemMetrics();
        const healthSummaryStats = monitor.getHealthSummary();
        
        return NextResponse.json({
          logs: logStats,
          system: systemMetricsStats,
          health: healthSummaryStats,
        });
        
      default:
        return NextResponse.json({
          health: monitor.getHealthSummary(),
          metrics: monitor.getSystemMetrics(),
          logs: logger.getLogStats(),
        });
    }
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

// POST /api/agents/monitor/logs - Search logs
export const POST = withAuthAndRateLimit(handlePostMonitor, API_SECURITY_TYPES.API);

async function handlePostMonitor(request: AuthenticatedRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const logger = AgentLogger.getInstance();
    const results = logger.searchLogs(query);
    
    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error searching logs:', error);
    return NextResponse.json(
      { error: 'Failed to search logs' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/monitor/config - Update monitoring configuration
export const PUT = withAuthAndRateLimit(handlePutMonitor, API_SECURITY_TYPES.API);

async function handlePutMonitor(request: AuthenticatedRequest) {
  try {
    const { logLevel, config } = await request.json();
    
    const logger = AgentLogger.getInstance();
    
    if (logLevel !== undefined) {
      logger.setLogLevel(logLevel);
    }
    
    if (config) {
      logger.setConfig(config);
    }
    
    return NextResponse.json({
      success: true,
      currentConfig: logger.getConfig(),
    });
  } catch (error) {
    console.error('Error updating monitoring config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}