import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getFirecrawlService } from '@/lib/services/firecrawl';
import { SearchOptions } from '@/types/firecrawl';

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
    const { query, options } = body as { query: string; options?: SearchOptions };

    // Input validation
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters long' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query must not exceed 500 characters' },
        { status: 400 }
      );
    }

    // Validate search options
    if (options?.limit && (options.limit < 1 || options.limit > 20)) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Get Firecrawl service
    const firecrawlService = getFirecrawlService();

    // Execute search
    const results = await firecrawlService.search(query, options);

    // Log the action for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: 'firecrawl_search',
      metadata: {
        query,
        options,
        resultCount: results.length,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        results,
        count: results.length,
        query
      }
    });
  } catch (error) {
    console.error('Firecrawl search error:', error);
    
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
    status: 'Firecrawl Search API endpoint is active',
    methods: ['POST'],
    description: 'Search the web with optional content scraping'
  });
}