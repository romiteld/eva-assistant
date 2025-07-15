import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Create Google AI model instance
const model = google('gemini-2.0-flash-exp', {
  // Optional model settings
  safetySettings: [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  ],
});

export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
          userId: user.id,
        });
      },
    });

    // Return the streaming response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat stream error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}