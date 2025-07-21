-- Create storage bucket for audio cache if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-cache',
  'audio-cache', 
  false,
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for reading cached audio files
CREATE POLICY "Allow reading cached audio files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'audio-cache' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Create policy for uploading cached audio files
CREATE POLICY "Allow uploading cached audio files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'audio-cache' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Create policy for updating cached audio files
CREATE POLICY "Allow updating cached audio files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'audio-cache' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Create policy for deleting old cached audio files (for cleanup)
CREATE POLICY "Allow deleting cached audio files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'audio-cache' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Create table for tracking TTS usage and analytics
CREATE TABLE IF NOT EXISTS public.tts_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text_hash TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  text_length INTEGER NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on tts_usage
ALTER TABLE public.tts_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting usage records
CREATE POLICY "Allow inserting TTS usage records" ON public.tts_usage
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' OR auth.role() = 'anon'
);

-- Create policy for reading own usage records
CREATE POLICY "Allow reading own TTS usage records" ON public.tts_usage
FOR SELECT USING (
  auth.uid() = user_id OR auth.role() = 'service_role'
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_tts_usage_user_id ON public.tts_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_usage_generated_at ON public.tts_usage(generated_at);
CREATE INDEX IF NOT EXISTS idx_tts_usage_text_hash ON public.tts_usage(text_hash);

-- Create function to clean up old cached files
CREATE OR REPLACE FUNCTION cleanup_old_tts_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete cached files older than 7 days
  DELETE FROM storage.objects 
  WHERE bucket_id = 'audio-cache' 
    AND created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Also clean up old usage records (older than 30 days)
  DELETE FROM public.tts_usage 
  WHERE generated_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-tts-cache', '0 2 * * *', 'SELECT cleanup_old_tts_cache();');