import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getZohoQueue } from '@/lib/zoho/api-queue';
import { queueProcessor } from '@/lib/zoho/queue-processor';

/**
 * GET /api/zoho/queue - Get queue status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get queue status
    const queue = getZohoQueue();
    const status = await queue.getQueueStatus();
    
    // Get queue statistics from database
    const { data: queueStats, error: statsError } = await supabase
      .from('zoho_request_queue')
      .select('status')
      .eq('user_id', user.id);
    
    if (statsError) {
      console.error('Error getting queue stats:', statsError);
    }
    
    // Count by status
    const statusCounts = queueStats?.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Get recent analytics
    const { data: analytics, error: analyticsError } = await supabase
      .from('zoho_queue_analytics')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', new Date().toISOString().split('T')[0])
      .order('hour', { ascending: false })
      .limit(24);
    
    if (analyticsError) {
      console.error('Error getting analytics:', analyticsError);
    }
    
    return NextResponse.json({
      queue: status,
      statistics: statusCounts,
      analytics: analytics || []
    });
    
  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/zoho/queue - Add request to queue
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { endpoint, method, data, priority = 5 } = body;
    
    if (!endpoint || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, method' },
        { status: 400 }
      );
    }
    
    // Get user's Zoho org ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('zoho_org_id')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData?.zoho_org_id) {
      return NextResponse.json(
        { error: 'Zoho CRM not configured for this user' },
        { status: 400 }
      );
    }
    
    // Add to queue
    const queue = getZohoQueue();
    const requestId = await queue.addRequest(
      user.id,
      endpoint,
      method,
      data,
      { priority }
    );
    
    return NextResponse.json({
      success: true,
      requestId,
      message: 'Request queued successfully'
    });
    
  } catch (error) {
    console.error('Queue add error:', error);
    return NextResponse.json(
      { error: 'Failed to queue request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/zoho/queue - Clear queue or cancel specific request
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('id');
    
    if (requestId) {
      // Cancel specific request
      const { error } = await supabase
        .from('zoho_request_queue')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('user_id', user.id)
        .eq('status', 'pending');
      
      if (error) {
        return NextResponse.json(
          { error: 'Failed to cancel request' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Request cancelled'
      });
    } else {
      // Clear all pending requests for user
      const { error } = await supabase
        .from('zoho_request_queue')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'pending');
      
      if (error) {
        return NextResponse.json(
          { error: 'Failed to clear queue' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Queue cleared'
      });
    }
    
  } catch (error) {
    console.error('Queue delete error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}