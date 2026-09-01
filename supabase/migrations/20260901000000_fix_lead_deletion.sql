-- Fix plot_leads deletion RLS policy & permissions
-- Allows lead creators, assigned users, managers/sales heads, CRM staff, accounts staff, and admins to delete plot leads.

DROP POLICY IF EXISTS "Admins delete leads" ON public.plot_leads;
DROP POLICY IF EXISTS "Owners and admins delete leads" ON public.plot_leads;
DROP POLICY IF EXISTS "Owners, team and admins delete leads" ON public.plot_leads;

CREATE POLICY "Owners, team and admins delete leads" ON public.plot_leads
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'manager'::public.app_role) OR
    public.has_role(auth.uid(), 'crm'::public.app_role) OR
    public.has_role(auth.uid(), 'accounts'::public.app_role)
  );
