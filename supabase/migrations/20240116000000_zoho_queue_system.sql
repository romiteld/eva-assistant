-- Zoho API Queue System Tables

-- Queue for API requests
CREATE TABLE IF NOT EXISTS zoho_request_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
  payload JSONB,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queue processing
CREATE INDEX idx_zoho_queue_status_priority ON zoho_request_queue(status, priority DESC, scheduled_at);
CREATE INDEX idx_zoho_queue_user_id ON zoho_request_queue(user_id);
CREATE INDEX idx_zoho_queue_created_at ON zoho_request_queue(created_at);

-- Rate limit tracking per organization
CREATE TABLE IF NOT EXISTS zoho_rate_limit_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_remaining INTEGER DEFAULT 200,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_refill TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Cache table for Zoho data
CREATE TABLE IF NOT EXISTS zoho_cache (
  cache_key VARCHAR(500) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for cache
CREATE INDEX idx_zoho_cache_expires ON zoho_cache(expires_at);
CREATE INDEX idx_zoho_cache_user_module ON zoho_cache(user_id, module);

-- Queue processing history for analytics
CREATE TABLE IF NOT EXISTS zoho_queue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  peak_queue_size INTEGER,
  rate_limit_hits INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Batch processing tracking
CREATE TABLE IF NOT EXISTS zoho_batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_type VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  total_records INTEGER NOT NULL,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to clean up old queue entries
CREATE OR REPLACE FUNCTION cleanup_old_queue_entries()
RETURNS void AS $$
BEGIN
  -- Delete completed/failed requests older than 7 days
  DELETE FROM zoho_request_queue 
  WHERE status IN ('completed', 'failed') 
  AND created_at < NOW() - INTERVAL '7 days';
  
  -- Delete expired cache entries
  DELETE FROM zoho_cache 
  WHERE expires_at < NOW();
  
  -- Delete old analytics data (keep 90 days)
  DELETE FROM zoho_queue_analytics 
  WHERE date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update rate limit tokens
CREATE OR REPLACE FUNCTION update_rate_limit_tokens()
RETURNS void AS $$
BEGIN
  -- Refill tokens every minute (200 tokens per minute)
  UPDATE zoho_rate_limit_state
  SET 
    tokens_remaining = LEAST(200, tokens_remaining + 
      FLOOR(EXTRACT(EPOCH FROM (NOW() - last_refill)) / 60) * 200),
    last_refill = NOW(),
    updated_at = NOW()
  WHERE last_refill < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_zoho_request_queue_updated_at BEFORE UPDATE ON zoho_request_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoho_rate_limit_state_updated_at BEFORE UPDATE ON zoho_rate_limit_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoho_cache_updated_at BEFORE UPDATE ON zoho_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoho_queue_analytics_updated_at BEFORE UPDATE ON zoho_queue_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE zoho_request_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_rate_limit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_queue_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_batch_operations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own queue requests" ON zoho_request_queue
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own rate limit state" ON zoho_rate_limit_state
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own cache" ON zoho_cache
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics" ON zoho_queue_analytics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own batch operations" ON zoho_batch_operations
  FOR ALL USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE zoho_request_queue IS 'Queue for Zoho API requests with rate limiting and retry logic';
COMMENT ON TABLE zoho_rate_limit_state IS 'Tracks API rate limit state per organization';
COMMENT ON TABLE zoho_cache IS 'Cache for Zoho API responses to reduce API calls';
COMMENT ON TABLE zoho_queue_analytics IS 'Analytics data for queue performance monitoring';
COMMENT ON TABLE zoho_batch_operations IS 'Tracking for batch operations like bulk imports';