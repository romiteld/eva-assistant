-- Create post_predictions table
CREATE TABLE IF NOT EXISTS public.post_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'facebook')),
    predictions JSONB NOT NULL,
    optimal_timing JSONB NOT NULL,
    content_analysis JSONB NOT NULL,
    suggestions JSONB NOT NULL,
    platform_insights JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_post_predictions_user_id ON public.post_predictions(user_id);
CREATE INDEX idx_post_predictions_platform ON public.post_predictions(platform);
CREATE INDEX idx_post_predictions_created_at ON public.post_predictions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.post_predictions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own predictions"
    ON public.post_predictions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own predictions"
    ON public.post_predictions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions"
    ON public.post_predictions
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own predictions"
    ON public.post_predictions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.post_predictions TO authenticated;
GRANT SELECT ON public.post_predictions TO anon;