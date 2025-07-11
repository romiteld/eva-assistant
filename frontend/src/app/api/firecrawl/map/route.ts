import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getFirecrawlService } from '@/lib/services/firecrawl';
import { MapOptions } from '@/types/firecrawl';

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
    const { url, options } = body as { url: string; options?: MapOptions };

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

    // Validate map options
    if (options?.limit && (options.limit < 1 || options.limit > 5000)) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 5000' },
        { status: 400 }
      );
    }

    // Get Firecrawl service
    const firecrawlService = getFirecrawlService();

    // Execute map
    const urls = await firecrawlService.mapWebsite(url, options);

    // Log the action for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: 'firecrawl_map',
      metadata: {
        url,
        options,
        urlCount: urls.length,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        urls,
        count: urls.length
      }
    });
  } catch (error) {
    console.error('Firecrawl map error:', error);
    
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
    status: 'Firecrawl Map API endpoint is active',
    methods: ['POST'],
    description: 'Map a website to discover all URLs'
  });
}