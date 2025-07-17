import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { DealAutomationAgent } from '@/lib/agents/deal-automation-agent';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

async function handlePost(request: AuthenticatedRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const body = await request.json();
    const { templateId, customFields } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Initialize agent
    const agent = new DealAutomationAgent({
      name: 'Deal Automation Agent',
      metadata: { userId: request.user?.id }
    });
    await agent.initialize();

    // Create deal from template
    const result = await agent.createDealFromTemplate({
      templateId,
      customFields,
      userId: request.user?.id || ''
    });

    // Log performance metrics
    await supabase
      .from('deal_creation_metrics')
      .insert({
        user_id: request.user?.id,
        deal_id: result.deal.id,
        duration_ms: result.metrics.duration,
        source: 'template',
        template_id: templateId,
        success: true,
        steps: result.metrics.steps,
        created_at: new Date().toISOString()
      });

    // Cleanup
    await agent.shutdown();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating deal from template:', error);
    return NextResponse.json(
      { error: 'Failed to create deal from template' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and API rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'api');