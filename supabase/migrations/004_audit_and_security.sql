-- Audit and Security Enhancements for EVA Assistant
-- This migration adds comprehensive audit logging and security features

-- ============================================================================
-- AUDIT SYSTEM
-- ============================================================================

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Comprehensive audit log table
CREATE TABLE audit.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for audit queries
CREATE INDEX idx_audit_logs_user_action ON audit.logs(user_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON audit.logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON audit.logs(created_at DESC);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit.create_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  audit_data JSONB;
  user_id UUID;
BEGIN
  -- Get the user ID from the session
  user_id := auth.uid();
  
  -- Prepare audit data
  IF TG_OP = 'DELETE' THEN
    audit_data := to_jsonb(OLD);
    INSERT INTO audit.logs (user_id, action, table_name, record_id, old_data)
    VALUES (user_id, TG_OP, TG_TABLE_NAME, OLD.id, audit_data);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit.logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (user_id, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit.logs (user_id, action, table_name, record_id, new_data)
    VALUES (user_id, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_oauth_credentials 
  AFTER INSERT OR UPDATE OR DELETE ON public.oauth_credentials 
  FOR EACH ROW EXECUTE FUNCTION audit.create_audit_trigger();

CREATE TRIGGER audit_organizations 
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations 
  FOR EACH ROW EXECUTE FUNCTION audit.create_audit_trigger();

CREATE TRIGGER audit_workflow_executions 
  AFTER INSERT OR UPDATE OR DELETE ON a2a.workflow_executions 
  FOR EACH ROW EXECUTE FUNCTION audit.create_audit_trigger();

CREATE TRIGGER audit_lead_scores 
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_scores 
  FOR EACH ROW EXECUTE FUNCTION audit.create_audit_trigger();

-- ============================================================================
-- ENCRYPTION HELPERS
-- ============================================================================

-- Function to encrypt sensitive data (requires pgcrypto extension)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted credentials view (hides raw tokens)
CREATE OR REPLACE VIEW public.oauth_credentials_secure AS
SELECT 
  id,
  user_id,
  provider,
  expires_at,
  scopes,
  metadata,
  last_refreshed,
  refresh_count,
  created_at,
  updated_at,
  CASE 
    WHEN expires_at < NOW() THEN 'expired'
    WHEN expires_at < NOW() + INTERVAL '5 minutes' THEN 'expiring_soon'
    ELSE 'valid'
  END AS token_status
FROM public.oauth_credentials;

-- Grant access to the secure view
GRANT SELECT ON public.oauth_credentials_secure TO authenticated;

-- ============================================================================
-- RATE LIMITING AND USAGE TRACKING
-- ============================================================================

-- API usage tracking
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  cost DECIMAL(10,6),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limit tracking
CREATE TABLE public.rate_limits (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, endpoint, window_start)
);

-- Function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  window_start := date_trunc('minute', NOW()) - 
    (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
  
  -- Get current count
  SELECT request_count INTO current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint 
    AND window_start = window_start;
  
  IF current_count IS NULL THEN
    -- First request in window
    INSERT INTO public.rate_limits (user_id, endpoint, window_start)
    VALUES (p_user_id, p_endpoint, window_start);
    RETURN TRUE;
  ELSIF current_count < p_limit THEN
    -- Under limit, increment
    UPDATE public.rate_limits 
    SET request_count = request_count + 1
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint 
      AND window_start = window_start;
    RETURN TRUE;
  ELSE
    -- Over limit
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA RETENTION AND CLEANUP
-- ============================================================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete old API usage logs (keep 90 days)
  DELETE FROM public.api_usage 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old rate limit entries
  DELETE FROM public.rate_limits 
  WHERE window_start < NOW() - INTERVAL '1 day';
  
  -- Delete expired agent memory
  DELETE FROM a2a.agent_memory 
  WHERE expires_at < NOW();
  
  -- Delete old websocket messages (keep 7 days)
  DELETE FROM public.websocket_messages 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  -- Archive old workflow executions (move to archive table)
  INSERT INTO a2a.workflow_executions_archive 
  SELECT * FROM a2a.workflow_executions 
  WHERE completed_at < NOW() - INTERVAL '30 days' 
    AND status IN ('completed', 'failed', 'cancelled');
  
  DELETE FROM a2a.workflow_executions 
  WHERE completed_at < NOW() - INTERVAL '30 days' 
    AND status IN ('completed', 'failed', 'cancelled');
END;
$$ LANGUAGE plpgsql;

-- Archive table for old executions
CREATE TABLE a2a.workflow_executions_archive (
  LIKE a2a.workflow_executions INCLUDING ALL
);

-- ============================================================================
-- SECURITY POLICIES
-- ============================================================================

-- Ensure audit logs are read-only for users
ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" ON audit.logs
  FOR SELECT USING (user_id = auth.uid());

-- API usage policies
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API usage" ON public.api_usage
  FOR SELECT USING (user_id = auth.uid());

-- Rate limit policies
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage rate limits" ON public.rate_limits
  FOR ALL USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- Agent performance view
CREATE OR REPLACE VIEW a2a.agent_performance AS
SELECT 
  a.name AS agent_name,
  a.type AS agent_type,
  COUNT(DISTINCT we.id) AS total_executions,
  AVG(rl.confidence) AS avg_confidence,
  AVG(rl.duration_ms) AS avg_duration_ms,
  SUM(rl.tokens_used) AS total_tokens_used,
  COUNT(CASE WHEN we.status = 'completed' THEN 1 END) AS successful_executions,
  COUNT(CASE WHEN we.status = 'failed' THEN 1 END) AS failed_executions,
  MAX(we.created_at) AS last_used
FROM a2a.agents a
LEFT JOIN a2a.reasoning_logs rl ON a.id = rl.agent_id
LEFT JOIN a2a.workflow_executions we ON rl.execution_id = we.id
GROUP BY a.id, a.name, a.type;

-- User activity summary
CREATE OR REPLACE VIEW public.user_activity_summary AS
SELECT 
  u.id AS user_id,
  u.email,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT t.id) AS total_tasks,
  COUNT(DISTINCT w.id) AS total_workflows,
  COUNT(DISTINCT we.id) AS workflow_executions,
  COUNT(DISTINCT sm.id) AS social_posts,
  MAX(c.created_at) AS last_conversation,
  MAX(we.created_at) AS last_workflow_execution
FROM public.users u
LEFT JOIN public.conversations c ON u.id = c.user_id
LEFT JOIN public.tasks t ON u.id = t.user_id
LEFT JOIN a2a.workflows w ON u.id = w.created_by
LEFT JOIN a2a.workflow_executions we ON u.id = we.user_id
LEFT JOIN public.social_media_posts sm ON u.id = sm.user_id
GROUP BY u.id, u.email;

-- ============================================================================
-- SCHEDULED JOBS (using pg_cron if available)
-- ============================================================================

-- Note: pg_cron must be enabled in Supabase dashboard
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup
-- SELECT cron.schedule(
--   'cleanup-old-data',
--   '0 2 * * *', -- 2 AM daily
--   'SELECT public.cleanup_old_data();'
-- );

-- Schedule hourly token refresh check
-- SELECT cron.schedule(
--   'check-expiring-tokens',
--   '0 * * * *', -- Every hour
--   'UPDATE public.oauth_credentials 
--    SET expires_at = expires_at 
--    WHERE expires_at < NOW() + INTERVAL ''10 minutes'';'
-- );

-- Grant necessary permissions
GRANT ALL ON SCHEMA audit TO postgres, service_role;
GRANT SELECT ON audit.logs TO authenticated;
GRANT SELECT ON a2a.agent_performance TO authenticated;
GRANT SELECT ON public.user_activity_summary TO authenticated;