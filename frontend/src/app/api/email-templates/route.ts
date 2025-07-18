import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';
import { emailTemplateService, EmailTemplate } from '@/lib/services/email-templates';

async function handleGet(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const tags = searchParams.get('tags')?.split(',');

    const filters: any = {};
    if (category) filters.category = category;
    if (isActive !== null) filters.isActive = isActive === 'true';
    if (tags) filters.tags = tags;

    const templates = await emailTemplateService.getTemplates(filters);
    
    // Calculate stats
    const stats = {
      totalTemplates: templates.length,
      activeTemplates: templates.filter(t => t.is_active).length,
      totalSent: templates.reduce((sum, t) => sum + t.usage_count, 0),
      averageUseCount: templates.length > 0 
        ? Math.round(templates.reduce((sum, t) => sum + t.usage_count, 0) / templates.length)
        : 0
    };

    return NextResponse.json({
      templates,
      stats,
      total: templates.length
    });

  } catch (error: any) {
    console.error('Failed to fetch email templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    
    const template = await emailTemplateService.createTemplate(body);
    
    return NextResponse.json(template, { status: 201 });

  } catch (error: any) {
    console.error('Failed to create email template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create email template' },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndRateLimit(handleGet, 'api');
export const POST = withAuthAndRateLimit(handlePost, 'api');