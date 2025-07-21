# ElevenLabs Text-to-Speech Integration

This integration provides streaming text-to-speech functionality using ElevenLabs API through a Supabase Edge Function with automatic caching.

## Features

- **Streaming Audio**: Audio starts playing immediately while still being generated
- **Automatic Caching**: Generated audio is cached in Supabase Storage for faster subsequent requests
- **Multiple Voices**: Support for 30+ high-quality voices
- **Multiple Models**: Choose from different ElevenLabs models based on speed/quality needs
- **Error Handling**: Robust error handling with user-friendly messages
- **Download Support**: Users can download generated audio files

## Setup

### 1. Environment Variables

Add your ElevenLabs API key to your Supabase project:

```bash
# In Supabase Dashboard > Project Settings > Edge Functions
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Add to your `.env.local`:

```env
# Already included in your Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://ztakznzshlvqobzbuewb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Edge Function Details

The Edge Function `elevenlabs-tts` is already deployed and includes:

- **Endpoint**: `https://ztakznzshlvqobzbuewb.supabase.co/functions/v1/elevenlabs-tts`
- **Method**: POST
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_ANON_KEY`
- **Body**:
  ```json
  {
    "text": "Text to convert to speech",
    "voice_id": "optional_voice_id",
    "model_id": "optional_model_id"
  }
  ```

### 3. Storage Bucket

A `tts-cache` bucket has been created with:
- Public read access for cached audio files
- 50MB file size limit
- Automatic MIME type validation (audio/mpeg, audio/mp3)

## Usage

### Basic Usage

```typescript
import { ElevenLabsTTSService } from '@/lib/services/elevenlabs-tts';

const ttsService = new ElevenLabsTTSService(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Generate and play audio
const audio = await ttsService.textToSpeechAndPlay({
  text: "Hello, world!",
  voiceId: ELEVENLABS_VOICES.ADAM,
  modelId: ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5
});
```

### React Component Usage

```tsx
import { TTSPlayer } from '@/components/tts/TTSPlayer';

export default function Page() {
  return <TTSPlayer />;
}
```

## Available Voices

The system includes 30+ voices with different characteristics:
- Male voices: Adam, Antoni, Arnold, Ethan, Harry, James, Joseph, Josh, Liam, etc.
- Female voices: Bella, Emily, Freya, Grace, Jessie, Matilda, Nicole, Rachel, etc.

## Available Models

- **eleven_turbo_v2_5**: Fastest, lowest latency (recommended)
- **eleven_turbo_v2**: Fast, good quality
- **eleven_multilingual_v2**: Supports 29 languages
- **eleven_monolingual_v1**: English only, high quality

## Performance

- First request: ~1-3 seconds (generates and caches)
- Subsequent requests: ~100-300ms (served from cache)
- Cache duration: 1 hour

## Error Handling

The system handles:
- Missing API keys
- Invalid text input
- Network errors
- ElevenLabs API errors
- Audio playback errors

## Security

- API key is stored securely in Supabase Edge Function environment
- CORS headers configured for browser access
- Authentication via Supabase anon key

## Costs

- ElevenLabs API: Charged per character generated
- Supabase Storage: Included in your plan
- Edge Function invocations: Included in your plan