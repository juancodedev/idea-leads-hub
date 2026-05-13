BEGIN;

-- 1. Add attachments column to ideas table
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Create storage bucket for idea attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('idea-attachments', 'idea-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up RLS for the bucket
-- Allow authenticated users to upload files to their own folder
DROP POLICY IF EXISTS "Allow authenticated users to upload attachments" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'idea-attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own files
DROP POLICY IF EXISTS "Allow users to view their own attachments" ON storage.objects;
CREATE POLICY "Allow users to view their own attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'idea-attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Allow users to delete their own attachments" ON storage.objects;
CREATE POLICY "Allow users to delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'idea-attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
DROP POLICY IF EXISTS "Allow users to update their own attachments" ON storage.objects;
CREATE POLICY "Allow users to update their own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'idea-attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
