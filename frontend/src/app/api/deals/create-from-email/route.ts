import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { DealAutomationAgent } from '@/lib/agents/deal-automation-agent';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

// API route configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

async function handlePost(request: AuthenticatedRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email data is required' }, { status: 400 });
    }

    // Initialize agent
    const agent = new DealAutomationAgent({
      name: 'Deal Automation Agent',
      metadata: { userId: request.user?.id }
    });
    await agent.initialize();

    // Create deal from email
    const result = await agent.createDealFromEmail({
      email,
      userId: request.user?.id || ''
    });

    // Log performance metrics
    await supabase
      .from('deal_creation_metrics')
      .insert({
        user_id: request.user?.id,
        deal_id: result.deal.id,
        duration_ms: result.metrics.duration,
        source: 'email',
        success: true,
        steps: result.metrics.steps,
        created_at: new Date().toISOString()
      });

    // Cleanup
    await agent.shutdown();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating deal from email:', error);
    return NextResponse.json(
      { error: 'Failed to create deal from email' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and AI rate limiting
export async function POST(request: NextRequest) {
  try {
    return await withAuthAndRateLimit(handlePost, 'ai')(request);
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}