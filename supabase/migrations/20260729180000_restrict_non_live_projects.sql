-- Restrict project SELECT visibility so that non-admins (authenticated) and public (anon) users can only read projects that are 'live'.

DROP POLICY IF EXISTS "Authenticated read projects" ON public.projects;
DROP POLICY IF EXISTS "Public read showcase projects" ON public.projects;

-- Admins and super admins can view all projects; non-admins can only view live projects.
CREATE POLICY "Authenticated read projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super(auth.uid()) OR status = 'live'
  );

-- Anonymous (public) users can only view live projects.
CREATE POLICY "Public read showcase projects" ON public.projects
  FOR SELECT TO anon
  USING (status = 'live');
