import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    // Test parameters
    const testText = "Hello! This is a test of the ElevenLabs integration.";
    const voiceId = "rachel";

    // Call the Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/elevenlabs-tts?text=${encodeURIComponent(testText)}&voiceId=${voiceId}`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: 'Edge Function error',
          details: errorText,
          status: response.status,
          edgeFunctionUrl,
          hasElevenLabsKey: !!elevenLabsKey
        },
        { status: response.status }
      );
    }

    // Get the audio data
    const audioData = await response.arrayBuffer();

    // Return success info
    return NextResponse.json({
      success: true,
      message: 'ElevenLabs TTS is working!',
      audioSize: audioData.byteLength,
      edgeFunctionUrl,
      hasElevenLabsKey: !!elevenLabsKey,
      testText,
      voiceId
    });

  } catch (error) {
    console.error('Error testing ElevenLabs:', error);
    return NextResponse.json(
      { 
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}