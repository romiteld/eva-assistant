// Unified voice streaming edge function
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize clients
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Generate simple cache key
function generateCacheKey(params: any): string {
  return btoa(JSON.stringify(params)).replace(/[+/=]/g, '');
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
    // Verify authentication (allow both user tokens and anon key)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Missing authorization header', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    // Check if it's the anon key (for Microsoft OAuth users)
    if (token === anonKey) {
      console.log('Voice stream: Using anon key authentication');
    } else {
      // Verify the user token for regular Supabase auth users
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response('Invalid authentication token', {
          status: 401,
          headers: corsHeaders,
        });
      }
      console.log('Voice stream: Using user token authentication for user:', user.id);
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

        // Call OpenAI Whisper API - use environment variable only
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        console.log('OpenAI API key from env present:', !!openaiApiKey);
        console.log('OpenAI API key length:', openaiApiKey?.length || 0);
        console.log('OpenAI API key prefix:', openaiApiKey?.substring(0, 10) || 'none');
        
        if (!openaiApiKey) {
          console.error('OpenAI API key not configured in environment variables');
          throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
        }

        // Validate OpenAI API key format
        if (!openaiApiKey.startsWith('sk-')) {
          console.error('OpenAI API key does not have the correct format. Expected format: sk-...');
          throw new Error('OpenAI API key must start with "sk-". Please check your API key format.');
        }

        console.log('Making OpenAI API request to:', 'https://api.openai.com/v1/audio/transcriptions');
        console.log('Audio blob size:', audioBlob.size);
        console.log('Form data fields:', Array.from(formData.keys()));

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        console.log('OpenAI API response status:', response.status);
        console.log('OpenAI API response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const error = await response.text();
          console.error('OpenAI API error response body:', error);
          console.error('OpenAI API error status:', response.status);
          console.error('OpenAI API error status text:', response.statusText);
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
        // Redirect to separate elevenlabs-tts function
        return new Response(JSON.stringify({ error: 'Use elevenlabs-tts function for synthesis' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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