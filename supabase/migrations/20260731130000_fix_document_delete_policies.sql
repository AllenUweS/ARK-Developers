-- Fix Document & Folder Delete Policies
-- Ensures admins, managers, and document owners can delete documents and folders without RLS permission errors.

-- 1. Drop existing strict delete policies if present
DROP POLICY IF EXISTS "Admins delete documents" ON public.documents;
DROP POLICY IF EXISTS "Admins and managers delete documents" ON public.documents;
DROP POLICY IF EXISTS "Admins and managers delete folders" ON public.document_folders;
DROP POLICY IF EXISTS "Admins delete folders" ON public.document_folders;

-- 2. Create flexible DELETE policy for public.documents
CREATE POLICY "Admins, managers and owners delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    created_by = auth.uid()
  );

-- 3. Create flexible DELETE policy for public.document_folders
CREATE POLICY "Admins, managers and owners delete folders" ON public.document_folders
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    created_by = auth.uid()
  );

-- 4. Ensure storage objects for documents bucket can be deleted by admins, managers, or owners
DROP POLICY IF EXISTS "Admins and managers can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

CREATE POLICY "Admins, managers and owners can delete storage documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents' AND (
      public.is_admin_or_super(auth.uid()) OR
      public.has_role(auth.uid(), 'manager') OR
      owner = auth.uid()
    )
  );
