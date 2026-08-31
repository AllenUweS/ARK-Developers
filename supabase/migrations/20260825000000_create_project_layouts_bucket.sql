-- Migration: Ensure project-layouts public storage bucket exists with proper RLS policies

-- 1. Create project-layouts public bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-layouts', 
  'project-layouts', 
  true, 
  10485760, 
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Public Read Access Policy for project-layouts
DROP POLICY IF EXISTS "Layouts public read" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Statements project-layouts" ON storage.objects;

CREATE POLICY "Public Read Statements project-layouts"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-layouts');

-- 3. Public / Authenticated Insert Access Policy for project-layouts
DROP POLICY IF EXISTS "Admins upload layouts" ON storage.objects;
DROP POLICY IF EXISTS "Allow Insert project-layouts" ON storage.objects;

CREATE POLICY "Allow Insert project-layouts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-layouts');

-- 4. Public / Authenticated Update Access Policy for project-layouts
DROP POLICY IF EXISTS "Admins update layouts" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update project-layouts" ON storage.objects;

CREATE POLICY "Allow Update project-layouts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-layouts');
