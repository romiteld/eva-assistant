import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getFirecrawlService } from '@/lib/services/firecrawl';
import { ScrapeOptions } from '@/types/firecrawl';
import { rateLimiters, withRateLimit } from '@/lib/middleware/rate-limit';
import { caches, createCacheKey } from '@/lib/services/cache';

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;
  return token === cookieToken && !!token;
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return withRateLimit(request, rateLimiters.firecrawl, async () => {
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
    const { url, options } = body as { url: string; options?: ScrapeOptions };

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

    // Check cache first
    const cacheKey = createCacheKey({ url, options });
    const cached = await caches.firecrawlScrape.getOrFetch(
      cacheKey,
      async () => {
        // Get Firecrawl service
        const firecrawlService = getFirecrawlService();

        // Execute scrape
        return await firecrawlService.scrapeUrl(url, options);
      },
      {
        staleWhileRevalidate: true,
        ttl: 5 * 60 * 1000, // 5 minutes
      }
    );

    const result = cached;

    // Log the action for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: 'firecrawl_scrape',
      metadata: {
        url,
        options,
        timestamp: new Date().toISOString(),
      },
    });

      return NextResponse.json({ 
        success: true, 
        data: result 
      });
    } catch (error) {
      console.error('Firecrawl scrape error:', error);
      
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
  });
}

// GET endpoint to check API status
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'Firecrawl Scrape API endpoint is active',
    methods: ['POST']
  });
}