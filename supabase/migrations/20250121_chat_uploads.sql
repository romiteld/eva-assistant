-- Create chat uploads table for Eva voice assistant file uploads
CREATE TABLE IF NOT EXISTS chat_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'chat-uploads',
  mime_type TEXT,
  metadata JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_chat_uploads_user_id ON chat_uploads(user_id);
CREATE INDEX idx_chat_uploads_session_id ON chat_uploads(session_id);
CREATE INDEX idx_chat_uploads_created_at ON chat_uploads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_uploads
CREATE POLICY "Users can view their own chat uploads"
  ON chat_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat uploads"
  ON chat_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat uploads"
  ON chat_uploads FOR DELETE
  USING (auth.uid() = user_id);

-- Note: Create storage bucket via Supabase Dashboard or API
-- Storage bucket: chat-uploads
-- Policies:
-- 1. Authenticated users can upload files (max 10MB)
-- 2. Users can only read their own files
-- 3. Files are organized by user_id/session_id/filename