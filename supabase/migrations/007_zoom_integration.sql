-- Zoom Integration Tables
-- This migration adds support for Zoom OAuth and meeting management

-- Create interview_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.interview_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
    
    -- Interview details
    interview_type TEXT NOT NULL CHECK (interview_type IN ('phone', 'video', 'onsite', 'technical')),
    round INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending_scheduling' CHECK (status IN ('pending_scheduling', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    
    -- Scheduling details
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    timezone TEXT DEFAULT 'UTC',
    
    -- Meeting details
    meeting_platform TEXT CHECK (meeting_platform IN ('zoom', 'teams', 'google_meet', 'phone', 'in_person')),
    meeting_id TEXT,
    meeting_url TEXT,
    meeting_password TEXT,
    dial_in_info JSONB,
    
    -- Participants
    interviewers JSONB DEFAULT '[]', -- Array of {id, name, email, role}
    
    -- Interview content
    interview_questions JSONB DEFAULT '[]',
    interview_guide JSONB DEFAULT '{}',
    
    -- Feedback and results
    feedback JSONB DEFAULT '{}', -- Structured feedback from interviewers
    recording_url TEXT,
    transcript_url TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zoom OAuth credentials table
CREATE TABLE IF NOT EXISTS public.zoom_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    
    -- Zoom user info
    zoom_user_id TEXT NOT NULL,
    zoom_email TEXT,
    zoom_account_id TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zoom meetings table
CREATE TABLE IF NOT EXISTS public.zoom_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    interview_schedule_id UUID REFERENCES public.interview_schedules(id) ON DELETE CASCADE,
    
    -- Zoom meeting details
    zoom_meeting_id BIGINT NOT NULL UNIQUE,
    uuid TEXT,
    host_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    type INTEGER DEFAULT 2, -- 1: instant, 2: scheduled, 3: recurring with no fixed time, 8: recurring with fixed time
    
    -- Meeting settings
    start_time TIMESTAMPTZ NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    timezone TEXT DEFAULT 'UTC',
    agenda TEXT,
    
    -- URLs and access
    start_url TEXT NOT NULL,
    join_url TEXT NOT NULL,
    password TEXT,
    encrypted_password TEXT,
    h323_password TEXT,
    pstn_password TEXT,
    
    -- Meeting options
    settings JSONB DEFAULT '{}', -- Full Zoom meeting settings object
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'started', 'ended', 'cancelled')),
    
    -- Recording info
    auto_recording TEXT CHECK (auto_recording IN ('local', 'cloud', 'none')),
    recording_urls JSONB DEFAULT '[]',
    
    -- Participant tracking
    participants JSONB DEFAULT '[]', -- Array of {id, name, email, join_time, leave_time, duration}
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zoom webhook events table (for audit and debugging)
CREATE TABLE IF NOT EXISTS public.zoom_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    event_ts TIMESTAMPTZ NOT NULL,
    
    -- Related entities
    zoom_meeting_id BIGINT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Event data
    payload JSONB NOT NULL,
    
    -- Processing status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_interview_schedules_user_id ON public.interview_schedules(user_id);
CREATE INDEX idx_interview_schedules_applicant_id ON public.interview_schedules(applicant_id);
CREATE INDEX idx_interview_schedules_job_posting_id ON public.interview_schedules(job_posting_id);
CREATE INDEX idx_interview_schedules_status ON public.interview_schedules(status);
CREATE INDEX idx_interview_schedules_scheduled_at ON public.interview_schedules(scheduled_at);

CREATE INDEX idx_zoom_credentials_user_id ON public.zoom_credentials(user_id);
CREATE INDEX idx_zoom_credentials_expires_at ON public.zoom_credentials(expires_at);

CREATE INDEX idx_zoom_meetings_user_id ON public.zoom_meetings(user_id);
CREATE INDEX idx_zoom_meetings_interview_id ON public.zoom_meetings(interview_schedule_id);
CREATE INDEX idx_zoom_meetings_zoom_id ON public.zoom_meetings(zoom_meeting_id);
CREATE INDEX idx_zoom_meetings_start_time ON public.zoom_meetings(start_time);
CREATE INDEX idx_zoom_meetings_status ON public.zoom_meetings(status);

CREATE INDEX idx_zoom_webhook_events_event_type ON public.zoom_webhook_events(event_type);
CREATE INDEX idx_zoom_webhook_events_event_ts ON public.zoom_webhook_events(event_ts);
CREATE INDEX idx_zoom_webhook_events_zoom_meeting_id ON public.zoom_webhook_events(zoom_meeting_id);
CREATE INDEX idx_zoom_webhook_events_processed ON public.zoom_webhook_events(processed);

-- Enable RLS
ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Interview schedules: Users can manage their own
CREATE POLICY "Users can view own interview schedules" ON public.interview_schedules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interview schedules" ON public.interview_schedules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview schedules" ON public.interview_schedules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interview schedules" ON public.interview_schedules
    FOR DELETE USING (auth.uid() = user_id);

-- Zoom credentials: Users can only manage their own
CREATE POLICY "Users can view own zoom credentials" ON public.zoom_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own zoom credentials" ON public.zoom_credentials
    FOR ALL USING (auth.uid() = user_id);

-- Zoom meetings: Users can manage their own
CREATE POLICY "Users can view own zoom meetings" ON public.zoom_meetings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own zoom meetings" ON public.zoom_meetings
    FOR ALL USING (auth.uid() = user_id);

-- Webhook events: Only service role can insert, users can view their own
CREATE POLICY "Service role can insert webhook events" ON public.zoom_webhook_events
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Users can view own webhook events" ON public.zoom_webhook_events
    FOR SELECT USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_interview_schedules_updated_at BEFORE UPDATE ON public.interview_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_credentials_updated_at BEFORE UPDATE ON public.zoom_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_meetings_updated_at BEFORE UPDATE ON public.zoom_meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function to check if Zoom token needs refresh
CREATE OR REPLACE FUNCTION needs_zoom_token_refresh(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    expires_at TIMESTAMPTZ;
BEGIN
    SELECT zc.expires_at INTO expires_at
    FROM public.zoom_credentials zc
    WHERE zc.user_id = needs_zoom_token_refresh.user_id
    AND zc.is_active = true;
    
    -- Refresh if token expires in less than 5 minutes
    RETURN expires_at IS NULL OR expires_at < NOW() + INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION needs_zoom_token_refresh TO authenticated;