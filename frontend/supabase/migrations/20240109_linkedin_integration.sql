-- LinkedIn integration tables

-- LinkedIn profiles cache table
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_id VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  headline TEXT,
  summary TEXT,
  location VARCHAR(255),
  industry VARCHAR(255),
  profile_url VARCHAR(500),
  profile_picture VARCHAR(500),
  email VARCHAR(255),
  connections_count INTEGER,
  is_open_to_work BOOLEAN DEFAULT false,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn connections table
CREATE TABLE IF NOT EXISTS linkedin_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  headline TEXT,
  company VARCHAR(255),
  location VARCHAR(255),
  profile_url VARCHAR(500),
  profile_picture VARCHAR(500),
  connection_date TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, connection_id)
);

-- LinkedIn messages table
CREATE TABLE IF NOT EXISTS linkedin_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject TEXT,
  body TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn enriched leads table
CREATE TABLE IF NOT EXISTS linkedin_enriched_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  linkedin_profile_id VARCHAR(255),
  linkedin_url VARCHAR(500),
  enrichment_data JSONB,
  skills TEXT[],
  experience JSONB,
  education JSONB,
  is_verified BOOLEAN DEFAULT false,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn search history table
CREATE TABLE IF NOT EXISTS linkedin_search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query JSONB NOT NULL,
  results_count INTEGER DEFAULT 0,
  search_type VARCHAR(50) NOT NULL, -- 'people', 'companies', 'connections'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_linkedin_profiles_user_id ON linkedin_profiles(user_id);
CREATE INDEX idx_linkedin_profiles_linkedin_id ON linkedin_profiles(linkedin_id);
CREATE INDEX idx_linkedin_connections_user_id ON linkedin_connections(user_id);
CREATE INDEX idx_linkedin_messages_user_id ON linkedin_messages(user_id);
CREATE INDEX idx_linkedin_enriched_leads_lead_id ON linkedin_enriched_leads(lead_id);
CREATE INDEX idx_linkedin_search_history_user_id ON linkedin_search_history(user_id);

-- Enable RLS on all LinkedIn tables
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_enriched_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_search_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for linkedin_profiles
CREATE POLICY "Users can view their own LinkedIn profiles"
  ON linkedin_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LinkedIn profiles"
  ON linkedin_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LinkedIn profiles"
  ON linkedin_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for linkedin_connections
CREATE POLICY "Users can view their own connections"
  ON linkedin_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own connections"
  ON linkedin_connections FOR ALL
  USING (auth.uid() = user_id);

-- RLS policies for linkedin_messages
CREATE POLICY "Users can view their own messages"
  ON linkedin_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can send messages"
  ON linkedin_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for linkedin_enriched_leads
CREATE POLICY "Users can view enriched leads they have access to"
  ON linkedin_enriched_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = linkedin_enriched_leads.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can enrich their own leads"
  ON linkedin_enriched_leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = linkedin_enriched_leads.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their enriched leads"
  ON linkedin_enriched_leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = linkedin_enriched_leads.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

-- RLS policies for linkedin_search_history
CREATE POLICY "Users can view their own search history"
  ON linkedin_search_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own search history"
  ON linkedin_search_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_linkedin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_linkedin_profiles_updated_at
  BEFORE UPDATE ON linkedin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_updated_at();

CREATE TRIGGER update_linkedin_connections_updated_at
  BEFORE UPDATE ON linkedin_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_updated_at();

CREATE TRIGGER update_linkedin_enriched_leads_updated_at
  BEFORE UPDATE ON linkedin_enriched_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_updated_at();