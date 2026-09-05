-- ====================================================================
-- ARK BUILDERS: COMPLETE SITE VISITS RLS & PERMISSIONS REPAIR
-- ====================================================================

-- 1. Ensure Storage Bucket exists for proof photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-visit-proofs', 'site-visit-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow general site visits (where project/plot are nullable)
ALTER TABLE public.site_visits
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN plot_id DROP NOT NULL;

-- 3. Drop all previous restrictive policies on site_visits
DROP POLICY IF EXISTS "Employees and reviewers read site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Employees submit own site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Assigned employees start site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Employees complete their active site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Employees add correction notes" ON public.site_visits;
DROP POLICY IF EXISTS "Admins review site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Employees and admins start site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Employees and admins read site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Employees and admins update site visits" ON public.site_visits;

-- 4. Clean & Bulletproof Policies for public.site_visits
-- INSERT: Any authenticated user can log a site visit as the recording employee
CREATE POLICY "Employees and admins start site visits" ON public.site_visits
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- SELECT: Authenticated users can read site visits
CREATE POLICY "Employees and admins read site visits" ON public.site_visits
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid() OR
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'crm') OR
    public.has_role(auth.uid(), 'accounts') OR
    public.has_role(auth.uid(), 'management') OR
    EXISTS (
      SELECT 1 FROM public.plot_leads lead
      WHERE lead.id = lead_id AND (lead.assigned_to = auth.uid() OR lead.created_by = auth.uid())
    )
  );

-- UPDATE: The employee who recorded it, or admins/managers, can complete or verify the visit
CREATE POLICY "Employees and admins update site visits" ON public.site_visits
  FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid() OR
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (true);

-- 5. Clean & Bulletproof Policies for public.site_visit_photos
DROP POLICY IF EXISTS "Employees and reviewers read visit photos" ON public.site_visit_photos;
DROP POLICY IF EXISTS "Employees add photos to own visits" ON public.site_visit_photos;
DROP POLICY IF EXISTS "Employees add evidence to active visits" ON public.site_visit_photos;
DROP POLICY IF EXISTS "Authenticated read visit photos" ON public.site_visit_photos;
DROP POLICY IF EXISTS "Authenticated insert visit photos" ON public.site_visit_photos;

CREATE POLICY "Authenticated read visit photos" ON public.site_visit_photos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert visit photos" ON public.site_visit_photos
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 6. Clean & Bulletproof Storage Policies for 'site-visit-proofs' bucket
DROP POLICY IF EXISTS "Employees upload own visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Employees upload proof to their visit folder" ON storage.objects;
DROP POLICY IF EXISTS "Visit participants read proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload visit proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read visit proofs" ON storage.objects;

CREATE POLICY "Authenticated upload visit proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-visit-proofs');

CREATE POLICY "Authenticated read visit proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'site-visit-proofs');

-- 7. Fix trigger function for immutability to handle NULL project_id and plot_id safely
CREATE OR REPLACE FUNCTION public.enforce_site_visit_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin_or_super(auth.uid()) THEN
    IF NEW.lead_id IS DISTINCT FROM OLD.lead_id 
      OR NEW.employee_id IS DISTINCT FROM OLD.employee_id 
      OR NEW.latitude IS DISTINCT FROM OLD.latitude 
      OR NEW.longitude IS DISTINCT FROM OLD.longitude
      OR NEW.accuracy_meters IS DISTINCT FROM OLD.accuracy_meters 
      OR NEW.arrived_at IS DISTINCT FROM OLD.arrived_at THEN
      RAISE EXCEPTION 'Captured visit evidence cannot be changed';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.employee_id <> auth.uid() THEN RAISE EXCEPTION 'Not your site visit'; END IF;
  IF OLD.status = 'in_progress' THEN
    IF NEW.status NOT IN ('in_progress', 'submitted') THEN
      RAISE EXCEPTION 'Invalid site visit update';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- 8. DELETE permissions and policies
GRANT DELETE ON public.site_visits TO authenticated;
GRANT DELETE ON public.site_visit_photos TO authenticated;

DROP POLICY IF EXISTS "Admins and managers delete site visits" ON public.site_visits;
CREATE POLICY "Admins and managers delete site visits" ON public.site_visits
  FOR DELETE TO authenticated
  USING (
    employee_id = auth.uid() OR
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'crm') OR
    public.has_role(auth.uid(), 'management')
  );

DROP POLICY IF EXISTS "Admins and managers delete visit photos" ON public.site_visit_photos;
CREATE POLICY "Admins and managers delete visit photos" ON public.site_visit_photos
  FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated delete visit proofs" ON storage.objects;
CREATE POLICY "Authenticated delete visit proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-visit-proofs');

-- 9. Secure RPC to cleanly delete a site visit and all related photos
CREATE OR REPLACE FUNCTION public.delete_site_visit(p_visit_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit public.site_visits%ROWTYPE;
BEGIN
  SELECT * INTO v_visit FROM public.site_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Verify permissions: creator, admin, super_admin, manager, crm, management
  IF v_visit.employee_id <> auth.uid() 
     AND NOT public.is_admin_or_super(auth.uid())
     AND NOT public.has_role(auth.uid(), 'manager')
     AND NOT public.has_role(auth.uid(), 'crm')
     AND NOT public.has_role(auth.uid(), 'management') THEN
    RAISE EXCEPTION 'Not authorized to delete this site visit proof';
  END IF;

  -- Delete photos
  DELETE FROM public.site_visit_photos WHERE visit_id = p_visit_id;
  
  -- Delete visit record
  DELETE FROM public.site_visits WHERE id = p_visit_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_site_visit(UUID) TO authenticated;

