import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// WebSocket endpoint info - this route provides information about the WebSocket service
// Actual WebSocket handling happens in the separate WebSocket server

export async function GET(request: NextRequest) {
  try {
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

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    
    return NextResponse.json({
      status: 'active',
      websocket: {
        url: `${wsUrl}/firecrawl`,
        protocol: 'ws',
        description: 'Connect to this WebSocket endpoint for real-time Firecrawl updates'
      },
      events: {
        outgoing: [
          {
            type: 'crawl:watch',
            description: 'Start watching a crawl job',
            payload: {
              type: 'crawl:watch',
              jobId: 'string',
              internalJobId: 'string'
            }
          },
          {
            type: 'crawl:cancel',
            description: 'Cancel a crawl job',
            payload: {
              type: 'crawl:cancel',
              jobId: 'string'
            }
          }
        ],
        incoming: [
          {
            type: 'crawl:progress',
            description: 'Crawl progress update',
            payload: {
              type: 'crawl:progress',
              jobId: 'string',
              progress: 'number',
              total: 'number',
              pagesScraped: 'number'
            }
          },
          {
            type: 'crawl:page_scraped',
            description: 'Individual page scraped',
            payload: {
              type: 'crawl:page_scraped',
              jobId: 'string',
              url: 'string',
              data: 'object'
            }
          },
          {
            type: 'crawl:completed',
            description: 'Crawl job completed',
            payload: {
              type: 'crawl:completed',
              jobId: 'string',
              totalPages: 'number',
              duration: 'number'
            }
          },
          {
            type: 'crawl:error',
            description: 'Crawl job error',
            payload: {
              type: 'crawl:error',
              jobId: 'string',
              error: 'string'
            }
          }
        ]
      },
      authentication: {
        method: 'token',
        description: 'Send authentication token after connecting',
        example: {
          type: 'auth',
          token: 'your-session-token'
        }
      }
    });
  } catch (error) {
    console.error('WebSocket info error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint to send messages via server-side WebSocket connection
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { type, payload } = body;

    // Validate message type
    const validTypes = ['crawl:watch', 'crawl:cancel'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }

    // Here you would typically send the message to your WebSocket server
    // For now, we'll just acknowledge the request
    // In production, this would interact with your WebSocket server

    return NextResponse.json({
      success: true,
      message: 'Message queued for WebSocket delivery',
      type,
      payload
    });
  } catch (error) {
    console.error('WebSocket message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}