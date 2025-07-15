import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { DealAutomationAgent } from '@/lib/agents/deal-automation-agent';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email data is required' }, { status: 400 });
    }

    // Initialize agent
    const agent = new DealAutomationAgent({
      name: 'Deal Automation Agent',
      metadata: { userId: session.user.id }
    });
    await agent.initialize();

    // Create deal from email
    const result = await agent.createDealFromEmail({
      email,
      userId: session.user.id
    });

    // Log performance metrics
    await supabase
      .from('deal_creation_metrics')
      .insert({
        user_id: session.user.id,
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