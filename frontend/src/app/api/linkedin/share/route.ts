import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { shareOnLinkedIn } from '@/lib/auth/linkedin-oauth';

async function handlePost(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.id;
    const body = await request.json();
    const { content } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!content || !content.text) {
      return NextResponse.json({ error: 'Content text is required' }, { status: 400 });
    }

    // Get LinkedIn integration
    const supabase = createClient();
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ 
        error: 'LinkedIn integration not found' 
      }, { status: 404 });
    }

    // Check if token is expired
    const now = Date.now();
    if (integration.expires_at && integration.expires_at < now) {
      return NextResponse.json({ 
        error: 'LinkedIn token expired' 
      }, { status: 401 });
    }

    // Share content on LinkedIn
    const shareResult = await shareOnLinkedIn(integration.access_token, content);

    // Log the sharing activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action: 'linkedin_content_shared',
        metadata: {
          postId: shareResult.id,
          contentText: content.text,
          contentUrl: content.url,
          contentTitle: content.title,
          timestamp: new Date().toISOString(),
        },
      });

    return NextResponse.json({
      success: true,
      shareResult,
      message: 'Content shared successfully on LinkedIn',
    });

  } catch (error: any) {
    console.error('LinkedIn content sharing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to share content on LinkedIn' },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndRateLimit(handlePost, 'api');