// Unified voice streaming edge function
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ElevenLabsClient } from 'npm:elevenlabs';
import * as crypto from 'npm:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize clients
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const elevenlabs = new ElevenLabsClient({
  apiKey: Deno.env.get('ELEVENLABS_API_KEY'),
});

// Upload audio to Supabase Storage in background
async function uploadAudioToStorage(stream: ReadableStream, cacheKey: string) {
  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(`${cacheKey}.mp3`, stream, {
        contentType: 'audio/mp3',
      });

    console.log('Storage upload result', { data, error });
  } catch (error) {
    console.error('Storage upload error:', error);
  }
}

// Generate cache key using MD5 hash
function generateCacheKey(params: any): string {
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify(params));
  return hash.digest('hex');
}

// Convert base64 to blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

Deno.serve(async (req) => {
  // Handle CORS
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

    // Verify the user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response('Invalid authentication token', {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse URL to determine operation
    const url = new URL(req.url);
    const operation = url.pathname.split('/').pop();

    switch (operation) {
      case 'transcribe': {
        // Handle speech-to-text
        const { audioData, sessionId, language } = await req.json();
        
        if (!audioData) {
          return new Response(
            JSON.stringify({ error: 'No audio data provided' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Convert base64 to blob
        const audioBlob = base64ToBlob(audioData, 'audio/webm');

        // Create form data for OpenAI API
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');
        if (language) {
          formData.append('language', language);
        }

        // Call OpenAI Whisper API
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('OpenAI API error:', error);
          throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        return new Response(
          JSON.stringify({
            transcript: data.text,
            sessionId,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'synthesize': {
        // Handle text-to-speech with caching
        const url = new URL(req.url);
        const params = new URLSearchParams(url.search);
        const text = params.get('text');
        const voiceId = params.get('voiceId') ?? Deno.env.get('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb';
        const modelId = params.get('modelId') ?? 'eleven_multilingual_v2';

        if (!text) {
          return new Response(JSON.stringify({ error: 'Text parameter is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Generate cache key
        const cacheKey = generateCacheKey({ text, voiceId, modelId });
        console.log('Cache key:', cacheKey);

        // Check storage for existing audio file
        const { data } = await supabase.storage
          .from('audio')
          .createSignedUrl(`${cacheKey}.mp3`, 60);

        if (data) {
          console.log('Audio file found in storage', data);
          const storageRes = await fetch(data.signedUrl);
          if (storageRes.ok) {
            // Return cached audio
            const audioData = await storageRes.arrayBuffer();
            return new Response(audioData, {
              headers: {
                ...corsHeaders,
                'Content-Type': 'audio/mpeg',
                'X-Audio-Cached': 'true',
              },
            });
          }
        }

        // Generate new audio
        console.log('Generating new audio with ElevenLabs');
        const response = await elevenlabs.textToSpeech.stream(voiceId, {
          output_format: 'mp3_44100_128',
          model_id: modelId,
          text,
        });

        // Convert async iterator to ReadableStream
        const stream = new ReadableStream({
          async start(controller) {
            for await (const chunk of response) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });

        // Branch stream for caching
        const [browserStream, storageStream] = stream.tee();

        // Upload to storage in background
        EdgeRuntime.waitUntil(uploadAudioToStorage(storageStream, cacheKey));

        // Return streaming response immediately
        return new Response(browserStream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'X-Audio-Cached': 'false',
          },
        });
      }

      case 'ws': {
        // Handle WebSocket upgrade for real-time streaming
        const upgrade = req.headers.get('upgrade') || '';
        
        if (upgrade.toLowerCase() !== 'websocket') {
          return new Response('Expected websocket', {
            status: 400,
            headers: corsHeaders,
          });
        }

        // WebSocket handling would go here
        // For now, return method not allowed
        return new Response('WebSocket support coming soon', {
          status: 501,
          headers: corsHeaders,
        });
      }

      default:
        return new Response('Invalid operation', {
          status: 400,
          headers: corsHeaders,
        });
    }
  } catch (error) {
    console.error('Edge function error:', error);
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