-- Create table for tracking deal creation performance metrics
CREATE TABLE IF NOT EXISTS deal_creation_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('email', 'template', 'quick', 'manual')),
  template_id TEXT,
  success BOOLEAN DEFAULT true,
  steps JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_deal_metrics_user_id ON deal_creation_metrics (user_id);
CREATE INDEX IF NOT EXISTS idx_deal_metrics_created_at ON deal_creation_metrics (created_at);
CREATE INDEX IF NOT EXISTS idx_deal_metrics_source ON deal_creation_metrics (source);
CREATE INDEX IF NOT EXISTS idx_deal_metrics_duration ON deal_creation_metrics (duration_ms);

-- Enable RLS
ALTER TABLE deal_creation_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own deal metrics"
  ON deal_creation_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deal metrics"
  ON deal_creation_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create view for aggregated metrics
CREATE OR REPLACE VIEW deal_creation_stats AS
SELECT 
  user_id,
  COUNT(*) as total_deals,
  COUNT(*) FILTER (WHERE success = true) as successful_deals,
  AVG(duration_ms) as avg_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  COUNT(*) FILTER (WHERE duration_ms < 30000) as under_30s_count,
  COUNT(*) FILTER (WHERE duration_ms < 10000) as under_10s_count,
  source,
  DATE_TRUNC('day', created_at) as day
FROM deal_creation_metrics
GROUP BY user_id, source, DATE_TRUNC('day', created_at);

-- Grant permissions
GRANT SELECT ON deal_creation_stats TO authenticated;

-- Add comments
COMMENT ON TABLE deal_creation_metrics IS 'Tracks performance metrics for deal creation automation';
COMMENT ON COLUMN deal_creation_metrics.duration_ms IS 'Total time in milliseconds for deal creation';
COMMENT ON COLUMN deal_creation_metrics.source IS 'Source of deal creation: email, template, quick, or manual';
COMMENT ON COLUMN deal_creation_metrics.steps IS 'JSON array of steps taken during deal creation with timestamps';