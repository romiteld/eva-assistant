import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getFirecrawlService } from '@/lib/services/firecrawl';
import { CrawlOptions } from '@/types/firecrawl';

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;
  return token === cookieToken && !!token;
}

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection
    if (!validateCSRFToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Authentication check
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { url, options } = body as { url: string; options?: CrawlOptions };

    // Input validation
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate crawl options
    if (options) {
      if (options.limit && (options.limit < 1 || options.limit > 100)) {
        return NextResponse.json(
          { error: 'Limit must be between 1 and 100' },
          { status: 400 }
        );
      }
      if (options.maxDepth && (options.maxDepth < 1 || options.maxDepth > 10)) {
        return NextResponse.json(
          { error: 'Max depth must be between 1 and 10' },
          { status: 400 }
        );
      }
    }

    // Get Firecrawl service
    const firecrawlService = getFirecrawlService();

    // Execute crawl
    const jobId = await firecrawlService.crawlWebsite(url, options);

    // Log the action for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: 'firecrawl_crawl',
      metadata: {
        url,
        options,
        jobId,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: { jobId }
    });
  } catch (error) {
    console.error('Firecrawl crawl error:', error);
    
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check crawl status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ 
        status: 'Firecrawl Crawl API endpoint is active',
        methods: ['POST', 'GET'],
        usage: 'GET /api/firecrawl/crawl?jobId=<jobId> to check status'
      });
    }

    // Authentication check
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Firecrawl service
    const firecrawlService = getFirecrawlService();

    // Check crawl status
    const status = await firecrawlService.checkCrawlStatus(jobId);

    return NextResponse.json({ 
      success: true, 
      data: status 
    });
  } catch (error) {
    console.error('Firecrawl status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}