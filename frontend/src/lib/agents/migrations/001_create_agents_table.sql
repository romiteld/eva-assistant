-- Create agents table with capacity tracking
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline', 'overloaded')),
    
    -- Capacity and workload tracking
    max_concurrent_tasks INTEGER DEFAULT 5,
    current_tasks INTEGER DEFAULT 0,
    total_capacity DECIMAL(5,2) DEFAULT 100.00, -- Percentage
    current_load DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    
    -- Performance metrics
    average_task_duration INTEGER, -- milliseconds
    success_rate DECIMAL(5,2) DEFAULT 100.00, -- Percentage
    total_tasks_completed INTEGER DEFAULT 0,
    total_tasks_failed INTEGER DEFAULT 0,
    
    -- Resource allocation
    cpu_usage DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    memory_usage DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    
    -- Specialized capabilities
    capabilities JSONB DEFAULT '[]'::jsonb,
    specializations JSONB DEFAULT '[]'::jsonb,
    
    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 5, -- 1-10, higher = more priority
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Health check
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(50) DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy'))
);

-- Create agent_tasks table for tracking task assignments
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    
    -- Task details
    task_type VARCHAR(100) NOT NULL,
    priority DECIMAL(3,2) DEFAULT 0.50, -- 0-1
    estimated_duration INTEGER, -- milliseconds
    actual_duration INTEGER, -- milliseconds
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'failed', 'cancelled')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Performance metrics
    cpu_usage DECIMAL(5,2), -- Percentage
    memory_usage DECIMAL(5,2), -- Percentage
    
    -- Result
    result JSONB,
    error JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent_metrics table for historical tracking
CREATE TABLE IF NOT EXISTS public.agent_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    
    -- Snapshot metrics
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    load_percentage DECIMAL(5,2) NOT NULL,
    active_tasks INTEGER NOT NULL,
    completed_tasks INTEGER NOT NULL,
    failed_tasks INTEGER NOT NULL,
    
    -- Resource metrics
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    
    -- Performance metrics
    average_response_time INTEGER, -- milliseconds
    success_rate DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_agents_current_load ON public.agents(current_load);
CREATE INDEX idx_agents_type ON public.agents(type);
CREATE INDEX idx_agent_tasks_agent_id ON public.agent_tasks(agent_id);
CREATE INDEX idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX idx_agent_tasks_assigned_at ON public.agent_tasks(assigned_at);
CREATE INDEX idx_agent_metrics_agent_id ON public.agent_metrics(agent_id);
CREATE INDEX idx_agent_metrics_timestamp ON public.agent_metrics(timestamp);

-- Create function to update agent load
CREATE OR REPLACE FUNCTION update_agent_load()
RETURNS TRIGGER AS $$
BEGIN
    -- Update current tasks count and load percentage
    UPDATE public.agents
    SET 
        current_tasks = (
            SELECT COUNT(*) 
            FROM public.agent_tasks 
            WHERE agent_id = NEW.agent_id 
            AND status IN ('assigned', 'in_progress')
        ),
        current_load = (
            SELECT LEAST(100, (COUNT(*) * 100.0 / NULLIF(max_concurrent_tasks, 0)))
            FROM public.agent_tasks 
            WHERE agent_id = NEW.agent_id 
            AND status IN ('assigned', 'in_progress')
        ),
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.agent_id;
    
    -- Update agent status based on load
    UPDATE public.agents
    SET status = CASE
        WHEN current_load >= 90 THEN 'overloaded'
        WHEN current_load > 0 THEN 'busy'
        ELSE 'available'
    END
    WHERE id = NEW.agent_id
    AND status != 'offline';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_agent_load_on_task_change
    AFTER INSERT OR UPDATE OR DELETE ON public.agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_load();

-- Create function to calculate agent score for load balancing
CREATE OR REPLACE FUNCTION calculate_agent_score(
    p_agent_id UUID,
    p_task_type VARCHAR,
    p_required_capabilities JSONB DEFAULT '[]'::jsonb
)
RETURNS DECIMAL AS $$
DECLARE
    v_score DECIMAL := 0;
    v_agent RECORD;
    v_capability JSONB;
BEGIN
    -- Get agent details
    SELECT * INTO v_agent FROM public.agents WHERE id = p_agent_id;
    
    -- Base score from availability (0-40 points)
    v_score := v_score + (40 * (1 - v_agent.current_load / 100));
    
    -- Success rate factor (0-20 points)
    v_score := v_score + (20 * v_agent.success_rate / 100);
    
    -- Priority factor (0-10 points)
    v_score := v_score + v_agent.priority;
    
    -- Capability match bonus (0-20 points)
    FOR v_capability IN SELECT * FROM jsonb_array_elements(p_required_capabilities)
    LOOP
        IF v_agent.capabilities @> v_capability THEN
            v_score := v_score + 5;
        END IF;
    END LOOP;
    
    -- Specialization bonus (0-10 points)
    IF v_agent.specializations ? p_task_type THEN
        v_score := v_score + 10;
    END IF;
    
    -- Health penalty
    IF v_agent.health_status = 'degraded' THEN
        v_score := v_score * 0.7;
    ELSIF v_agent.health_status = 'unhealthy' THEN
        v_score := v_score * 0.3;
    END IF;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Create view for agent dashboard
CREATE OR REPLACE VIEW agent_workload_summary AS
SELECT 
    a.id,
    a.name,
    a.type,
    a.status,
    a.current_tasks,
    a.max_concurrent_tasks,
    a.current_load,
    a.success_rate,
    a.health_status,
    COUNT(DISTINCT at.id) FILTER (WHERE at.status = 'completed' AND at.completed_at > NOW() - INTERVAL '1 hour') as tasks_last_hour,
    AVG(at.actual_duration) FILTER (WHERE at.status = 'completed' AND at.completed_at > NOW() - INTERVAL '1 hour') as avg_duration_last_hour
FROM public.agents a
LEFT JOIN public.agent_tasks at ON a.id = at.agent_id
GROUP BY a.id;

-- Enable Row Level Security
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
CREATE POLICY "Agents are viewable by authenticated users" ON public.agents
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Agent tasks are viewable by authenticated users" ON public.agent_tasks
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Agent metrics are viewable by authenticated users" ON public.agent_metrics
    FOR SELECT USING (auth.role() = 'authenticated');

-- Insert or update for admin users
CREATE POLICY "Admins can manage agents" ON public.agents
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage agent tasks" ON public.agent_tasks
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');