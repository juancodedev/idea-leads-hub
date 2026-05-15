-- Create a bucket for avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read avatars
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Allow individual uploads" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Allow individual updates" ON storage.objects FOR UPDATE
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Allow individual deletes" ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);
