-- Create error_logs table for persisting critical errors
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    context JSONB,
    stack TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    user_agent TEXT,
    url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Create indexes for efficient querying
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX idx_error_logs_category ON public.error_logs(category);
CREATE INDEX idx_error_logs_session_id ON public.error_logs(session_id);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow authenticated users to insert their own errors
CREATE POLICY "Users can insert their own errors"
    ON public.error_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to view their own errors
CREATE POLICY "Users can view their own errors"
    ON public.error_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Create a function to clean up old error logs
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete error logs older than 30 days that are not critical
    DELETE FROM public.error_logs
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND severity != 'critical';
    
    -- Delete resolved error logs older than 90 days
    DELETE FROM public.error_logs
    WHERE resolved_at IS NOT NULL
    AND resolved_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Create error summary view for dashboard
CREATE OR REPLACE VIEW public.error_summary AS
SELECT 
    category,
    severity,
    COUNT(*) as error_count,
    MAX(created_at) as last_occurred,
    COUNT(DISTINCT user_id) as affected_users,
    COUNT(DISTINCT session_id) as affected_sessions
FROM public.error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY category, severity;

-- Grant access to the view
GRANT SELECT ON public.error_summary TO authenticated;