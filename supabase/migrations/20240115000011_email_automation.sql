-- Email automation rules table
CREATE TABLE IF NOT EXISTS email_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 100),
  conditions JSONB NOT NULL DEFAULT '[]',
  condition_logic TEXT DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),
  actions JSONB NOT NULL DEFAULT '[]',
  stop_on_match BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_email_rules_user_id ON email_automation_rules(user_id);
CREATE INDEX idx_email_rules_active ON email_automation_rules(active);
CREATE INDEX idx_email_rules_priority ON email_automation_rules(priority DESC);

-- Enable RLS
ALTER TABLE email_automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own email rules"
  ON email_automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email rules"
  ON email_automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email rules"
  ON email_automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email rules"
  ON email_automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Email automation rule statistics
CREATE TABLE IF NOT EXISTS email_automation_rule_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES email_automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  last_match TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_id, user_id)
);

-- Create indexes
CREATE INDEX idx_rule_stats_user_id ON email_automation_rule_stats(user_id);
CREATE INDEX idx_rule_stats_rule_id ON email_automation_rule_stats(rule_id);

-- Enable RLS
ALTER TABLE email_automation_rule_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stats
CREATE POLICY "Users can view their own rule stats"
  ON email_automation_rule_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Processed emails table
CREATE TABLE IF NOT EXISTS processed_emails (
  id TEXT PRIMARY KEY, -- Email ID from external system
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT,
  body TEXT,
  body_html TEXT,
  attachments JSONB,
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  priority INTEGER DEFAULT 5,
  automation_result JSONB,
  error_message TEXT,
  source TEXT DEFAULT 'webhook',
  message_id TEXT,
  in_reply_to TEXT,
  references TEXT[],
  headers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_processed_emails_user_id ON processed_emails(user_id);
CREATE INDEX idx_processed_emails_status ON processed_emails(status);
CREATE INDEX idx_processed_emails_received_at ON processed_emails(received_at DESC);
CREATE INDEX idx_processed_emails_priority ON processed_emails(priority DESC);
CREATE INDEX idx_processed_emails_from_email ON processed_emails(from_email);

-- Enable RLS
ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own processed emails"
  ON processed_emails
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert processed emails"
  ON processed_emails
  FOR INSERT
  WITH CHECK (true); -- Service role only

-- Email processing log
CREATE TABLE IF NOT EXISTS email_processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT NOT NULL,
  matched BOOLEAN DEFAULT false,
  rules TEXT[] DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  total_duration INTEGER,
  errors TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_processing_log_user_id ON email_processing_log(user_id);
CREATE INDEX idx_processing_log_email_id ON email_processing_log(email_id);
CREATE INDEX idx_processing_log_created_at ON email_processing_log(created_at DESC);

-- Enable RLS
ALTER TABLE email_processing_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own processing logs"
  ON email_processing_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Email queue for outgoing emails
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  attachments JSONB,
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  in_reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX idx_email_queue_priority ON email_queue(priority DESC);

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own email queue"
  ON email_queue
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create email queue entries"
  ON email_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Email tags
CREATE TABLE IF NOT EXISTS email_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_id, user_id, tag)
);

-- Create indexes
CREATE INDEX idx_email_tags_email_id ON email_tags(email_id);
CREATE INDEX idx_email_tags_user_id ON email_tags(user_id);
CREATE INDEX idx_email_tags_tag ON email_tags(tag);

-- Enable RLS
ALTER TABLE email_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own email tags"
  ON email_tags
  FOR ALL
  USING (auth.uid() = user_id);

-- Email assignments
CREATE TABLE IF NOT EXISTS email_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT NOT NULL,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(email_id, assigned_to)
);

-- Create indexes
CREATE INDEX idx_email_assignments_email_id ON email_assignments(email_id);
CREATE INDEX idx_email_assignments_assigned_to ON email_assignments(assigned_to);
CREATE INDEX idx_email_assignments_assigned_at ON email_assignments(assigned_at DESC);

-- Enable RLS
ALTER TABLE email_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view assignments they're involved in"
  ON email_assignments
  FOR SELECT
  USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);

CREATE POLICY "Users can create assignments"
  ON email_assignments
  FOR INSERT
  WITH CHECK (auth.uid() = assigned_by);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT,
  type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_email_id ON activity_log(email_id);
CREATE INDEX idx_activity_log_type ON activity_log(type);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activity log"
  ON activity_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create activity log entries"
  ON activity_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to get email processing stats
