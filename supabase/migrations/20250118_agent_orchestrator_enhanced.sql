-- Enhanced Agent Orchestrator Schema
-- Create agent registry table for persistent agent management
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  handler TEXT NOT NULL,
  description TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent states table for real-time state management
CREATE TABLE IF NOT EXISTS public.agent_states (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle',
  progress INTEGER DEFAULT 0,
  current_task TEXT,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent performance metrics table
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.agent_executions(id) ON DELETE CASCADE,
  
  -- Performance metrics
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  success BOOLEAN,
  
  -- Resource usage
  memory_usage_mb REAL,
  cpu_usage_percent REAL,
  api_calls_count INTEGER DEFAULT 0,
  
  -- Quality metrics
  accuracy_score REAL,
  confidence_score REAL,
  user_satisfaction INTEGER, -- 1-5 rating
  
  -- Business metrics
  tasks_completed INTEGER DEFAULT 0,
  value_generated REAL,
  cost_incurred REAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent activity logs table for detailed tracking
CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.agent_executions(id) ON DELETE CASCADE,
  
  log_level TEXT NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent workload queue table
CREATE TABLE IF NOT EXISTS public.agent_workload_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  priority INTEGER DEFAULT 5, -- 1-10, higher is more important
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  
  task_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_agent_states_user_id ON public.agent_states(user_id);
CREATE INDEX idx_agent_states_agent_id ON public.agent_states(agent_id);
CREATE INDEX idx_agent_states_status ON public.agent_states(status);
CREATE INDEX idx_agent_states_last_activity ON public.agent_states(last_activity DESC);

CREATE INDEX idx_agent_performance_user_id ON public.agent_performance_metrics(user_id);
CREATE INDEX idx_agent_performance_agent_id ON public.agent_performance_metrics(agent_id);
CREATE INDEX idx_agent_performance_start_time ON public.agent_performance_metrics(start_time DESC);

CREATE INDEX idx_agent_activity_user_id ON public.agent_activity_logs(user_id);
CREATE INDEX idx_agent_activity_agent_id ON public.agent_activity_logs(agent_id);
CREATE INDEX idx_agent_activity_timestamp ON public.agent_activity_logs(timestamp DESC);
CREATE INDEX idx_agent_activity_log_level ON public.agent_activity_logs(log_level);

CREATE INDEX idx_agent_queue_user_id ON public.agent_workload_queue(user_id);
CREATE INDEX idx_agent_queue_agent_id ON public.agent_workload_queue(agent_id);
CREATE INDEX idx_agent_queue_status ON public.agent_workload_queue(status);
CREATE INDEX idx_agent_queue_priority ON public.agent_workload_queue(priority DESC);
CREATE INDEX idx_agent_queue_scheduled_at ON public.agent_workload_queue(scheduled_at);

-- Enable RLS on all tables
ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workload_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent_registry (readable by all authenticated users)
CREATE POLICY "Agent registry is readable by authenticated users"
  ON public.agent_registry
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policies for agent_states
CREATE POLICY "Users can view their own agent states"
  ON public.agent_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own agent states"
  ON public.agent_states
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for agent_performance_metrics
CREATE POLICY "Users can view their own agent performance metrics"
  ON public.agent_performance_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent performance metrics"
  ON public.agent_performance_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for agent_activity_logs
CREATE POLICY "Users can view their own agent activity logs"
  ON public.agent_activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent activity logs"
  ON public.agent_activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for agent_workload_queue
CREATE POLICY "Users can view their own workload queue"
  ON public.agent_workload_queue
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own workload queue"
  ON public.agent_workload_queue
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_agent_registry_updated_at
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_states_updated_at
  BEFORE UPDATE ON public.agent_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_workload_queue_updated_at
  BEFORE UPDATE ON public.agent_workload_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default agent registry entries
INSERT INTO public.agent_registry (id, name, type, handler, description, capabilities) VALUES
('lead-generation', 'Enhanced Lead Generation Agent', 'research', 'enhanced-lead-generation', 
 'AI-powered lead discovery with web scraping, qualification, scoring, enrichment, and Zoho CRM sync',
 '["Web Scraping", "Lead Qualification", "Data Enrichment", "CRM Integration"]'::jsonb),

('content-studio', 'AI Content Studio Ultra', 'creative', 'ai-content-studio',
 'Multi-agent content creation with market analysis, predictive analytics, and omni-channel distribution',
 '["Content Generation", "Market Analysis", "Trend Prediction", "Multi-platform Optimization"]'::jsonb),

('deep-thinking', 'Deep Thinking Orchestrator', 'orchestrator', 'deep-thinking-orchestrator',
 '5-agent collaborative system for complex problem solving with multi-perspective analysis',
 '["Problem Analysis", "Strategic Planning", "Solution Execution", "Result Validation"]'::jsonb),

('recruiter-intel', 'Recruiter Intel Agent', 'analytics', 'recruiter-intel',
 'Advanced analytics and intelligence gathering for recruitment optimization',
 '["Market Analytics", "Performance Metrics", "Competitive Intelligence", "Trend Analysis"]'::jsonb),

('resume-parser', 'Resume Parser Pipeline', 'processing', 'resume-parser',
 'Intelligent resume parsing with extraction, analysis, matching, and candidate ranking',
 '["Resume Parsing", "Skill Extraction", "Candidate Matching", "Automated Ranking"]'::jsonb),

('outreach-campaign', 'Outreach Campaign Manager', 'communication', 'outreach-campaign',
 'Automated outreach campaigns with personalization, timing optimization, and response tracking',
 '["Campaign Management", "Message Personalization", "Timing Optimization", "Response Tracking"]'::jsonb),

('interview-center', 'AI Interview Center', 'scheduling', 'interview-center',
 'Smart interview scheduling with calendar integration, question generation, and follow-up automation',
 '["Interview Scheduling", "Question Generation", "Calendar Integration", "Automated Follow-up"]'::jsonb),

('data-agent', 'Data Processing Agent', 'processing', 'data-agent',
 'Advanced data processing, analysis, and transformation for recruitment workflows',
 '["Data Processing", "ETL Operations", "Data Validation", "Report Generation"]'::jsonb),

('workflow-agent', 'Workflow Automation Agent', 'automation', 'workflow-agent',
 'Process automation and workflow orchestration across recruitment pipelines',
 '["Process Automation", "Workflow Orchestration", "Task Management", "Integration Coordination"]'::jsonb),

('linkedin-enrichment', 'LinkedIn Enrichment Agent', 'enrichment', 'linkedin-enrichment',
 'LinkedIn profile enrichment and social data gathering for enhanced candidate insights',
 '["Profile Enrichment", "Social Data Mining", "Network Analysis", "Professional Insights"]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  handler = EXCLUDED.handler,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  updated_at = NOW();

-- Grant necessary permissions
GRANT ALL ON public.agent_registry TO authenticated;
GRANT ALL ON public.agent_states TO authenticated;
GRANT ALL ON public.agent_performance_metrics TO authenticated;
GRANT ALL ON public.agent_activity_logs TO authenticated;
GRANT ALL ON public.agent_workload_queue TO authenticated;

-- Create functions for agent orchestrator operations

-- Function to get agent state with fallback to registry
CREATE OR REPLACE FUNCTION get_agent_state(p_agent_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  agent_state JSONB;
  agent_info JSONB;
BEGIN
  -- Get current state
  SELECT to_jsonb(s.*) INTO agent_state
  FROM agent_states s
  WHERE s.agent_id = p_agent_id AND s.user_id = p_user_id;
  
  -- Get agent registry info
  SELECT to_jsonb(r.*) INTO agent_info
  FROM agent_registry r
  WHERE r.id = p_agent_id;
  
  -- If no state exists, create default state
  IF agent_state IS NULL THEN
    INSERT INTO agent_states (id, user_id, agent_id, status, progress)
    VALUES (p_agent_id || '_' || p_user_id, p_user_id, p_agent_id, 'idle', 0)
    ON CONFLICT (id) DO NOTHING;
    
    agent_state := jsonb_build_object(
      'id', p_agent_id,
      'user_id', p_user_id,
      'agent_id', p_agent_id,
      'status', 'idle',
      'progress', 0,
      'last_activity', NOW()
    );
  END IF;
  
  -- Merge agent info with state
  RETURN agent_state || agent_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update agent state
CREATE OR REPLACE FUNCTION update_agent_state(
  p_agent_id TEXT,
  p_user_id UUID,
  p_status TEXT DEFAULT NULL,
  p_progress INTEGER DEFAULT NULL,
  p_current_task TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO agent_states (id, user_id, agent_id, status, progress, current_task, error_message, metadata, last_activity)
  VALUES (
    p_agent_id || '_' || p_user_id,
    p_user_id,
    p_agent_id,
    COALESCE(p_status, 'idle'),
    COALESCE(p_progress, 0),
    p_current_task,
    p_error_message,
    COALESCE(p_metadata, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    status = COALESCE(p_status, agent_states.status),
    progress = COALESCE(p_progress, agent_states.progress),
    current_task = COALESCE(p_current_task, agent_states.current_task),
    error_message = COALESCE(p_error_message, agent_states.error_message),
    metadata = COALESCE(p_metadata, agent_states.metadata),
    last_activity = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log agent activity
CREATE OR REPLACE FUNCTION log_agent_activity(
  p_agent_id TEXT,
  p_user_id UUID,
  p_log_level TEXT,
  p_message TEXT,
  p_details JSONB DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO agent_activity_logs (agent_id, user_id, log_level, message, details, execution_id)
  VALUES (p_agent_id, p_user_id, p_log_level, p_message, COALESCE(p_details, '{}'::jsonb), p_execution_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;