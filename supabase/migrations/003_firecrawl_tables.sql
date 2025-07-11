-- Create tables for Firecrawl integration

-- Table for storing Firecrawl jobs
CREATE TABLE IF NOT EXISTS firecrawl_jobs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('scrape', 'crawl', 'map', 'search', 'extract')),
    url TEXT NOT NULL,
    options JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    firecrawl_job_id TEXT,
    result JSONB,
    error TEXT,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for storing scraped data
CREATE TABLE IF NOT EXISTS firecrawl_scraped_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT REFERENCES firecrawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    markdown TEXT,
    metadata JSONB,
    scraped_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for storing crawl results
CREATE TABLE IF NOT EXISTS firecrawl_crawl_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    markdown TEXT,
    metadata JSONB,
    scraped_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_firecrawl_jobs_user_id ON firecrawl_jobs(user_id);
CREATE INDEX idx_firecrawl_jobs_status ON firecrawl_jobs(status);
CREATE INDEX idx_firecrawl_jobs_type ON firecrawl_jobs(type);
CREATE INDEX idx_firecrawl_jobs_created_at ON firecrawl_jobs(created_at DESC);

CREATE INDEX idx_firecrawl_scraped_data_user_id ON firecrawl_scraped_data(user_id);
CREATE INDEX idx_firecrawl_scraped_data_job_id ON firecrawl_scraped_data(job_id);
CREATE INDEX idx_firecrawl_scraped_data_url ON firecrawl_scraped_data(url);
CREATE INDEX idx_firecrawl_scraped_data_scraped_at ON firecrawl_scraped_data(scraped_at DESC);

CREATE INDEX idx_firecrawl_crawl_results_job_id ON firecrawl_crawl_results(job_id);
CREATE INDEX idx_firecrawl_crawl_results_url ON firecrawl_crawl_results(url);

-- Enable RLS
ALTER TABLE firecrawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE firecrawl_scraped_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE firecrawl_crawl_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for firecrawl_jobs
CREATE POLICY "Users can view their own jobs" ON firecrawl_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs" ON firecrawl_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" ON firecrawl_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" ON firecrawl_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for firecrawl_scraped_data
CREATE POLICY "Users can view their own scraped data" ON firecrawl_scraped_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scraped data" ON firecrawl_scraped_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraped data" ON firecrawl_scraped_data
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for firecrawl_crawl_results
CREATE POLICY "Users can view crawl results for their jobs" ON firecrawl_crawl_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM firecrawl_jobs 
            WHERE firecrawl_jobs.id = firecrawl_crawl_results.job_id 
            AND firecrawl_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert crawl results" ON firecrawl_crawl_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM firecrawl_jobs 
            WHERE firecrawl_jobs.id = firecrawl_crawl_results.job_id
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_firecrawl_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER update_firecrawl_jobs_updated_at
    BEFORE UPDATE ON firecrawl_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_firecrawl_jobs_updated_at();

-- Function to clean up old scraped data (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_firecrawl_data()
RETURNS void AS $$
BEGIN
    -- Delete old scraped data
    DELETE FROM firecrawl_scraped_data 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old crawl results
    DELETE FROM firecrawl_crawl_results 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old failed jobs
    DELETE FROM firecrawl_jobs 
    WHERE status = 'failed' 
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- Note: This needs to be run by a superuser or configured separately
-- SELECT cron.schedule('cleanup-firecrawl-data', '0 2 * * *', 'SELECT cleanup_old_firecrawl_data();');