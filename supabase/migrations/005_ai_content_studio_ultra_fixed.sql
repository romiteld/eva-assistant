-- AI Content Studio Ultra Tables (Fixed)

-- Create tables only if they don't exist
CREATE TABLE IF NOT EXISTS public.ultra_content_generations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    request jsonb NOT NULL,
    market_intelligence jsonb,
    content_variations jsonb[],
    reasoning_chains jsonb[],
    performance_predictions jsonb,
    ml_optimizations jsonb,
    visual_concepts jsonb[],
    multimedia_assets jsonb[],
    distribution_strategy jsonb,
    final_package jsonb,
    confidence float8,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Table already exists, skip creation
-- CREATE TABLE IF NOT EXISTS public.content_performance_tracking

CREATE TABLE IF NOT EXISTS public.content_ab_tests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    generation_id uuid REFERENCES ultra_content_generations(id) ON DELETE CASCADE,
    variant_a jsonb NOT NULL,
    variant_b jsonb NOT NULL,
    test_config jsonb,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    winner text,
    results jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    platform text NOT NULL,
    template_data jsonb NOT NULL,
    performance_stats jsonb,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competitor_analysis_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    url text UNIQUE NOT NULL,
    analysis_data jsonb NOT NULL,
    platform text,
    last_analyzed timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_insights (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    generation_id uuid REFERENCES ultra_content_generations(id) ON DELETE CASCADE,
    insight_type text NOT NULL,
    data jsonb NOT NULL,
    confidence float8,
    created_at timestamp with time zone DEFAULT now()
);

-- Create indexes with IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_ultra_generations_user ON ultra_content_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ultra_generations_status ON ultra_content_generations(status);
CREATE INDEX IF NOT EXISTS idx_ultra_generations_created ON ultra_content_generations(created_at DESC);

-- Skip this index as it already exists
-- CREATE INDEX IF NOT EXISTS idx_content_performance_generation ON content_performance_tracking(generation_id);

CREATE INDEX IF NOT EXISTS idx_ab_tests_generation ON content_ab_tests(generation_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_dates ON content_ab_tests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_templates_user ON content_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_platform ON content_templates(platform);

CREATE INDEX IF NOT EXISTS idx_competitor_url ON competitor_analysis_cache(url);
CREATE INDEX IF NOT EXISTS idx_competitor_analyzed ON competitor_analysis_cache(last_analyzed);

CREATE INDEX IF NOT EXISTS idx_insights_generation ON content_insights(generation_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON content_insights(insight_type);

-- Enable RLS
ALTER TABLE ultra_content_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own ultra content generations"
    ON ultra_content_generations FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their related AB tests"
    ON content_ab_tests FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM ultra_content_generations
        WHERE ultra_content_generations.id = content_ab_tests.generation_id
        AND ultra_content_generations.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own content templates"
    ON content_templates FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "All authenticated users can view competitor analysis"
    ON competitor_analysis_cache FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view insights for their content"
    ON content_insights FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM ultra_content_generations
        WHERE ultra_content_generations.id = content_insights.generation_id
        AND ultra_content_generations.user_id = auth.uid()
    ));

-- Create helper functions
CREATE OR REPLACE FUNCTION increment_template_usage(template_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE content_templates
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_trending_content(
    p_platform text DEFAULT NULL,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    content_id uuid,
    platform text,
    engagement_rate float8,
    virality_score float8,
    performance_data jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id as content_id,
        g.request->>'platform' as platform,
        (p.metrics->>'engagement_rate')::float8 as engagement_rate,
        (g.performance_predictions->>'viralityScore')::float8 as virality_score,
        p.metrics as performance_data
    FROM ultra_content_generations g
    LEFT JOIN content_performance p ON g.id = p.generation_id
    WHERE (p_platform IS NULL OR g.request->>'platform' = p_platform)
    AND g.status = 'completed'
    ORDER BY 
        COALESCE((p.metrics->>'engagement_rate')::float8, 0) DESC,
        g.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ultra_generations_updated_at BEFORE UPDATE ON ultra_content_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();