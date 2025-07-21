# Audio Storage Bucket Configuration

## Overview
A public storage bucket named `audio` has been created in Supabase for caching TTS (Text-to-Speech) files from ElevenLabs.

## Bucket Details

- **Bucket ID**: `audio`
- **Bucket Name**: `audio`
- **Access**: Public (read access)
- **File Size Limit**: 50MB (52,428,800 bytes)
- **Created**: 2025-07-21 05:08:04 UTC

## Supported MIME Types

The bucket is configured to accept the following audio file formats:

- `audio/mpeg` - MPEG audio files
- `audio/mp3` - MP3 audio files
- `audio/wav` - WAV audio files
- `audio/wave` - WAV audio files (alternative MIME type)
- `audio/x-wav` - WAV audio files (alternative MIME type)
- `audio/ogg` - OGG Vorbis audio files
- `audio/webm` - WebM audio files
- `audio/aac` - AAC audio files
- `audio/m4a` - M4A audio files
- `audio/x-m4a` - M4A audio files (alternative MIME type)
- `audio/mp4` - MP4 audio files

## Usage

### Uploading Audio Files

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Upload an audio file
const { data, error } = await supabase.storage
  .from('audio')
  .upload('path/to/audio.mp3', audioFile, {
    contentType: 'audio/mp3',
    cacheControl: '3600', // Cache for 1 hour
    upsert: true // Overwrite if exists
  })
```

### Retrieving Audio Files

```typescript
// Get public URL for an audio file
const { data } = supabase.storage
  .from('audio')
  .getPublicUrl('path/to/audio.mp3')

// Download an audio file
const { data, error } = await supabase.storage
  .from('audio')
  .download('path/to/audio.mp3')
```

### Listing Audio Files

```typescript
// List all files in the bucket
const { data, error } = await supabase.storage
  .from('audio')
  .list('', {
    limit: 100,
    offset: 0
  })
```

## Integration with ElevenLabs TTS

This bucket is specifically designed for caching TTS output from ElevenLabs. When implementing the TTS caching:

1. Generate a unique filename based on the text content (e.g., using a hash)
2. Check if the file already exists in the bucket
3. If not, generate the audio using ElevenLabs API
4. Upload the generated audio to the bucket
5. Return the public URL for playback

### Example TTS Caching Implementation

```typescript
import crypto from 'crypto'

async function getTTSAudio(text: string, voice: string) {
  // Generate unique filename based on text and voice
  const hash = crypto
    .createHash('md5')
    .update(`${text}-${voice}`)
    .digest('hex')
  const filename = `tts/${hash}.mp3`

  // Check if already cached
  const { data: existingFile } = await supabase.storage
    .from('audio')
    .list('tts', {
      search: `${hash}.mp3`
    })

  if (existingFile && existingFile.length > 0) {
    // Return cached URL
    const { data } = supabase.storage
      .from('audio')
      .getPublicUrl(filename)
    return data.publicUrl
  }

  // Generate new audio with ElevenLabs
  const audioData = await generateWithElevenLabs(text, voice)

  // Upload to cache
  const { error } = await supabase.storage
    .from('audio')
    .upload(filename, audioData, {
      contentType: 'audio/mp3',
      cacheControl: '86400' // Cache for 24 hours
    })

  if (error) throw error

  // Return public URL
  const { data } = supabase.storage
    .from('audio')
    .getPublicUrl(filename)
  
  return data.publicUrl
}
```

## Security Considerations

- The bucket is public for read access, meaning anyone with the URL can access the audio files
- Only authenticated users can upload, update, or delete files
- Consider implementing additional access controls if sensitive content is being cached
- Regularly clean up old cached files to manage storage costs

## Maintenance

Consider implementing:
- Automatic cleanup of files older than X days
- Monitoring of storage usage
- Rate limiting for uploads to prevent abuse