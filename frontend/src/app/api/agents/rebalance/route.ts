import { NextRequest, NextResponse } from 'next/server';
import { workloadBalancer } from '@/lib/agents/workload-balancer';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';

// POST /api/agents/rebalance - Trigger manual workload rebalancing
export const POST = withAuthAndRateLimit(handlePostRebalance, API_SECURITY_TYPES.AI);

async function handlePostRebalance(request: AuthenticatedRequest) {
  try {
    const result = await workloadBalancer.rebalanceWorkload();

    return NextResponse.json({
      success: true,
      result: {
        tasksReassigned: result.tasksReassigned,
        fromAgents: result.fromAgents,
        toAgents: result.toAgents,
        duration: result.duration
      }
    });
  } catch (error) {
    console.error('Error rebalancing workload:', error);
    return NextResponse.json(
      { error: 'Failed to rebalance workload' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/rebalance - Configure auto-rebalancing
export const PUT = withAuthAndRateLimit(handlePutRebalance, API_SECURITY_TYPES.AI);

async function handlePutRebalance(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { enabled, intervalMs = 60000 } = body;

    if (enabled) {
      workloadBalancer.startAutoRebalancing(intervalMs);
      return NextResponse.json({
        success: true,
        message: `Auto-rebalancing started with ${intervalMs}ms interval`
      });
    } else {
      workloadBalancer.stopAutoRebalancing();
      return NextResponse.json({
        success: true,
        message: 'Auto-rebalancing stopped'
      });
    }
  } catch (error) {
    console.error('Error configuring auto-rebalancing:', error);
    return NextResponse.json(
      { error: 'Failed to configure auto-rebalancing' },
      { status: 500 }
    );
  }
}