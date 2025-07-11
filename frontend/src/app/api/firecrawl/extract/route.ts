import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getFirecrawlService } from '@/lib/services/firecrawl';
import { ExtractOptions } from '@/types/firecrawl';

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
    const { urls, options } = body as { urls: string[]; options?: ExtractOptions };

    // Input validation
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (urls.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 URLs allowed per extraction' },
        { status: 400 }
      );
    }

    // Validate each URL
    for (const url of urls) {
      if (typeof url !== 'string') {
        return NextResponse.json(
          { error: 'All URLs must be strings' },
          { status: 400 }
        );
      }
      
      try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return NextResponse.json(
          { error: `Invalid URL format: ${url}` },
          { status: 400 }
        );
      }
    }

    // Validate schema if provided
    if (options?.schema && typeof options.schema !== 'object') {
      return NextResponse.json(
        { error: 'Schema must be a valid object' },
        { status: 400 }
      );
    }

    // Get Firecrawl service
    const firecrawlService = getFirecrawlService();

    // Execute extraction
    const extractedData = await firecrawlService.extract(urls, options);

    // Log the action for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: 'firecrawl_extract',
      metadata: {
        urls,
        options,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: extractedData
    });
  } catch (error) {
    console.error('Firecrawl extract error:', error);
    
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

// GET endpoint to check API status
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'Firecrawl Extract API endpoint is active',
    methods: ['POST'],
    description: 'Extract structured data from multiple URLs',
    limits: {
      maxUrls: 10,
      schemaRequired: false
    }
  });
}