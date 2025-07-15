import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '7d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Fetch metrics
    const { data: metrics, error } = await supabase
      .from('deal_creation_metrics')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Calculate aggregated metrics
    const totalDeals = metrics.length;
    const successfulDeals = metrics.filter(m => m.success).length;
    const averageDuration = metrics.reduce((sum, m) => sum + m.duration_ms, 0) / totalDeals || 0;
    
    // Group by source
    const bySource = metrics.reduce((acc, m) => {
      if (!acc[m.source]) {
        acc[m.source] = { count: 0, totalDuration: 0 };
      }
      acc[m.source].count++;
      acc[m.source].totalDuration += m.duration_ms;
      return acc;
    }, {} as Record<string, { count: number; totalDuration: number }>);

    // Calculate source metrics
    const sourceMetrics = Object.entries(bySource as Record<string, { count: number; totalDuration: number }>).reduce((acc, [source, data]) => {
      acc[source] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count
      };
      return acc;
    }, {} as Record<string, { count: number; avgDuration: number }>);

    // Get recent deals
    const recentDeals = metrics.slice(0, 10).map(m => ({
      dealId: m.deal_id,
      duration: m.duration_ms,
      source: m.source,
      createdAt: m.created_at,
      success: m.success
    }));

    // Performance trend (hourly for 24h, daily for others)
    const trendData = timeRange === '24h' 
      ? calculateHourlyTrend(metrics)
      : calculateDailyTrend(metrics);

    return NextResponse.json({
      summary: {
        totalDeals,
        successRate: (successfulDeals / totalDeals) * 100,
        averageDuration,
        under30s: metrics.filter(m => m.duration_ms < 30000).length,
        timeRange
      },
      bySource: sourceMetrics,
      recentDeals,
      trend: trendData
    });
  } catch (error) {
    console.error('Error fetching deal metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

function calculateHourlyTrend(metrics: any[]) {
  const hourlyData: Record<string, { count: number; avgDuration: number }> = {};
  
  metrics.forEach(m => {
    const hour = new Date(m.created_at).getHours();
    const key = `${hour}:00`;
    
    if (!hourlyData[key]) {
      hourlyData[key] = { count: 0, avgDuration: 0 };
    }
    
    hourlyData[key].count++;
    hourlyData[key].avgDuration = 
      (hourlyData[key].avgDuration * (hourlyData[key].count - 1) + m.duration_ms) / 
      hourlyData[key].count;
  });
  
  return Object.entries(hourlyData).map(([hour, data]) => ({
    period: hour,
    count: data.count,
    avgDuration: data.avgDuration
  }));
}

function calculateDailyTrend(metrics: any[]) {
  const dailyData: Record<string, { count: number; avgDuration: number }> = {};
  
  metrics.forEach(m => {
    const date = new Date(m.created_at).toISOString().split('T')[0];
    
    if (!dailyData[date]) {
      dailyData[date] = { count: 0, avgDuration: 0 };
    }
    
    dailyData[date].count++;
    dailyData[date].avgDuration = 
      (dailyData[date].avgDuration * (dailyData[date].count - 1) + m.duration_ms) / 
      dailyData[date].count;
  });
  
  return Object.entries(dailyData).map(([date, data]) => ({
    period: date,
    count: data.count,
    avgDuration: data.avgDuration
  }));
}