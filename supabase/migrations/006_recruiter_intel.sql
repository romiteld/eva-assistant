-- Recruiter Intel Database Schema
-- This migration creates tables for comprehensive recruiter tracking and analytics

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recruiter profiles table
CREATE TABLE public.recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    linkedin_url TEXT,
    company_name TEXT,
    company_type TEXT CHECK (company_type IN ('agency', 'independent', 'internal', 'executive_search')),
    specializations TEXT[], -- ['financial_advisory', 'wealth_management', 'investment_banking', etc.]
    industry_focus TEXT[], -- ['banking', 'insurance', 'asset_management', etc.]
    geographic_coverage TEXT[], -- ['northeast', 'midwest', 'west_coast', etc.]
    experience_years INTEGER,
    commission_structure JSONB DEFAULT '{}', -- {type: 'percentage', rate: 20, minimum_fee: 5000}
    performance_tier TEXT CHECK (performance_tier IN ('platinum', 'gold', 'silver', 'bronze')),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruiter performance metrics table (time-series data)
CREATE TABLE public.recruiter_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    
    -- Placement metrics
    placements_count INTEGER DEFAULT 0,
    interviews_scheduled INTEGER DEFAULT 0,
    candidates_submitted INTEGER DEFAULT 0,
    offers_extended INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    
    -- Financial metrics
    total_revenue DECIMAL(12,2) DEFAULT 0,
    average_placement_fee DECIMAL(12,2),
    highest_placement_fee DECIMAL(12,2),
    
    -- Performance ratios
    submission_to_interview_ratio DECIMAL(5,2), -- interviews/submissions
    interview_to_offer_ratio DECIMAL(5,2), -- offers/interviews
    offer_acceptance_ratio DECIMAL(5,2), -- accepted/extended
    fill_rate DECIMAL(5,2), -- placements/job_orders
    
    -- Time metrics
    time_to_fill_avg INTEGER, -- average days from job order to placement
    time_to_submit_avg INTEGER, -- average days from job order to first submission
    
    -- Quality metrics
    placement_retention_rate DECIMAL(5,2), -- % of placements still employed after 90 days
    candidate_quality_score DECIMAL(3,2), -- 0-10 scale
    client_satisfaction_score DECIMAL(3,2), -- 0-10 scale
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(recruiter_id, period_start, period_end, period_type)
);

-- Recruiter-candidate relationships
CREATE TABLE public.recruiter_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE SET NULL,
    
    -- Relationship details
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('sourced', 'submitted', 'interviewing', 'offered', 'placed', 'rejected', 'withdrawn')),
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'completed')),
    
    -- Key dates
    first_contact_date TIMESTAMPTZ,
    submission_date TIMESTAMPTZ,
    interview_dates TIMESTAMPTZ[],
    offer_date TIMESTAMPTZ,
    placement_date TIMESTAMPTZ,
    
    -- Financial details
    placement_fee DECIMAL(12,2),
    fee_percentage DECIMAL(5,2),
    guarantee_period_days INTEGER DEFAULT 90,
    guarantee_end_date DATE,
    
    -- Quality tracking
    candidate_rating INTEGER CHECK (candidate_rating BETWEEN 1 AND 5),
    client_feedback TEXT,
    placement_outcome TEXT CHECK (placement_outcome IN ('successful', 'guarantee_period', 'terminated', 'resigned', NULL)),
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(recruiter_id, candidate_id, job_posting_id)
);

-- Recruiter activity log
CREATE TABLE public.recruiter_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'submission', 'interview_scheduled', 'offer_negotiation', 'placement', 'note')),
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Related entities
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE SET NULL,
    -- deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL, -- removed until deals table exists
    
    -- Activity details
    duration_minutes INTEGER,
    outcome TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruiter rankings and benchmarks
CREATE TABLE public.recruiter_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    ranking_type TEXT NOT NULL CHECK (ranking_type IN ('overall', 'by_revenue', 'by_placements', 'by_quality', 'by_speed')),
    
    rankings JSONB NOT NULL, -- [{recruiter_id, rank, score, metrics: {...}}]
    
    -- Benchmark statistics
    avg_placements DECIMAL(10,2),
    avg_revenue DECIMAL(12,2),
    avg_fill_rate DECIMAL(5,2),
    avg_time_to_fill INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(period_start, period_end, ranking_type)
);