CREATE OR REPLACE FUNCTION get_email_processing_stats(
  p_user_id UUID,
  p_time_range TEXT DEFAULT '24h'
)
RETURNS TABLE (
  total BIGINT,
  processed BIGINT,
  pending BIGINT,
  failed BIGINT,
  avg_processing_time NUMERIC,
  success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  -- Convert time range to interval
  v_interval := CASE p_time_range
    WHEN '1h' THEN INTERVAL '1 hour'
    WHEN '24h' THEN INTERVAL '24 hours'
    WHEN '7d' THEN INTERVAL '7 days'
    WHEN '30d' THEN INTERVAL '30 days'
    ELSE INTERVAL '24 hours'
  END;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'processed')::BIGINT as processed,
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::BIGINT as pending,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed,
    COALESCE(AVG(
      CASE 
        WHEN automation_result->>'totalDuration' IS NOT NULL 
        THEN (automation_result->>'totalDuration')::NUMERIC 
        ELSE NULL 
      END
    ), 0) as avg_processing_time,
    CASE 
      WHEN COUNT(*) > 0 
      THEN (COUNT(*) FILTER (WHERE status = 'processed')::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0 
    END as success_rate
  FROM processed_emails
  WHERE user_id = p_user_id
    AND received_at >= NOW() - v_interval;
END;
$$;

-- Create function to get email processing timeline
CREATE OR REPLACE FUNCTION get_email_processing_timeline(
  p_user_id UUID,
  p_time_range TEXT DEFAULT '24h'
)
RETURNS TABLE (
  time TEXT,
  processed BIGINT,
  failed BIGINT,
  avg_duration NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval INTERVAL;
  v_bucket INTERVAL;
BEGIN
  -- Convert time range to interval and determine bucket size
  CASE p_time_range
    WHEN '1h' THEN 
      v_interval := INTERVAL '1 hour';
      v_bucket := INTERVAL '5 minutes';
    WHEN '24h' THEN 
      v_interval := INTERVAL '24 hours';
      v_bucket := INTERVAL '1 hour';
    WHEN '7d' THEN 
      v_interval := INTERVAL '7 days';
      v_bucket := INTERVAL '6 hours';
    WHEN '30d' THEN 
      v_interval := INTERVAL '30 days';
      v_bucket := INTERVAL '1 day';
    ELSE 
      v_interval := INTERVAL '24 hours';
      v_bucket := INTERVAL '1 hour';
  END CASE;
  
  RETURN QUERY
  SELECT 
    date_trunc('hour', series)::TEXT as time,
    COUNT(*) FILTER (WHERE pe.status = 'processed')::BIGINT as processed,
    COUNT(*) FILTER (WHERE pe.status = 'failed')::BIGINT as failed,
    COALESCE(AVG(
      CASE 
        WHEN pe.automation_result->>'totalDuration' IS NOT NULL 
        THEN (pe.automation_result->>'totalDuration')::NUMERIC 
        ELSE NULL 
      END
    ), 0) as avg_duration
  FROM generate_series(
    NOW() - v_interval,
    NOW(),
    v_bucket
  ) as series
  LEFT JOIN processed_emails pe 
    ON pe.user_id = p_user_id
    AND pe.received_at >= series - v_bucket
    AND pe.received_at < series
  GROUP BY series
  ORDER BY series;
END;
$$;

-- Create function to increment rule stats
CREATE OR REPLACE FUNCTION increment_rule_stats(
  p_rule_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO email_automation_rule_stats (
    rule_id,
    user_id,
    rule_name,
    matches,
    last_match
  )
  SELECT 
    p_rule_id,
    p_user_id,
    name,
    1,
    NOW()
  FROM email_automation_rules
  WHERE id = p_rule_id
  ON CONFLICT (rule_id, user_id) 
  DO UPDATE SET
    matches = email_automation_rule_stats.matches + 1,
    last_match = NOW(),
    updated_at = NOW();
END;
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_email_automation_rules_updated_at
  BEFORE UPDATE ON email_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_automation_rule_stats_updated_at
  BEFORE UPDATE ON email_automation_rule_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processed_emails_updated_at
  BEFORE UPDATE ON processed_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE email_automation_rules IS 'Stores user-defined email processing automation rules';
COMMENT ON TABLE processed_emails IS 'Tracks all emails processed through the system';
COMMENT ON TABLE email_processing_log IS 'Detailed log of email processing activities';
COMMENT ON TABLE email_queue IS 'Queue for outgoing email messages';
COMMENT ON TABLE email_tags IS 'User-defined tags for email organization';
COMMENT ON TABLE email_assignments IS 'Tracks email assignments to users';
COMMENT ON TABLE activity_log IS 'General activity log for email-related actions';