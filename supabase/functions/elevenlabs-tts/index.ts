// ElevenLabs TTS edge function with audio caching
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize Supabase client for storage operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Generate cache key from text and voice settings
function generateCacheKey(text: string, voiceId: string, modelId: string): string {
  const content = JSON.stringify({ text, voiceId, modelId });
  return createHash('md5').update(content).digest('hex');
}

// Upload audio to storage bucket for caching
async function cacheAudioInStorage(audioData: ArrayBuffer, cacheKey: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('audio')
      .upload(`cache/${cacheKey}.mp3`, audioData, {
        contentType: 'audio/mpeg',
        cacheControl: '3600', // 1 hour cache
      });
    
    if (error && error.message !== 'The resource already exists') {
      console.warn('Cache upload failed:', error.message);
    }
  } catch (error) {
    console.warn('Cache storage error:', error);
  }
}

// Check if audio exists in cache
async function getCachedAudio(cacheKey: string): Promise<ArrayBuffer | null> {
  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .download(`cache/${cacheKey}.mp3`);
    
    if (error || !data) {
      return null;
    }
    
    return await data.arrayBuffer();
  } catch (error) {
    console.warn('Cache retrieval error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Missing authorization header', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    // Support both anon key and user tokens
    if (token !== anonKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response('Invalid authentication token', {
          status: 401,
          headers: corsHeaders,
        });
      }
    }

    // Get ElevenLabs API key
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { text, voice_id = 'JBFqnCBsd6RMkjVDRZzb', model_id = 'eleven_multilingual_v2' } = body;

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required and must be a string' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey(text, voice_id, model_id);
    
    // Check cache first
    const cachedAudio = await getCachedAudio(cacheKey);
    if (cachedAudio) {
      console.log('TTS: Serving from cache');
      return new Response(cachedAudio, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'X-Audio-Cached': 'true',
        },
      });
    }

    // Generate new audio via ElevenLabs API
    console.log('TTS: Generating new audio via ElevenLabs');
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128'
      }),
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'TTS generation failed', 
          details: errorText 
        }),
        {
          status: elevenLabsResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get audio data
    const audioData = await elevenLabsResponse.arrayBuffer();
    
    // Stream response to client immediately while caching in background
    const responseStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(audioData));
        controller.close();
        
        // Cache in background using EdgeRuntime.waitUntil
        EdgeRuntime.waitUntil(cacheAudioInStorage(audioData, cacheKey));
      },
    });

    return new Response(responseStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'X-Audio-Cached': 'false',
      },
    });

  } catch (error) {
    console.error('TTS function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});