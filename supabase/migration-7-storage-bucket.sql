-- Migration: Create storage bucket for restaurant images
-- Run this in Supabase SQL Editor

-- Create the storage bucket for restaurant images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'restaurant-images');

-- Policy: Allow authenticated users to update their images
CREATE POLICY "Authenticated users can update restaurant images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'restaurant-images');

-- Policy: Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete restaurant images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'restaurant-images');

-- Policy: Allow public read access to images
CREATE POLICY "Public can view restaurant images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'restaurant-images');
