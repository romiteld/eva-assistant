import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';

// Allow streaming responses
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get the messages from the request
    const { messages, model = 'gemini-2.0-flash-exp' } = await req.json();

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', { status: 400 });
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
          userId: user.id,
          tokensUsed: usage.totalTokens,
          model,
        });
      },
    });

    // Return the streaming response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return new Response(
        JSON.stringify({ 
          error: 'Chat API error', 
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error 
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response('An error occurred', { status: 500 });
  }
}