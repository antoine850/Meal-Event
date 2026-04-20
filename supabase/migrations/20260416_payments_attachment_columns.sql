-- Migration: Add attachment columns to payments table
-- and ensure the documents storage bucket has proper RLS policies

-- 1. Add attachment columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS attachment_path TEXT;

-- 2. Ensure the documents bucket exists with proper config
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for the documents bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY IF NOT EXISTS "Public can view documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'documents');
