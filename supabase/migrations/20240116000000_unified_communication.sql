-- Migration: Add unified communication support to existing tables

-- Add mode and media support to existing chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'chat' CHECK (mode IN ('chat', 'stream', 'voice')),
ADD COLUMN IF NOT EXISTS media_metadata JSONB DEFAULT '{}'::JSONB;

-- Create stream_participants table for managing live streams
CREATE TABLE IF NOT EXISTS public.stream_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  peer_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  role TEXT CHECK (role IN ('host', 'participant')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create media_recordings table for storing recordings
CREATE TABLE IF NOT EXISTS public.media_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('audio', 'video', 'screen')),
  url TEXT NOT NULL,
  duration INTEGER,
  size BIGINT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unified_history view for easier querying
CREATE OR REPLACE VIEW public.unified_communication_history AS
SELECT 
  cs.id,
  cs.user_id,
  cs.title,
  cs.mode,
  cs.created_at,
  cs.updated_at,
  cs.metadata,
  cs.media_metadata,
  COALESCE(
    (SELECT COUNT(*) FROM public.chat_messages WHERE session_id = cs.id),
    0
  ) as message_count,
  COALESCE(
    (SELECT COUNT(*) FROM public.stream_participants WHERE session_id = cs.id),
    0
  ) as participant_count,
  COALESCE(
    (SELECT COUNT(*) FROM public.media_recordings WHERE session_id = cs.id),
    0
  ) as recording_count
FROM public.chat_sessions cs;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_mode ON public.chat_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_mode ON public.chat_sessions(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_stream_participants_session ON public.stream_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_stream_participants_user ON public.stream_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_media_recordings_session ON public.media_recordings(session_id);

-- Enable Row Level Security
ALTER TABLE public.stream_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stream_participants
CREATE POLICY "Users can view their own stream participants" 
  ON public.stream_participants 
  FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create stream participants" 
  ON public.stream_participants 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stream participants" 
  ON public.stream_participants 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stream participants" 
  ON public.stream_participants 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for media_recordings
CREATE POLICY "Users can view recordings from their sessions" 
  ON public.media_recordings 
  FOR SELECT 
  USING (
    session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create recordings for their sessions" 
  ON public.media_recordings 
  FOR INSERT 
  WITH CHECK (
    session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete recordings from their sessions" 
  ON public.media_recordings 
  FOR DELETE 
  USING (
    session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
  );

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_recordings;

-- Update functions for new tables
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_stream_participants_updated_at 
  BEFORE UPDATE ON public.stream_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_media_recordings_updated_at 
  BEFORE UPDATE ON public.media_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();