-- Create indexes for performance
CREATE INDEX idx_recruiters_user_id ON public.recruiters(user_id);
CREATE INDEX idx_recruiters_email ON public.recruiters(email);
CREATE INDEX idx_recruiters_company ON public.recruiters(company_name);
CREATE INDEX idx_recruiters_active ON public.recruiters(is_active);
CREATE INDEX idx_recruiters_specializations ON public.recruiters USING GIN(specializations);

CREATE INDEX idx_recruiter_metrics_recruiter ON public.recruiter_metrics(recruiter_id);
CREATE INDEX idx_recruiter_metrics_period ON public.recruiter_metrics(period_start, period_end);

CREATE INDEX idx_recruiter_candidates_recruiter ON public.recruiter_candidates(recruiter_id);
CREATE INDEX idx_recruiter_candidates_candidate ON public.recruiter_candidates(candidate_id);
CREATE INDEX idx_recruiter_candidates_status ON public.recruiter_candidates(status);
CREATE INDEX idx_recruiter_candidates_type ON public.recruiter_candidates(relationship_type);

CREATE INDEX idx_recruiter_activities_recruiter ON public.recruiter_activities(recruiter_id);
CREATE INDEX idx_recruiter_activities_date ON public.recruiter_activities(activity_date);
CREATE INDEX idx_recruiter_activities_type ON public.recruiter_activities(activity_type);

-- Enable Row Level Security
ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Recruiters table: Users can see all recruiters but only edit their own
CREATE POLICY "Users can view all recruiters" ON public.recruiters
    FOR SELECT USING (true);

CREATE POLICY "Users can insert recruiters" ON public.recruiters
    FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Users can update own recruiter profile" ON public.recruiters
    FOR UPDATE USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Metrics: Everyone can view, admins can modify
CREATE POLICY "Users can view recruiter metrics" ON public.recruiter_metrics
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage recruiter metrics" ON public.recruiter_metrics
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Candidates relationships: View all, modify with permissions
CREATE POLICY "Users can view recruiter candidates" ON public.recruiter_candidates
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own recruiter candidates" ON public.recruiter_candidates
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.recruiters WHERE id = recruiter_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Activities: View all, create own
CREATE POLICY "Users can view recruiter activities" ON public.recruiter_activities
    FOR SELECT USING (true);

CREATE POLICY "Users can create own activities" ON public.recruiter_activities
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM public.recruiters WHERE id = recruiter_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Rankings: Everyone can view
CREATE POLICY "Users can view rankings" ON public.recruiter_rankings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage rankings" ON public.recruiter_rankings
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_recruiters_updated_at BEFORE UPDATE ON public.recruiters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recruiter_metrics_updated_at BEFORE UPDATE ON public.recruiter_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recruiter_candidates_updated_at BEFORE UPDATE ON public.recruiter_candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for recruiter dashboard
CREATE VIEW public.recruiter_dashboard AS
SELECT 
    r.id,
    r.full_name,
    r.email,
    r.company_name,
    r.performance_tier,
    r.is_active,
    COALESCE(
        (SELECT COUNT(*) FROM public.recruiter_candidates rc 
         WHERE rc.recruiter_id = r.id AND rc.relationship_type = 'placed'
         AND rc.placement_date >= CURRENT_DATE - INTERVAL '90 days'),
        0
    ) as recent_placements,
    COALESCE(
        (SELECT SUM(placement_fee) FROM public.recruiter_candidates rc 
         WHERE rc.recruiter_id = r.id AND rc.relationship_type = 'placed'
         AND rc.placement_date >= CURRENT_DATE - INTERVAL '90 days'),
        0
    ) as recent_revenue,
    COALESCE(
        (SELECT COUNT(*) FROM public.recruiter_candidates rc 
         WHERE rc.recruiter_id = r.id AND rc.status = 'active'),
        0
    ) as active_candidates,
    COALESCE(
        (SELECT MAX(activity_date) FROM public.recruiter_activities ra 
         WHERE ra.recruiter_id = r.id),
        r.created_at
    ) as last_activity
FROM public.recruiters r;

-- Grant permissions on view
GRANT SELECT ON public.recruiter_dashboard TO authenticated;