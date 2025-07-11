-- Multi-Agent System Schema for EVA Assistant
-- This migration creates the foundation for the enhanced agent-to-agent (a2a) system
-- with deep reasoning capabilities and specialized agent types

-- Create a2a schema for agent-related tables
CREATE SCHEMA IF NOT EXISTS a2a;

-- ============================================================================
-- AGENT DEFINITIONS AND CONFIGURATION
-- ============================================================================

-- Agent definitions table
CREATE TABLE a2a.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('orchestrator', 'specialist', 'tool', 'reasoning', 'validator')),
  description TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_config JSONB DEFAULT '{}'::jsonb, -- Model-specific settings (temperature, max_tokens, etc.)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows table for agent coordination
CREATE TABLE a2a.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  graph_definition JSONB NOT NULL, -- LangGraph state definition
  input_schema JSONB, -- Expected input format
  output_schema JSONB, -- Expected output format
  created_by UUID REFERENCES auth.users(id),
  is_template BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions tracking
CREATE TABLE a2a.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES a2a.workflows(id),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DEEP REASONING AND MEMORY SYSTEM
-- ============================================================================

-- Agent reasoning logs for deep thinking chains
CREATE TABLE a2a.reasoning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES a2a.workflow_executions(id),
  agent_id UUID REFERENCES a2a.agents(id),
  step_number INTEGER NOT NULL,
  reasoning_type TEXT CHECK (reasoning_type IN ('analysis', 'planning', 'decision', 'validation', 'reflection')),
  thought_process JSONB NOT NULL, -- Detailed reasoning steps
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  evidence JSONB, -- Supporting data/sources
  alternatives_considered JSONB, -- Other options that were evaluated
  duration_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent memory/context storage
CREATE TABLE a2a.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES a2a.agents(id),
  memory_type TEXT CHECK (memory_type IN ('short_term', 'long_term', 'episodic', 'semantic', 'procedural')),
  content JSONB NOT NULL,
  embedding vector(1536), -- For semantic search
  importance_score NUMERIC(3,2) DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent interactions log
CREATE TABLE a2a.agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES a2a.workflow_executions(id),
  from_agent_id UUID REFERENCES a2a.agents(id),
  to_agent_id UUID REFERENCES a2a.agents(id),
  interaction_type TEXT CHECK (interaction_type IN ('request', 'response', 'delegation', 'validation', 'feedback')),
  message JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BUSINESS DOMAIN TABLES
-- ============================================================================

-- Organizations table for company tracking
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  employee_count_range TEXT,
  revenue_range TEXT,
  website TEXT,
  linkedin_url TEXT,
  description TEXT,
  headquarters_location TEXT,
  founded_year INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  search_vector tsvector,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth credentials storage (encrypted)
CREATE TABLE public.oauth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('microsoft', 'google', 'linkedin', 'zoom', 'salesforce')),
  access_token TEXT, -- Should be encrypted at application level
  refresh_token TEXT, -- Should be encrypted at application level
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB,
  last_refreshed TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Social media posts with AI analytics
CREATE TABLE public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'facebook', 'instagram')),
  content TEXT,
  media_urls TEXT[],
  hashtags TEXT[],
  mentions TEXT[],
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  ai_generated BOOLEAN DEFAULT FALSE,
  generation_prompt TEXT,
  prediction_score NUMERIC(3,2), -- AI-predicted engagement score
  actual_engagement JSONB, -- Likes, shares, comments, etc.
  analytics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor analyses
CREATE TABLE public.competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  analysis_type TEXT CHECK (analysis_type IN ('market_position', 'talent', 'technology', 'strategy', 'financial')),
  findings JSONB NOT NULL,
  data_sources JSONB, -- URLs, documents, etc.
  confidence_score NUMERIC(3,2),
  key_insights TEXT[],
  recommendations TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead scoring and qualification
CREATE TABLE public.lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  score NUMERIC(3,2) CHECK (score >= 0 AND score <= 1),
  scoring_factors JSONB, -- Individual factor scores
  qualification_status TEXT CHECK (qualification_status IN ('hot', 'warm', 'cold', 'disqualified')),
  next_action_recommended TEXT,
  ai_insights TEXT[],
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Agent system indexes
CREATE INDEX idx_a2a_agents_type ON a2a.agents(type) WHERE status = 'active';
CREATE INDEX idx_a2a_agents_name ON a2a.agents(name);

CREATE INDEX idx_a2a_workflows_created_by ON a2a.workflows(created_by);
CREATE INDEX idx_a2a_workflows_tags ON a2a.workflows USING gin(tags);

CREATE INDEX idx_a2a_executions_workflow ON a2a.workflow_executions(workflow_id);
CREATE INDEX idx_a2a_executions_user_status ON a2a.workflow_executions(user_id, status);
CREATE INDEX idx_a2a_executions_status_time ON a2a.workflow_executions(status, created_at DESC);

CREATE INDEX idx_a2a_reasoning_execution ON a2a.reasoning_logs(execution_id);
CREATE INDEX idx_a2a_reasoning_agent_type ON a2a.reasoning_logs(agent_id, reasoning_type);

CREATE INDEX idx_a2a_memory_agent_type ON a2a.agent_memory(agent_id, memory_type);
CREATE INDEX idx_a2a_memory_embedding ON a2a.agent_memory USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_a2a_memory_importance ON a2a.agent_memory(importance_score DESC) WHERE expires_at IS NULL OR expires_at > NOW();

-- Business domain indexes
CREATE INDEX idx_organizations_search ON public.organizations USING gin(search_vector);
CREATE INDEX idx_organizations_industry ON public.organizations(industry);
CREATE INDEX idx_organizations_size ON public.organizations(size);

