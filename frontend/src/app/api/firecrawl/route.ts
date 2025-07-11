import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import FirecrawlApp from '@mendable/firecrawl-js';
import { cookies } from 'next/headers';

// Rate limiting configuration
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;
  return token === cookieToken && !!token;
}

// Rate limiting middleware
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);

  if (!userLimit || now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Get Firecrawl client (server-side only)
function getFirecrawlClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }
  return new FirecrawlApp({ apiKey });
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

    // Rate limiting
    const rateLimitKey = session.user.id;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, ...params } = body;

    // Validate action
    const allowedActions = ['scrape', 'crawl', 'map', 'extract', 'search'];
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Input validation
    if (action === 'scrape' && (!params.url || typeof params.url !== 'string')) {
      return NextResponse.json(
        { error: 'URL is required for scraping' },
        { status: 400 }
      );
    }

    // Get Firecrawl client
    const firecrawl = getFirecrawlClient();

    // Execute the requested action
    let result;
    switch (action) {
      case 'scrape':
        result = await firecrawl.scrapeUrl(params.url, {
          formats: params.formats || ['markdown', 'html'],
          onlyMainContent: params.onlyMainContent ?? true,
          includeTags: params.includeTags,
          excludeTags: params.excludeTags,
          waitFor: params.waitFor,
        });
        break;

      case 'crawl':
        result = await firecrawl.crawlUrl(params.url, {
          limit: Math.min(params.limit || 10, 50), // Cap at 50 pages
          scrapeOptions: params.scrapeOptions,
          // @ts-ignore - allowedDomains is not in the type definition yet
          excludePaths: params.excludePaths,
          maxDepth: Math.min(params.maxDepth || 3, 5), // Cap depth at 5
        });
        break;

      case 'map':
        result = await firecrawl.mapUrl(params.url, {
          search: params.search,
          limit: Math.min(params.limit || 100, 500), // Cap at 500 links
        });
        break;

      case 'extract':
        result = await firecrawl.extract(params.urls, {
          schema: params.schema,
          prompt: params.prompt || 'Extract the following information from the webpage',
        });
        break;

      case 'search':
        result = await firecrawl.search(params.query, {
          limit: Math.min(params.limit || 5, 20), // Cap at 20 results
          scrapeOptions: params.scrapeOptions,
        });
        break;

      default:
        throw new Error('Invalid action');
    }

    // Log the action for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: `firecrawl_${action}`,
      metadata: {
        url: params.url,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Firecrawl API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'Firecrawl API endpoint is active' });
}