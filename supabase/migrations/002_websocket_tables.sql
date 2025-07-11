-- Additional tables for WebSocket/Real-time functionality

-- WebSocket connections tracking
CREATE TABLE IF NOT EXISTS public.websocket_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL UNIQUE,
    connected_at TIMESTAMPTZ NOT NULL,
    disconnected_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('connected', 'disconnected', 'error')) DEFAULT 'connected',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebSocket messages log
CREATE TABLE IF NOT EXISTS public.websocket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID,
    message_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio transcripts storage
CREATE TABLE IF NOT EXISTS public.audio_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,
    transcript TEXT NOT NULL,
    confidence DECIMAL(3, 2),
    language TEXT DEFAULT 'en',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video analysis results
CREATE TABLE IF NOT EXISTS public.video_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_type TEXT CHECK (analysis_type IN ('frame', 'video', 'screen')) NOT NULL,
    findings JSONB NOT NULL,
    significant BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command execution logs
CREATE TABLE IF NOT EXISTS public.command_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,
    command TEXT NOT NULL,
    params JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    status TEXT CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_websocket_connections_user_session ON public.websocket_connections(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_websocket_connections_status ON public.websocket_connections(status);
CREATE INDEX IF NOT EXISTS idx_websocket_messages_session ON public.websocket_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_websocket_messages_type ON public.websocket_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_audio_transcripts_user_session ON public.audio_transcripts(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_session ON public.video_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_significant ON public.video_analyses(significant);
CREATE INDEX IF NOT EXISTS idx_command_logs_user_command ON public.command_logs(user_id, command);
CREATE INDEX IF NOT EXISTS idx_command_logs_status ON public.command_logs(status);

-- Enable RLS
ALTER TABLE public.websocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websocket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own websocket connections" ON public.websocket_connections 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own websocket messages" ON public.websocket_messages 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own audio transcripts" ON public.audio_transcripts 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own video analyses" ON public.video_analyses 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own command logs" ON public.command_logs 
    FOR SELECT USING (auth.uid() = user_id);

-- Function to clean up old websocket data
CREATE OR REPLACE FUNCTION cleanup_old_websocket_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete old disconnected connections (older than 7 days)
    DELETE FROM public.websocket_connections 
    WHERE status = 'disconnected' 
    AND disconnected_at < NOW() - INTERVAL '7 days';
    
    -- Delete old messages (older than 30 days)
    DELETE FROM public.websocket_messages 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old transcripts (older than 90 days)
    DELETE FROM public.audio_transcripts 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete old video analyses (older than 30 days)
    DELETE FROM public.video_analyses 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old command logs (older than 90 days)
    DELETE FROM public.command_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- This would be set up in Supabase Dashboard or via SQL if pg_cron is enabled
-- SELECT cron.schedule('cleanup-websocket-data', '0 2 * * *', 'SELECT cleanup_old_websocket_data();');