CREATE INDEX idx_oauth_user_provider ON public.oauth_credentials(user_id, provider);
CREATE INDEX idx_oauth_expires ON public.oauth_credentials(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_social_posts_user_status ON public.social_media_posts(user_id, status);
CREATE INDEX idx_social_posts_scheduled ON public.social_media_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_platform ON public.social_media_posts(platform, published_at DESC);

CREATE INDEX idx_competitor_org ON public.competitor_analyses(organization_id);
CREATE INDEX idx_competitor_type ON public.competitor_analyses(analysis_type);

CREATE INDEX idx_lead_scores_candidate ON public.lead_scores(candidate_id);
CREATE INDEX idx_lead_scores_qualification ON public.lead_scores(qualification_status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE a2a.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a.reasoning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a.agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;

-- Agent system policies (admins only for now, can be expanded)
CREATE POLICY "Admins can manage agents" ON a2a.agents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Workflow policies
CREATE POLICY "Users can view own workflows" ON a2a.workflows
  FOR SELECT USING (created_by = auth.uid() OR is_template = true);

CREATE POLICY "Users can create workflows" ON a2a.workflows
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own workflows" ON a2a.workflows
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own workflows" ON a2a.workflows
  FOR DELETE USING (created_by = auth.uid());

-- Execution policies
CREATE POLICY "Users can view own executions" ON a2a.workflow_executions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create executions" ON a2a.workflow_executions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Business domain policies
CREATE POLICY "Users can manage organizations" ON public.organizations
  FOR ALL USING (true); -- All users can view/manage organizations for now

CREATE POLICY "Users can manage own oauth credentials" ON public.oauth_credentials
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage own social posts" ON public.social_media_posts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view competitor analyses" ON public.competitor_analyses
  FOR SELECT USING (true);

CREATE POLICY "Users can create competitor analyses" ON public.competitor_analyses
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view lead scores" ON public.lead_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.candidates
      WHERE candidates.id = lead_scores.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Update search vector for organizations
CREATE OR REPLACE FUNCTION update_organization_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_search_vector_trigger
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION update_organization_search_vector();

-- Auto-update updated_at timestamps
CREATE TRIGGER update_a2a_agents_updated_at BEFORE UPDATE ON a2a.agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_a2a_workflows_updated_at BEFORE UPDATE ON a2a.workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_oauth_credentials_updated_at BEFORE UPDATE ON public.oauth_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_social_media_posts_updated_at BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SEED DATA FOR AGENT SYSTEM
-- ============================================================================

-- Insert the 5 core agents
INSERT INTO a2a.agents (name, type, description, capabilities, config) VALUES
('analysis_agent', 'reasoning', 'Deep analysis agent for understanding user intent and context', 
 '["intent_analysis", "entity_extraction", "context_understanding", "pattern_recognition"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.3, "max_thinking_steps": 10}'::jsonb),

('planning_agent', 'reasoning', 'Strategic planning agent for workflow optimization',
 '["workflow_design", "resource_allocation", "path_optimization", "risk_assessment"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.5, "max_alternatives": 3}'::jsonb),

('execution_agent', 'orchestrator', 'Main execution agent that coordinates specialist agents',
 '["task_delegation", "progress_monitoring", "error_handling", "adaptation"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.7, "retry_attempts": 3}'::jsonb),

('validation_agent', 'validator', 'Quality assurance and validation agent',
 '["result_validation", "consistency_checking", "accuracy_verification", "compliance_check"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.2, "validation_threshold": 0.8}'::jsonb),

('learning_agent', 'reasoning', 'Learning and improvement agent',
 '["pattern_extraction", "performance_analysis", "knowledge_update", "optimization"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.4, "learning_rate": 0.1}'::jsonb),

-- Specialist agents
('lead_generation_agent', 'specialist', 'Specialized agent for discovering and qualifying leads',
 '["web_search", "data_extraction", "lead_scoring", "enrichment"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.6, "search_depth": 3}'::jsonb),

('content_generation_agent', 'specialist', 'AI content creation with performance prediction',
 '["content_writing", "tone_adaptation", "performance_prediction", "optimization"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.8, "variation_count": 3}'::jsonb),

('outreach_agent', 'specialist', 'Personalized outreach and communication agent',
 '["message_personalization", "timing_optimization", "channel_selection", "follow_up"]'::jsonb,
 '{"model": "gpt-4", "temperature": 0.7, "personalization_depth": "high"}'::jsonb);

-- Insert a template workflow
INSERT INTO a2a.workflows (name, description, graph_definition, is_template) VALUES
('lead_generation_workflow', 
 'Comprehensive lead generation workflow with deep analysis',
 '{
   "nodes": [
     {"id": "analysis", "agent": "analysis_agent", "type": "reasoning"},
     {"id": "planning", "agent": "planning_agent", "type": "reasoning"},
     {"id": "execution", "agent": "execution_agent", "type": "orchestrator"},
     {"id": "validation", "agent": "validation_agent", "type": "validator"},
     {"id": "learning", "agent": "learning_agent", "type": "reasoning"}
   ],
   "edges": [
     {"from": "analysis", "to": "planning", "condition": "confidence > 0.7"},
     {"from": "planning", "to": "execution", "condition": "plan_valid"},
     {"from": "execution", "to": "validation", "condition": "execution_complete"},
     {"from": "validation", "to": "learning", "condition": "always"},
     {"from": "planning", "to": "learning", "condition": "confidence <= 0.7"}
   ]
 }'::jsonb,
 true);

-- Grant necessary permissions
GRANT ALL ON SCHEMA a2a TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA a2a TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA a2a TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA a2a TO anon, authenticated, service_role;