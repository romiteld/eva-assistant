import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import * as ws from 'ws';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

// Gemini Live API configuration
// Use the correct Gemini Live API endpoint with v1 instead of v1beta
const GEMINI_LIVE_API_URL = 'wss://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?alt=sse';

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;
  return token === cookieToken && !!token;
}

// Get Gemini client (server-side only)
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

async function handlePost(request: AuthenticatedRequest) {
  try {
    // CSRF Protection
    if (!validateCSRFToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { model = 'gemini-pro', prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = body;

    // Input validation
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (prompt.length > 10000) {
      return NextResponse.json(
        { error: 'Prompt is too long (max 10000 characters)' },
        { status: 400 }
      );
    }

    // Get Gemini client
    const genAI = getGeminiClient();
    const geminiModel = genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        temperature,
        maxOutputTokens: Math.min(maxTokens, 4096), // Cap at 4096 tokens
      },
      systemInstruction,
    });

    // Generate content
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Log the action for audit trail (optional)
    // Note: Need to create supabase client if you want to log
    // const supabase = await createClient();
    // await supabase.from('api_logs').insert({
    //   user_id: request.user?.id,
    //   action: 'gemini_generate',
    //   metadata: {
    //     model,
    //     prompt_length: prompt.length,
    //     response_length: text.length,
    //     timestamp: new Date().toISOString(),
    //   },
    // });

    return NextResponse.json({ 
      success: true, 
      data: {
        text,
        model,
        usage: {
          promptTokens: Math.ceil(prompt.length / 4), // Rough estimate
          completionTokens: Math.ceil(text.length / 4), // Rough estimate
        },
      },
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and AI rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'ai');

// Streaming endpoint for real-time responses
async function handleGet(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers.get('upgrade');
    if (upgrade === 'websocket') {
      return handleWebSocketUpgrade(request);
    }

    // CSRF Protection
    if (!validateCSRFToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const prompt = searchParams.get('prompt');
    const model = searchParams.get('model') || 'gemini-pro';

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Get Gemini client
    const genAI = getGeminiClient();
    const geminiModel = genAI.getGenerativeModel({ model });

    // Create a stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await geminiModel.generateContentStream(prompt);
          
          for await (const chunk of result.stream) {
            const text = chunk.text();
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
          
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Gemini streaming error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication and AI rate limiting
export const GET = withAuthAndRateLimit(handleGet, 'ai');

// Handle WebSocket upgrade for Gemini Live API
async function handleWebSocketUpgrade(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    // Extract authentication from query params or headers
    const searchParams = request.nextUrl.searchParams;
    const authToken = searchParams.get('token') || request.headers.get('authorization')?.replace('Bearer ', '');

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use authenticated user from request
    const user = request.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Return a response indicating WebSocket upgrade should be handled by the platform
    // In Next.js App Router, we need to use a custom server or middleware for actual WebSocket handling
    return NextResponse.json({ error: 'WebSocket upgrade not supported in this environment' }, { 
      status: 501,
      headers: {
        'X-Gemini-Proxy': 'true',
        'X-User-Id': user.id,
      },
    });
  } catch (error) {
    console.error('WebSocket upgrade error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT endpoint for WebSocket connection info
async function handlePut(request: AuthenticatedRequest) {
  try {

    // Generate a temporary WebSocket token for the client
    const wsToken = Buffer.from(JSON.stringify({
      userId: request.user?.id,
      exp: Date.now() + 3600000, // 1 hour expiry
      purpose: 'gemini-live',
    })).toString('base64');

    // Return WebSocket connection information
    return NextResponse.json({
      success: true,
      websocket: {
        url: '/api/gemini/ws', // Use our proxy endpoint
        token: wsToken,
        protocol: 'ws',
        description: 'Gemini Live API WebSocket proxy endpoint for real-time streaming',
      },
      instructions: {
        authentication: 'Include the provided token in your WebSocket connection',
        messageFormat: {
          setup: {
            type: 'setup',
            setup: {
              model: 'models/gemini-2.0-flash-exp',
            },
          },
          message: {
            type: 'clientContent',
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: 'your message here' }],
                },
              ],
            },
          },
        },
        events: {
          incoming: [
            'setupComplete',
            'serverContent',
            'toolCall',
            'toolCallCancellation',
          ],
          outgoing: [
            'setup',
            'clientContent',
            'realtimeInput',
            'toolResponse',
          ],
        },
      },
    });
  } catch (error) {
    console.error('WebSocket info error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the PUT handler with authentication and AI rate limiting
export const PUT = withAuthAndRateLimit(handlePut, 'ai');