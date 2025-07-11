import { NextRequest, NextResponse } from 'next/server';
import { workloadBalancer } from '@/lib/agents/workload-balancer';

// POST /api/agents/rebalance - Trigger manual workload rebalancing
export async function POST(request: NextRequest) {
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
export async function PUT(request: NextRequest) {
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