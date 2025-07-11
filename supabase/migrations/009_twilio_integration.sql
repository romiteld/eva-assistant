-- Twilio Integration Tables

-- SMS Messages Table
CREATE TABLE IF NOT EXISTS public.twilio_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sid TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    direction TEXT NOT NULL,
    num_media INTEGER DEFAULT 0,
    media_urls JSONB,
    error_code INTEGER,
    error_message TEXT,
    price DECIMAL(10, 4),
    price_unit TEXT,
    date_created TIMESTAMPTZ NOT NULL,
    date_sent TIMESTAMPTZ,
    date_updated TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Calls Table
CREATE TABLE IF NOT EXISTS public.twilio_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sid TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    status TEXT NOT NULL,
    direction TEXT NOT NULL,
    answered_by TEXT,
    duration INTEGER,
    price DECIMAL(10, 4),
    price_unit TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    recording_sid TEXT,
    transcription_sid TEXT,
    parent_call_sid TEXT,
    conference_sid TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phone Numbers Table
CREATE TABLE IF NOT EXISTS public.twilio_phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sid TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    friendly_name TEXT,
    capabilities JSONB NOT NULL DEFAULT '{"voice": true, "sms": true, "mms": true, "fax": false}',
    status TEXT DEFAULT 'active',
    voice_url TEXT,
    voice_method TEXT DEFAULT 'POST',
    sms_url TEXT,
    sms_method TEXT DEFAULT 'POST',
    status_callback_url TEXT,
    status_callback_method TEXT DEFAULT 'POST',
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Recordings Table
CREATE TABLE IF NOT EXISTS public.twilio_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sid TEXT UNIQUE NOT NULL,
    call_sid TEXT NOT NULL REFERENCES public.twilio_calls(sid) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    duration INTEGER NOT NULL,
    channels INTEGER DEFAULT 1,
    source TEXT,
    uri TEXT NOT NULL,
    price DECIMAL(10, 4),
    price_unit TEXT,
    date_created TIMESTAMPTZ NOT NULL,
    date_updated TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcriptions Table
CREATE TABLE IF NOT EXISTS public.twilio_transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sid TEXT UNIQUE NOT NULL,
    recording_sid TEXT NOT NULL REFERENCES public.twilio_recordings(sid) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    duration INTEGER NOT NULL,
    transcription_text TEXT,
    price DECIMAL(10, 4),
    price_unit TEXT,
    date_created TIMESTAMPTZ NOT NULL,
    date_updated TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Campaigns Table
CREATE TABLE IF NOT EXISTS public.twilio_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    recipients JSONB NOT NULL,
    scheduled_time TIMESTAMPTZ,
    status TEXT DEFAULT 'draft',
    total_recipients INTEGER NOT NULL,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    results JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Webhook Events Table
CREATE TABLE IF NOT EXISTS public.twilio_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_sid TEXT NOT NULL,
    account_sid TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS public.twilio_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sid TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    friendly_name TEXT NOT NULL,
    participants JSONB DEFAULT '[]',
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Summary Table
CREATE TABLE IF NOT EXISTS public.twilio_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calls_total INTEGER DEFAULT 0,
    calls_inbound INTEGER DEFAULT 0,
    calls_outbound INTEGER DEFAULT 0,
    calls_duration_seconds INTEGER DEFAULT 0,
    calls_cost DECIMAL(10, 4) DEFAULT 0,
    messages_total INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    messages_cost DECIMAL(10, 4) DEFAULT 0,
    recordings_total INTEGER DEFAULT 0,
    recordings_duration_seconds INTEGER DEFAULT 0,
    recordings_cost DECIMAL(10, 4) DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes for better performance
CREATE INDEX idx_twilio_messages_user_id ON public.twilio_messages(user_id);
CREATE INDEX idx_twilio_messages_status ON public.twilio_messages(status);
CREATE INDEX idx_twilio_messages_date_created ON public.twilio_messages(date_created);
CREATE INDEX idx_twilio_messages_from_to ON public.twilio_messages(from_number, to_number);

CREATE INDEX idx_twilio_calls_user_id ON public.twilio_calls(user_id);
CREATE INDEX idx_twilio_calls_status ON public.twilio_calls(status);
CREATE INDEX idx_twilio_calls_start_time ON public.twilio_calls(start_time);
CREATE INDEX idx_twilio_calls_from_to ON public.twilio_calls(from_number, to_number);

CREATE INDEX idx_twilio_recordings_call_sid ON public.twilio_recordings(call_sid);
CREATE INDEX idx_twilio_recordings_user_id ON public.twilio_recordings(user_id);

CREATE INDEX idx_twilio_campaigns_user_id ON public.twilio_campaigns(user_id);
CREATE INDEX idx_twilio_campaigns_status ON public.twilio_campaigns(status);

CREATE INDEX idx_twilio_webhook_events_resource ON public.twilio_webhook_events(resource_type, resource_sid);
CREATE INDEX idx_twilio_webhook_events_processed ON public.twilio_webhook_events(processed);

CREATE INDEX idx_twilio_analytics_user_date ON public.twilio_analytics(user_id, date);

-- Enable Row Level Security
ALTER TABLE public.twilio_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Users can view their own messages" ON public.twilio_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages" ON public.twilio_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON public.twilio_messages
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for calls
CREATE POLICY "Users can view their own calls" ON public.twilio_calls
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calls" ON public.twilio_calls
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calls" ON public.twilio_calls
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for phone numbers
CREATE POLICY "Users can view their own phone numbers" ON public.twilio_phone_numbers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own phone numbers" ON public.twilio_phone_numbers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone numbers" ON public.twilio_phone_numbers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phone numbers" ON public.twilio_phone_numbers
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for recordings
CREATE POLICY "Users can view their own recordings" ON public.twilio_recordings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recordings" ON public.twilio_recordings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recordings" ON public.twilio_recordings
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for transcriptions
CREATE POLICY "Users can view their own transcriptions" ON public.twilio_transcriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transcriptions" ON public.twilio_transcriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for campaigns
CREATE POLICY "Users can view their own campaigns" ON public.twilio_campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" ON public.twilio_campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" ON public.twilio_campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" ON public.twilio_campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations" ON public.twilio_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" ON public.twilio_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON public.twilio_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for analytics
CREATE POLICY "Users can view their own analytics" ON public.twilio_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analytics" ON public.twilio_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics" ON public.twilio_analytics
    FOR UPDATE USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_twilio_messages_updated_at BEFORE UPDATE ON public.twilio_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_calls_updated_at BEFORE UPDATE ON public.twilio_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_phone_numbers_updated_at BEFORE UPDATE ON public.twilio_phone_numbers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_recordings_updated_at BEFORE UPDATE ON public.twilio_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_transcriptions_updated_at BEFORE UPDATE ON public.twilio_transcriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_campaigns_updated_at BEFORE UPDATE ON public.twilio_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_conversations_updated_at BEFORE UPDATE ON public.twilio_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_analytics_updated_at BEFORE UPDATE ON public.twilio_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();