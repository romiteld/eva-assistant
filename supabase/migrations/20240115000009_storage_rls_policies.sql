-- Storage RLS Policies for File Management System
-- This migration creates proper Row Level Security policies for all storage buckets

-- Create storage policy for documents bucket
CREATE POLICY "Users can upload documents to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own documents"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create storage policy for resumes bucket
CREATE POLICY "Users can upload resumes to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own resumes"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own resumes"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own resumes"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create storage policy for avatars bucket (public but user-owned)
CREATE POLICY "Users can upload avatars to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create storage policy for temp-uploads bucket
CREATE POLICY "Users can upload to temp-uploads folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own temp uploads"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own temp uploads"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own temp uploads"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create storage policy for ai-generated bucket
CREATE POLICY "Users can upload to ai-generated folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'ai-generated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own ai-generated content"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'ai-generated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own ai-generated content"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'ai-generated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own ai-generated content"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'ai-generated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create function to initialize storage buckets
CREATE OR REPLACE FUNCTION initialize_storage_buckets()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  -- This function can be called to set up storage buckets
  -- The actual bucket creation is handled by the setup-storage Edge Function
  
  SELECT json_build_object(
    'status', 'ready',
    'message', 'Storage policies configured',
    'buckets', json_build_array('documents', 'resumes', 'avatars', 'temp-uploads', 'ai-generated'),
    'created_at', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Create indexes for better performance on storage queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_user 
ON storage.objects(bucket_id, (storage.foldername(name))[1]);

CREATE INDEX IF NOT EXISTS idx_storage_objects_created_at 
ON storage.objects(created_at);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;