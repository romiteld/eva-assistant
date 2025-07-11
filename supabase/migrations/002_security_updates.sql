-- Security Updates Migration
-- Add api_logs table for audit trail

-- Create api_logs table
CREATE TABLE IF NOT EXISTS api_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    endpoint TEXT,
    method TEXT,
    status_code INTEGER,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX idx_api_logs_action ON api_logs(action);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);

-- Enable RLS on api_logs
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_logs
-- Users can only view their own logs
CREATE POLICY "Users can view own api logs" ON api_logs
    FOR SELECT USING (auth.uid() = user_id);

-- System can insert logs (using service role key)
CREATE POLICY "System can insert api logs" ON api_logs
    FOR INSERT WITH CHECK (true);

-- Add rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL, -- Can be user_id, ip_address, or api_key
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT now(),
    window_duration_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique constraint for rate limit tracking
CREATE UNIQUE INDEX idx_rate_limits_identifier_endpoint 
    ON rate_limits(identifier, endpoint, window_start);

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_max_requests INTEGER,
    p_window_minutes INTEGER DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_time TIMESTAMPTZ := now();
    v_window_start TIMESTAMPTZ := date_trunc('hour', v_current_time) + 
        (floor(extract(minute from v_current_time) / p_window_minutes) * p_window_minutes || ' minutes')::INTERVAL;
    v_count INTEGER;
BEGIN
    -- Insert or update rate limit record
    INSERT INTO rate_limits (identifier, endpoint, request_count, window_start, window_duration_minutes)
    VALUES (p_identifier, p_endpoint, 1, v_window_start, p_window_minutes)
    ON CONFLICT (identifier, endpoint, window_start) 
    DO UPDATE SET 
        request_count = rate_limits.request_count + 1,
        updated_at = v_current_time
    RETURNING request_count INTO v_count;
    
    -- Return true if under limit, false if exceeded
    RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql;

-- Add security-related columns to existing tables
-- Add metadata for security tracking to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS upload_ip TEXT,
ADD COLUMN IF NOT EXISTS content_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]';

-- Create function to validate file uploads
CREATE OR REPLACE FUNCTION validate_file_upload() RETURNS TRIGGER AS $$
BEGIN
    -- Check file size (10MB limit)
    IF NEW.file_size > 10485760 THEN
        RAISE EXCEPTION 'File size exceeds 10MB limit';
    END IF;
    
    -- Check file type
    IF NEW.file_type NOT IN (
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv'
    ) THEN
        RAISE EXCEPTION 'Invalid file type';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for file upload validation
CREATE TRIGGER validate_file_upload_trigger
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION validate_file_upload();

-- Create secure views for sensitive data
-- User profile view that excludes sensitive fields
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    CASE 
        WHEN auth.uid() = id THEN raw_user_meta_data
        ELSE jsonb_build_object('name', raw_user_meta_data->>'name')
    END as metadata
FROM auth.users;

-- Grant access to the view
GRANT SELECT ON user_profiles TO authenticated;

-- Add session management table for enhanced security
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_activity TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Create index for session lookups
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON user_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_active = false 
    WHERE expires_at < now() AND is_active = true;
    
    DELETE FROM user_sessions 
    WHERE expires_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up sessions (requires pg_cron extension)
-- This would be set up separately in Supabase dashboard or via SQL if pg_cron is enabled

-- Add security event logging
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- login_attempt, password_reset, suspicious_activity, etc.
    severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for security event queries
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_severity TEXT,
    p_details JSONB DEFAULT '{}',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO security_events (user_id, event_type, severity, details, ip_address, user_agent)
    VALUES (p_user_id, p_event_type, p_severity, p_details, p_ip_address, p_user_agent)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;