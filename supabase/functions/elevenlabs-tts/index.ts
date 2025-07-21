import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

interface TTSRequest {
  text: string;
  voice_id?: string;
  model_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

// Simple hash function for request caching
function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Generate cache key from request parameters
function generateCacheKey(request: TTSRequest): string {
  const cacheString = JSON.stringify({
    text: request.text,
    voice_id: request.voice_id || 'exsUS4vynmxd379XN4yO', // Default voice
    model_id: request.model_id || 'eleven_monolingual_v1',
    voice_settings: request.voice_settings
  });
  return generateHash(cacheString);
}

// Check if audio file exists in storage
async function checkCachedAudio(supabase: any, cacheKey: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .storage
      .from('audio-cache')
      .list('tts/', {
        search: `${cacheKey}.mp3`
      });

    if (error || !data || data.length === 0) {
      return null;
    }

    const { data: urlData } = await supabase
      .storage
      .from('audio-cache')
      .createSignedUrl(`tts/${cacheKey}.mp3`, 3600);

    return urlData?.signedUrl || null;
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

// Upload audio stream to Supabase Storage
async function uploadAudioToStorage(
  supabase: any, 
  audioStream: ReadableStream<Uint8Array>, 
  cacheKey: string
): Promise<void> {
  try {
    // Convert stream to array buffer
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Calculate total length and create combined array
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedArray = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }

    const { error } = await supabase
      .storage
      .from('audio-cache')
      .upload(`tts/${cacheKey}.mp3`, combinedArray, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      });

    if (error) {
      console.error('Storage upload error:', error);
    } else {
      console.log(`Audio cached successfully: ${cacheKey}.mp3`);
    }
  } catch (error) {
    console.error('Upload process error:', error);
  }
}

// Generate TTS audio using ElevenLabs API
async function generateTTS(request: TTSRequest): Promise<ReadableStream<Uint8Array>> {
  const voiceId = request.voice_id || 'exsUS4vynmxd379XN4yO'; // Default voice
  const modelId = request.model_id || 'eleven_monolingual_v1';
  
  const requestBody = {
    text: request.text,
    model_id: modelId,
    voice_settings: {
      stability: request.voice_settings?.stability || 0.5,
      similarity_boost: request.voice_settings?.similarity_boost || 0.75,
      style: request.voice_settings?.style || 0.0,
      use_speaker_boost: request.voice_settings?.use_speaker_boost || true
    }
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body from ElevenLabs API');
  }

  return response.body;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      }
    });
  }

  try {
    let requestData: TTSRequest;
    
    // Support both GET with query params and POST with JSON body
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const params = new URLSearchParams(url.search);
      const text = params.get('text');
      const voiceId = params.get('voiceId') || params.get('voice_id');
      
      if (!text) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameter: text' }),
          { 
            status: 400,
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json' 
            }
          }
        );
      }
      
      requestData = {
        text,
        voice_id: voiceId || undefined,
      };
    } else if (req.method === 'POST') {
      requestData = await req.json();
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        }
      );
    }
    // Validate environment variables
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { 
          status: 500,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { 
          status: 500,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        }
      );
    }

    // Validate required fields
    if (!requestData.text || requestData.text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text field is required' }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        }
      );
    }

    // Limit text length to prevent abuse
    if (requestData.text.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum 5000 characters allowed.' }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Generate cache key
    const cacheKey = generateCacheKey(requestData);

    // Check if cached audio exists
    const cachedUrl = await checkCachedAudio(supabase, cacheKey);
    
    if (cachedUrl) {
      // Return cached audio
      const cachedResponse = await fetch(cachedUrl);
      
      if (cachedResponse.ok && cachedResponse.body) {
        return new Response(cachedResponse.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=3600',
            'X-Cache-Status': 'HIT'
          }
        });
      }
    }

    // Generate new TTS audio
    const audioStream = await generateTTS(requestData);

    // Create two streams using tee() for branching
    const [browserStream, storageStream] = audioStream.tee();

    // Start background upload process
    // Using setTimeout as EdgeRuntime.waitUntil equivalent for Deno
    Promise.resolve().then(async () => {
      try {
        await uploadAudioToStorage(supabase, storageStream, cacheKey);
      } catch (error) {
        console.error('Background upload failed:', error);
      }
    });

    // Return streaming response to browser immediately
    return new Response(browserStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache-Status': 'MISS'
      }
    });

  } catch (error) {
    console.error('TTS generation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'TTS generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});