import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queueProcessor } from '@/lib/zoho/queue-processor';

// Track if processor is running
let isProcessorRunning = false;

/**
 * GET /api/zoho/worker - Get worker status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get worker statistics
    const stats = await queueProcessor.getStatistics();
    
    return NextResponse.json({
      running: isProcessorRunning,
      statistics: stats
    });
    
  } catch (error) {
    console.error('Worker status error:', error);
    return NextResponse.json(
      { error: 'Failed to get worker status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/zoho/worker - Start/stop worker
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication - only allow admin users
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action } = body;
    
    if (action === 'start' && !isProcessorRunning) {
      queueProcessor.start();
      isProcessorRunning = true;
      
      return NextResponse.json({
        success: true,
        message: 'Queue processor started'
      });
      
    } else if (action === 'stop' && isProcessorRunning) {
      queueProcessor.stop();
      isProcessorRunning = false;
      
      return NextResponse.json({
        success: true,
        message: 'Queue processor stopped'
      });
      
    } else {
      return NextResponse.json({
        success: false,
        message: `Processor is already ${isProcessorRunning ? 'running' : 'stopped'}`
      });
    }
    
  } catch (error) {
    console.error('Worker control error:', error);
    return NextResponse.json(
      { error: 'Failed to control worker' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/zoho/worker - Run cleanup
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
    const daysOld = parseInt(searchParams.get('days') || '7');
    
    await queueProcessor.cleanup(daysOld);
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up requests older than ${daysOld} days`
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    );
  }
}

// Auto-start processor in development
if (process.env.NODE_ENV === 'development' && !isProcessorRunning) {
  // Start after a delay to ensure database is ready
  setTimeout(() => {
    console.log('🚀 Auto-starting Zoho queue processor in development');
    queueProcessor.start();
    isProcessorRunning = true;
  }, 5000);
}