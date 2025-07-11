-- File storage and document management tables

-- Create documents table for file metadata
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'documents',
  processed BOOLEAN DEFAULT false,
  embeddings_generated BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file_shares table for sharing files between users
CREATE TABLE IF NOT EXISTS file_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions TEXT[] DEFAULT ARRAY['view'],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file_versions table for version control
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  changes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file_tags table for categorization
CREATE TABLE IF NOT EXISTS file_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, tag_name)
);

-- Create indexes for better performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_processed ON documents(processed) WHERE NOT processed;
CREATE INDEX idx_file_shares_document_id ON file_shares(document_id);
CREATE INDEX idx_file_shares_shared_with ON file_shares(shared_with);
CREATE INDEX idx_file_versions_document_id ON file_versions(document_id);
CREATE INDEX idx_file_tags_document_id ON file_tags(document_id);
CREATE INDEX idx_file_tags_tag_name ON file_tags(tag_name);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for documents
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM file_shares 
    WHERE file_shares.document_id = documents.id 
    AND file_shares.shared_with = auth.uid()
    AND (file_shares.expires_at IS NULL OR file_shares.expires_at > NOW())
  ));

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for file_shares
CREATE POLICY "Users can view shares for their documents or shared with them"
  ON file_shares FOR SELECT
  USING (
    auth.uid() = shared_by OR 
    auth.uid() = shared_with OR
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = file_shares.document_id 
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create shares for their documents"
  ON file_shares FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by AND
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = file_shares.document_id 
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own shares"
  ON file_shares FOR DELETE
  USING (auth.uid() = shared_by);

-- RLS policies for file_versions
CREATE POLICY "Users can view versions of accessible documents"
  ON file_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = file_versions.document_id 
    AND (
      documents.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM file_shares 
        WHERE file_shares.document_id = documents.id 
        AND file_shares.shared_with = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can create versions for their documents"
  ON file_versions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = file_versions.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- RLS policies for file_tags
CREATE POLICY "Users can view tags for accessible documents"
  ON file_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = file_tags.document_id 
    AND (
      documents.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM file_shares 
        WHERE file_shares.document_id = documents.id 
        AND file_shares.shared_with = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can create tags for their documents"
  ON file_tags FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = file_tags.document_id 
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tags they created"
  ON file_tags FOR DELETE
  USING (auth.uid() = created_by);

-- Create update trigger for documents
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage buckets (run this in Supabase Dashboard or via API)
-- Note: These are comments as bucket creation requires Supabase management API
-- CREATE BUCKET documents;
-- CREATE BUCKET avatars;
-- CREATE BUCKET resumes;
-- CREATE BUCKET temp-uploads;

-- Storage policies would be set via Supabase Dashboard:
-- 1. documents bucket: Authenticated users can upload/read their own files
-- 2. avatars bucket: Public read, authenticated write
-- 3. resumes bucket: Authenticated users only
-- 4. temp-uploads bucket: Authenticated users, auto-delete after 24 hours