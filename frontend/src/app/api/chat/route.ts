import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

// Note: Removed edge runtime due to next-auth dependency in auth middleware

async function handlePost(req: AuthenticatedRequest) {
  try {

    // Get the messages from the request
    const { messages, model = 'gemini-2.0-flash-exp' } = await req.json();

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request: messages array required' }, { status: 400 });
    }

    // Create the Gemini model
    const gemini = google(model);

    // Stream the response
    const result = streamText({
      model: gemini,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.95,
      topK: 40,
      system: `You are EVA, an AI-powered recruitment assistant for financial advisor recruiting. 
You help recruiters find and engage with top talent, manage their pipeline, and make data-driven decisions.
Be professional, helpful, and concise in your responses.`,
      onFinish: async ({ text, usage }) => {
        // Optionally log usage to database
        console.log('Chat completion:', {
          userId: req.user?.id,
          tokensUsed: usage.totalTokens,
          model,
        });
      },
    });

    // Return the streaming response
    // The AI SDK returns a Response object, but Next.js expects NextResponse
    // Since NextResponse extends Response, we can safely cast it
    return result.toDataStreamResponse() as unknown as NextResponse;
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ 
        error: 'Chat API error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// Export the POST handler with authentication and AI rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'ai');