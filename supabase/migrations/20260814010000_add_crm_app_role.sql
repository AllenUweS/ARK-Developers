-- Add 'crm' role to Supabase app_role enum and update helper functions

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'crm';

-- Update get_primary_role helper function to rank 'crm' role
CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role::text 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    WHEN 'management' THEN 3 
    WHEN 'accounts' THEN 4
    WHEN 'crm' THEN 5
    WHEN 'manager' THEN 6 
    ELSE 7 
  END LIMIT 1
$$;

-- Update is_admin_or_super helper function to include 'crm'
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ 
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role::text IN ('admin', 'super_admin', 'management', 'accounts', 'crm')
  ) 
$$;
