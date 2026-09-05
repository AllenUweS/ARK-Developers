-- ====================================================================
-- ARK BUILDERS: PROJECT DOCUMENTS STORAGE BUCKET & PERMISSIONS
-- ====================================================================

-- 1. Create storage bucket for project documents (approvals, brochures, legal docs, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false,
  52428800, -- 50 MB
  NULL      -- allow all document types (PDF, Word, Excel, Images, etc.)
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for 'project-documents' bucket
DROP POLICY IF EXISTS "Authenticated read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read project documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers upload project documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers delete project documents" ON storage.objects;

-- Read: Any authenticated user can read / preview / download project documents
CREATE POLICY "Authenticated read project documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-documents');

-- Insert: Admins, managers, management, and CRM can upload project documents
CREATE POLICY "Admins and managers upload project documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'crm')
  )
);

-- Update: Admins and managers can update project documents
CREATE POLICY "Admins and managers update project documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-documents' AND (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'management')
  )
);

-- Delete: Admins and managers can delete project documents
CREATE POLICY "Admins and managers delete project documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-documents' AND (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'management')
  )
);

-- 3. Table policies for public.project_documents
DROP POLICY IF EXISTS "Admins insert project documents" ON public.project_documents;
CREATE POLICY "Admins and managers insert project documents"
ON public.project_documents FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_super(auth.uid()) OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'management') OR
  public.has_role(auth.uid(), 'crm')
);

DROP POLICY IF EXISTS "Admins update project documents" ON public.project_documents;
CREATE POLICY "Admins and managers update project documents"
ON public.project_documents FOR UPDATE TO authenticated
USING (
  public.is_admin_or_super(auth.uid()) OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'management')
);

DROP POLICY IF EXISTS "Admins delete project documents" ON public.project_documents;
CREATE POLICY "Admins and managers delete project documents"
ON public.project_documents FOR DELETE TO authenticated
USING (
  public.is_admin_or_super(auth.uid()) OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'management')
);

-- 4. Helper function to ensure the bucket exists on demand
CREATE OR REPLACE FUNCTION public.ensure_project_documents_bucket()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('project-documents', 'project-documents', false, 52428800)
  ON CONFLICT (id) DO NOTHING;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_project_documents_bucket() TO authenticated;
