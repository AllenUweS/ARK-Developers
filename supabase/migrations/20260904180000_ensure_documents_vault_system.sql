-- Consolidated Documents System Setup
-- ------------------------------------------------------------------
-- Ensures document_folders, documents, storage bucket, and RLS policies exist.

-- 1. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Helper function for manager role
CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'manager'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(UUID) TO service_role;

-- 3. Document Folders Table
CREATE TABLE IF NOT EXISTS public.document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON public.document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_created_by ON public.document_folders(created_by);

-- 4. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  description TEXT,
  is_downloadable BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON public.documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.documents(created_by);

-- Ensure is_downloadable column exists if table was created earlier without it
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT true;

-- 5. Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 6. Folders RLS Policies
DROP POLICY IF EXISTS "Authenticated read folders" ON public.document_folders;
DROP POLICY IF EXISTS "Admins and managers create folders" ON public.document_folders;
DROP POLICY IF EXISTS "Admins and managers update folders" ON public.document_folders;
DROP POLICY IF EXISTS "Admins, managers and owners delete folders" ON public.document_folders;
DROP POLICY IF EXISTS "Admins delete folders" ON public.document_folders;

CREATE POLICY "Authenticated read folders" ON public.document_folders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers create folders" ON public.document_folders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers update folders" ON public.document_folders
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins, managers and owners delete folders" ON public.document_folders
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    created_by = auth.uid()
  );

-- 7. Documents RLS Policies
DROP POLICY IF EXISTS "Authenticated read documents" ON public.documents;
DROP POLICY IF EXISTS "Admins and managers create documents" ON public.documents;
DROP POLICY IF EXISTS "Admins and managers update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins, managers and owners delete documents" ON public.documents;
DROP POLICY IF EXISTS "Admins delete documents" ON public.documents;

CREATE POLICY "Authenticated read documents" ON public.documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers create documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers update documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins, managers and owners delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    created_by = auth.uid()
  );

-- 8. Storage RLS Policies for 'documents' Bucket
DROP POLICY IF EXISTS "Authenticated can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins, managers and owners can delete storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers can delete documents" ON storage.objects;

CREATE POLICY "Authenticated can view documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admins and managers can upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins and managers can update documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents' AND
    (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins, managers and owners can delete storage documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents' AND (
      public.is_admin_or_super(auth.uid()) OR
      public.has_role(auth.uid(), 'manager') OR
      owner = auth.uid()
    )
  );

-- 9. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_document_folders_updated ON public.document_folders;
CREATE TRIGGER trg_document_folders_updated BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated ON public.documents;
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. Seed Root Folder ('Company Documents')
INSERT INTO public.document_folders (id, name, parent_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Company Documents', NULL)
ON CONFLICT (id) DO NOTHING;
