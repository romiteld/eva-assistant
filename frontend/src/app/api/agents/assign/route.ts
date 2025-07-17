import { NextRequest, NextResponse } from 'next/server';
import { workloadBalancer, WorkloadTask, BalancingStrategy } from '@/lib/agents/workload-balancer';
import { createClient } from '@/lib/supabase/server';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';

// POST /api/agents/assign - Assign a task to an agent
export const POST = withAuthAndRateLimit(handlePostAssign, API_SECURITY_TYPES.AI);

async function handlePostAssign(request: AuthenticatedRequest) {
  try {
    const supabaseAdmin = await createClient(true);
    const body = await request.json();
    const { task, strategy } = body;

    if (!task || !task.id || !task.type) {
      return NextResponse.json(
        { error: 'Valid task with id and type is required' },
        { status: 400 }
      );
    }

    // Create workload task
    const workloadTask: WorkloadTask = {
      id: task.id,
      type: task.type,
      priority: task.priority || 0.5,
      estimatedDuration: task.estimatedDuration,
      requiredCapabilities: task.requiredCapabilities,
      data: task.data || {}
    };

    // Set strategy if provided
    if (strategy && Object.values(BalancingStrategy).includes(strategy)) {
      (workloadBalancer as any).strategy = strategy;
    }

    // Assign task
    const result = await workloadBalancer.assignTask(workloadTask);

    if (!result.success) {
      return NextResponse.json(
        { error: result.reason || 'Failed to assign task' },
        { status: 400 }
      );
    }

    // Get assigned agent details
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('id, name, type, current_load')
      .eq('id', result.agentId)
      .single();

    return NextResponse.json({
      success: true,
      assignment: {
        taskId: result.taskId,
        agentId: result.agentId,
        agent: agent
      }
    });
  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/agents/assign/batch - Assign multiple tasks
export const PUT = withAuthAndRateLimit(handlePutAssign, API_SECURITY_TYPES.AI);

async function handlePutAssign(request: AuthenticatedRequest) {
  try {
    const supabaseAdmin = await createClient(true);
    const body = await request.json();
    const { tasks, strategy } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: 'Array of tasks is required' },
        { status: 400 }
      );
    }

    // Validate tasks
    const workloadTasks: WorkloadTask[] = tasks.map(task => ({
      id: task.id,
      type: task.type,
      priority: task.priority || 0.5,
      estimatedDuration: task.estimatedDuration,
      requiredCapabilities: task.requiredCapabilities,
      data: task.data || {}
    }));

    // Set strategy if provided
    if (strategy && Object.values(BalancingStrategy).includes(strategy)) {
      (workloadBalancer as any).strategy = strategy;
    }

    // Assign tasks
    const results = await workloadBalancer.assignTasks(workloadTasks);

    // Get assignment details
    const assignments = await Promise.all(
      results
        .filter(r => r.success && r.agentId)
        .map(async (result) => {
          const { data: agent } = await supabaseAdmin
            .from('agents')
            .select('id, name, type')
            .eq('id', result.agentId)
            .single();
          
          return {
            taskId: result.taskId,
            agentId: result.agentId,
            agent
          };
        })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: tasks.length,
        assigned: successCount,
        failed: failureCount
      },
      assignments,
      failures: results.filter(r => !r.success)
    });
  } catch (error) {
    console.error('Error batch assigning tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}