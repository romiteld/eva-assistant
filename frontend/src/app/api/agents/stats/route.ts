import { NextRequest, NextResponse } from 'next/server';
import { workloadBalancer } from '@/lib/agents/workload-balancer';
import { createClient } from '@/lib/supabase/server';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';

interface DatabaseTask {
  id: string;
  agent_id: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed';
  actual_duration?: number;
  completed_at?: string;
  created_at: string;
}

interface TaskStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  avgDuration: number;
}

// GET /api/agents/stats - Get workload statistics
export const GET = withAuthAndRateLimit(handleGetStats, API_SECURITY_TYPES.API);

async function handleGetStats(request: AuthenticatedRequest) {
  try {
    const supabaseAdmin = await createClient(true);
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '1h';
    const agentId = searchParams.get('agentId');

    // Get overall workload stats
    const stats = await workloadBalancer.getWorkloadStats();

    // Get time-based metrics
    let timeFilter = new Date();
    switch (timeRange) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setHours(timeFilter.getHours() - 24);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
    }

    // Build metrics query
    let metricsQuery = supabaseAdmin
      .from('agent_metrics')
      .select('*')
      .gte('timestamp', timeFilter.toISOString())
      .order('timestamp', { ascending: true });

    if (agentId) {
      metricsQuery = metricsQuery.eq('agent_id', agentId);
    }

    const { data: metrics, error: metricsError } = await metricsQuery;

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError);
    }

    // Get task completion stats
    let tasksQuery = supabaseAdmin
      .from('agent_tasks')
      .select('status, agent_id, actual_duration, completed_at')
      .gte('created_at', timeFilter.toISOString());

    if (agentId) {
      tasksQuery = tasksQuery.eq('agent_id', agentId);
    }

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    }

    // Calculate task statistics
    const typedTasks = (tasks || []) as DatabaseTask[];
    const tasksWithDuration = typedTasks.filter(t => 
      t.actual_duration && 
      typeof t.actual_duration === 'number' && 
      !isNaN(t.actual_duration)
    );
    
    const avgDuration = tasksWithDuration.length > 0
      ? tasksWithDuration.reduce((sum, task) => sum + (task.actual_duration ?? 0), 0) / tasksWithDuration.length
      : 0;
    
    const taskStats: TaskStats = {
      total: typedTasks.length,
      completed: typedTasks.filter(t => t.status === 'completed').length,
      failed: typedTasks.filter(t => t.status === 'failed').length,
      inProgress: typedTasks.filter(t => t.status === 'in_progress').length,
      avgDuration: isNaN(avgDuration) ? 0 : Math.round(avgDuration * 100) / 100
    };

    return NextResponse.json({
      currentStats: stats,
      taskStats,
      metrics: metrics || [],
      timeRange
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/agents/stats/metrics - Configure metrics collection
export const POST = withAuthAndRateLimit(handlePostStats, API_SECURITY_TYPES.API);

async function handlePostStats(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { enabled, intervalMs = 300000 } = body; // Default 5 minutes

    if (enabled) {
      workloadBalancer.startMetricsCollection(intervalMs);
      return NextResponse.json({
        success: true,
        message: `Metrics collection started with ${intervalMs}ms interval`
      });
    } else {
      workloadBalancer.stopMetricsCollection();
      return NextResponse.json({
        success: true,
        message: 'Metrics collection stopped'
      });
    }
  } catch (error) {
    console.error('Error configuring metrics collection:', error);
    return NextResponse.json(
      { error: 'Failed to configure metrics collection' },
      { status: 500 }
    );
  }
}