import { NextRequest, NextResponse } from 'next/server';
import { AgentRegistry } from '@/lib/agents/base/AgentRegistry';
import { AgentMonitor } from '@/lib/agents/monitoring/AgentMonitor';
import { AgentLogger } from '@/lib/agents/monitoring/AgentLogger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';

// GET /api/agents - List all agents and their status
export const GET = withAuthAndRateLimit(handleGetAgents, API_SECURITY_TYPES.API);

async function handleGetAgents(request: AuthenticatedRequest) {
  try {
    const registry = AgentRegistry.getInstance();
    const monitor = AgentMonitor.getInstance();
    
    const agents = registry.getAllAgents().map(agent => ({
      id: agent.getId(),
      name: agent.getName(),
      type: agent.getType(),
      status: agent.getStatus(),
      state: registry.getAgentState(agent.getId()),
      capabilities: registry.getAgentCapabilities(agent.getId()),
      metrics: monitor.getAgentMetrics(agent.getId()),
      health: monitor.getHealthCheck(agent.getId()),
    }));
    
    return NextResponse.json({
      agents,
      stats: registry.getStats(),
      systemMetrics: monitor.getSystemMetrics(),
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents/:agentId/execute - Execute an action on an agent
export const POST = withAuthAndRateLimit(handlePostAgent, API_SECURITY_TYPES.AI);

async function handlePostAgent(request: AuthenticatedRequest) {
  try {
    const { agentId, action, payload } = await request.json();
    
    if (!agentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, action' },
        { status: 400 }
      );
    }
    
    const registry = AgentRegistry.getInstance();
    const agent = registry.getAgent(agentId);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Check if agent has the capability
    const capabilities = registry.getAgentCapabilities(agentId);
    if (!capabilities?.actions[action]) {
      return NextResponse.json(
        { error: `Agent does not have capability: ${action}` },
        { status: 400 }
      );
    }
    
    // Execute the action
    const result = await agent.sendRequest(agentId, action, payload);
    
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error executing agent action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}