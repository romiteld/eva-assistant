-- Generic Queue System Tables

-- Main queue items table
CREATE TABLE IF NOT EXISTS public.queue_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_name VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queue processing
CREATE INDEX idx_queue_items_status_queue ON public.queue_items(queue_name, status, priority DESC, scheduled_at);
CREATE INDEX idx_queue_items_user_id ON public.queue_items(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_queue_items_created_at ON public.queue_items(created_at);
CREATE INDEX idx_queue_items_scheduled ON public.queue_items(scheduled_at) WHERE status = 'pending';

-- Queue statistics table for monitoring
CREATE TABLE IF NOT EXISTS public.queue_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hour INTEGER NOT NULL DEFAULT EXTRACT(HOUR FROM NOW()),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  max_queue_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(queue_name, date, hour)
);

-- Dead letter queue for failed items
CREATE TABLE IF NOT EXISTS public.queue_dead_letter (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_item_id UUID NOT NULL,
  queue_name VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  error_history JSONB[] DEFAULT ARRAY[]::JSONB[],
  retry_count INTEGER NOT NULL,
  last_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue configuration table
CREATE TABLE IF NOT EXISTS public.queue_config (
  queue_name VARCHAR(100) PRIMARY KEY,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  max_concurrency INTEGER DEFAULT 10,
  retry_delay_ms INTEGER DEFAULT 60000, -- 1 minute default
  max_retries INTEGER DEFAULT 3,
  retention_days INTEGER DEFAULT 7,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default queue configurations
INSERT INTO public.queue_config (queue_name, description, max_concurrency, retry_delay_ms) VALUES
  ('email-send', 'Email sending queue', 5, 60000),
  ('lead-enrichment', 'Lead data enrichment queue', 3, 30000),
  ('agent-execution', 'AI agent execution queue', 10, 5000),
  ('webhook-delivery', 'Webhook delivery queue', 20, 10000),
  ('document-processing', 'Document processing queue', 2, 120000),
  ('notification', 'Push notification queue', 50, 5000)
ON CONFLICT (queue_name) DO NOTHING;

-- Function to move failed items to dead letter queue
CREATE OR REPLACE FUNCTION move_to_dead_letter_queue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries THEN
    INSERT INTO public.queue_dead_letter (
      original_item_id,
      queue_name,
      user_id,
      payload,
      retry_count,
      last_error_message
    ) VALUES (
      NEW.id,
      NEW.queue_name,
      NEW.user_id,
      NEW.payload,
      NEW.retry_count,
      NEW.error_message
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to move failed items to dead letter queue
CREATE TRIGGER queue_items_dead_letter_trigger
  AFTER UPDATE OF status ON public.queue_items
  FOR EACH ROW
  WHEN (NEW.status = 'failed')
  EXECUTE FUNCTION move_to_dead_letter_queue();

-- Function to clean up old queue items
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS void AS $$
DECLARE
  config RECORD;
BEGIN
  -- Clean up based on retention configuration
  FOR config IN SELECT queue_name, retention_days FROM public.queue_config WHERE is_active = true LOOP
    DELETE FROM public.queue_items 
    WHERE queue_name = config.queue_name
      AND status IN ('completed', 'failed') 
      AND created_at < NOW() - (config.retention_days || ' days')::INTERVAL;
  END LOOP;
  
  -- Clean up dead letter queue (keep for 30 days)
  DELETE FROM public.queue_dead_letter 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old statistics (keep for 90 days)
  DELETE FROM public.queue_statistics 
  WHERE date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update queue statistics
CREATE OR REPLACE FUNCTION update_queue_statistics()
RETURNS void AS $$
BEGIN
  INSERT INTO public.queue_statistics (
    queue_name,
    date,
    hour,
    total_items,
    processed_items,
    failed_items,
    avg_processing_time_ms,
    max_queue_size
  )
  SELECT 
    queue_name,
    CURRENT_DATE,
    EXTRACT(HOUR FROM NOW()),
    COUNT(*) AS total_items,
    COUNT(*) FILTER (WHERE status = 'completed') AS processed_items,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_items,
    AVG(EXTRACT(EPOCH FROM (completed_at - processed_at)) * 1000)::INTEGER AS avg_processing_time_ms,
    COUNT(*) FILTER (WHERE status = 'pending') AS max_queue_size
  FROM public.queue_items
  WHERE created_at >= NOW() - INTERVAL '1 hour'
  GROUP BY queue_name
  ON CONFLICT (queue_name, date, hour) DO UPDATE SET
    total_items = EXCLUDED.total_items,
    processed_items = EXCLUDED.processed_items,
    failed_items = EXCLUDED.failed_items,
    avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
    max_queue_size = GREATEST(queue_statistics.max_queue_size, EXCLUDED.max_queue_size);
END;
$$ LANGUAGE plpgsql;

-- Function to get queue health metrics
CREATE OR REPLACE FUNCTION get_queue_health(p_queue_name VARCHAR DEFAULT NULL)
RETURNS TABLE (
  queue_name VARCHAR,
  pending_items BIGINT,
  processing_items BIGINT,
  failed_items BIGINT,
  success_rate NUMERIC,
  avg_wait_time_seconds NUMERIC,
  oldest_pending_item TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qi.queue_name,
    COUNT(*) FILTER (WHERE qi.status = 'pending') AS pending_items,
    COUNT(*) FILTER (WHERE qi.status = 'processing') AS processing_items,
    COUNT(*) FILTER (WHERE qi.status = 'failed') AS failed_items,
    CASE 
      WHEN COUNT(*) FILTER (WHERE qi.status IN ('completed', 'failed')) > 0
      THEN (COUNT(*) FILTER (WHERE qi.status = 'completed')::NUMERIC / 
            COUNT(*) FILTER (WHERE qi.status IN ('completed', 'failed'))) * 100
      ELSE 100
    END AS success_rate,
    AVG(EXTRACT(EPOCH FROM (NOW() - qi.created_at))) FILTER (WHERE qi.status = 'pending') AS avg_wait_time_seconds,
    MIN(qi.created_at) FILTER (WHERE qi.status = 'pending') AS oldest_pending_item
  FROM public.queue_items qi
  WHERE (p_queue_name IS NULL OR qi.queue_name = p_queue_name)
    AND qi.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY qi.queue_name;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE TRIGGER update_queue_items_updated_at BEFORE UPDATE ON public.queue_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_config_updated_at BEFORE UPDATE ON public.queue_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_dead_letter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for queue_items
CREATE POLICY "Users can view their own queue items" ON public.queue_items
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create their own queue items" ON public.queue_items
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own queue items" ON public.queue_items
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

-- RLS Policies for queue_statistics (read-only for authenticated users)
CREATE POLICY "Authenticated users can view queue statistics" ON public.queue_statistics
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for queue_dead_letter
CREATE POLICY "Users can view their own dead letter items" ON public.queue_dead_letter
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- RLS Policies for queue_config (read-only for authenticated users)
CREATE POLICY "Authenticated users can view queue config" ON public.queue_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Comments
COMMENT ON TABLE public.queue_items IS 'Generic queue system for background job processing';
COMMENT ON TABLE public.queue_statistics IS 'Hourly statistics for queue monitoring';
COMMENT ON TABLE public.queue_dead_letter IS 'Failed items that exceeded retry limits';
COMMENT ON TABLE public.queue_config IS 'Configuration for each queue type';