import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

// Set API key for Google AI SDK
// The @ai-sdk/google package expects the API key to be in GOOGLE_GENERATIVE_AI_API_KEY env var
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  // If only NEXT_PUBLIC_GEMINI_API_KEY is set, we need to ensure it's available
  // to the Google AI SDK (Note: This is a workaround, ideally use GOOGLE_GENERATIVE_AI_API_KEY)
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
}

// Create Google AI model instance
const model = google('gemini-2.0-flash-exp');

async function handlePost(request: AuthenticatedRequest) {
  try {

    // Parse request body
    const { messages, id: sessionId } = await request.json();

    // System prompt for EVA assistant
    const systemPrompt = `You are EVA, an AI-powered recruitment assistant for financial advisors. 
You help with:
- Finding and qualifying financial advisor candidates
- Creating recruitment campaigns and content
- Managing the recruitment pipeline
- Providing insights on the financial advisory industry
- Scheduling interviews and managing communications

Be professional, knowledgeable, and helpful. Provide specific, actionable advice when possible.`;

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
      topK: 40,
      onFinish: async ({ text, usage }) => {
        // Log usage for analytics if needed
        console.log('Stream finished:', {
          tokensUsed: usage?.totalTokens,
          sessionId,
          userId: request.user?.id,
        });
      },
    });

    // Return the streaming response
    // The AI SDK returns a Response object, but Next.js expects NextResponse
    // Since NextResponse extends Response, we can safely cast it
    return result.toDataStreamResponse() as unknown as NextResponse;
  } catch (error) {
    console.error('Chat stream error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and AI rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'ai');