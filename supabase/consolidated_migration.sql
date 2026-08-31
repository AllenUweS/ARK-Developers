-- ==============================================================================
-- CONSOLIDATED SUPABASE SCHEMA & SEED FOR PROJECT: hcnvtqhubdypifljymmg
-- Execute this entire file in Supabase SQL Editor.
-- ==============================================================================

SET search_path = public, extensions, auth;

-- 1. ENUMS & TYPES
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'employee', 'manager', 'management', 'accounts', 'crm');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.project_status AS ENUM ('upcoming', 'live', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.plot_status AS ENUM ('available', 'pending', 'booked', 'reserved', 'sold', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.plot_facing AS ENUM ('north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'on_hold');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'meeting_scheduled', 'negotiating', 'converted', 'dropped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  job_title TEXT,
  department TEXT,
  joining_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','super_admin','management')) $$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role::text 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    WHEN 'management' THEN 3 
    WHEN 'manager' THEN 4 
    ELSE 5 
  END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_employee_id UUID, _manager_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _employee_id AND manager_id = _manager_id
  )
$$;

-- RLS Policies for Profiles & Roles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for New User Creation (Auto Super Admin for first user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  google_maps_link TEXT,
  cover_image_url TEXT,
  layout_image_url TEXT,
  launch_date DATE,
  status public.project_status NOT NULL DEFAULT 'upcoming',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read projects" ON public.projects;
CREATE POLICY "Authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage projects" ON public.projects;
CREATE POLICY "Admins manage projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
CREATE POLICY "Admins update projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS "Super admins delete projects" ON public.projects;
CREATE POLICY "Super admins delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. PLOTS TABLE
CREATE TABLE IF NOT EXISTS public.plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plot_number TEXT NOT NULL,
  area_sqft NUMERIC(10,2) NOT NULL,
  dimensions TEXT,
  price NUMERIC(14,2) NOT NULL,
  facing public.plot_facing,
  corner_plot BOOLEAN NOT NULL DEFAULT false,
  road_width NUMERIC(6,2),
  status public.plot_status NOT NULL DEFAULT 'available',
  remarks TEXT,
  layout_x NUMERIC,
  layout_y NUMERIC,
  polygon_coordinates JSONB,
  length_ft NUMERIC(8,2),
  width_ft NUMERIC(8,2),
  rate_per_sqft NUMERIC(10,2),
  incentive_percentage NUMERIC(5,2) DEFAULT 0,
  selected_lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, plot_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plots TO authenticated;
GRANT ALL ON public.plots TO service_role;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read plots" ON public.plots;
CREATE POLICY "Authenticated read plots" ON public.plots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage plots insert" ON public.plots;
CREATE POLICY "Admins manage plots insert" ON public.plots FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS "Admins manage plots update" ON public.plots;
CREATE POLICY "Admins manage plots update" ON public.plots FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS "Admins delete plots" ON public.plots;
CREATE POLICY "Admins delete plots" ON public.plots FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- 6. PLOT LEADS TABLE
CREATE TABLE IF NOT EXISTS public.plot_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID REFERENCES public.plots(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT,
  budget NUMERIC(14,2),
  notes TEXT,
  meeting_date TIMESTAMPTZ,
  meeting_location TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plot_leads TO authenticated;
GRANT ALL ON public.plot_leads TO service_role;
ALTER TABLE public.plot_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read leads" ON public.plot_leads;
CREATE POLICY "Authenticated read leads" ON public.plot_leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated create leads" ON public.plot_leads;
CREATE POLICY "Authenticated create leads" ON public.plot_leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Owners and admins update leads" ON public.plot_leads;
CREATE POLICY "Owners and admins update leads" ON public.plot_leads FOR UPDATE TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin_or_super(auth.uid()));

-- 7. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE RESTRICT,
  lead_id UUID REFERENCES public.plot_leads(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,
  aadhaar_number TEXT,
  pan_number TEXT,
  sales_executive_id UUID REFERENCES auth.users(id),
  total_price NUMERIC(14,2) NOT NULL,
  booking_amount NUMERIC(14,2) NOT NULL,
  advance_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_registration_date DATE,
  remarks TEXT,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees read own or team bookings" ON public.bookings;
CREATE POLICY "Employees read own or team bookings" ON public.bookings FOR SELECT TO authenticated USING (
  created_by = auth.uid() 
  OR sales_executive_id = auth.uid()
  OR (created_by IS NOT NULL AND public.is_manager_of(created_by, auth.uid()))
  OR (sales_executive_id IS NOT NULL AND public.is_manager_of(sales_executive_id, auth.uid()))
  OR public.is_admin_or_super(auth.uid())
);
DROP POLICY IF EXISTS "Auth create bookings" ON public.bookings;
CREATE POLICY "Auth create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Admins update bookings" ON public.bookings;
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- 8. INSTALLMENT PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_payments TO authenticated;
GRANT ALL ON public.installment_payments TO service_role;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage installment payments" ON public.installment_payments;
CREATE POLICY "Admins manage installment payments" ON public.installment_payments FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- 9. CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable insert for anyone" ON public.contact_messages;
CREATE POLICY "Enable insert for anyone" ON public.contact_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.contact_messages;
CREATE POLICY "Enable select for authenticated users" ON public.contact_messages FOR SELECT TO authenticated USING (true);

-- 10. PROJECT DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view project documents" ON public.project_documents;
CREATE POLICY "Authenticated can view project documents" ON public.project_documents FOR SELECT TO authenticated USING (true);

-- 11. RPC: ADMIN PASSWORD UPDATE FUNCTION
CREATE OR REPLACE FUNCTION public.admin_update_user_password(_user_id UUID, _new_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin', 'management')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user passwords.';
  END IF;
  IF length(_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;
  UPDATE auth.users SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')), updated_at = now() WHERE id = _user_id;
  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

-- 12. INITIAL SEED DATA
INSERT INTO public.projects (code, name, location, description, status)
VALUES (
  'GVH-01',
  'Green Valley Township',
  'Sector 14, Silicon Corridor',
  'Premium gated township with plotted layout and full amenities.',
  'live'
) ON CONFLICT (code) DO NOTHING;

-- Seed sample plots for Green Valley Township
DO $$
DECLARE
  p_id UUID;
BEGIN
  SELECT id INTO p_id FROM public.projects WHERE code = 'GVH-01' LIMIT 1;
  IF p_id IS NOT NULL THEN
    INSERT INTO public.plots (project_id, plot_number, area_sqft, dimensions, price, facing, corner_plot, road_width, status, polygon_coordinates)
    VALUES
      (p_id, '101', 1200.00, '30x40', 2400000.00, 'east', false, 30, 'available', '[{"x":10,"y":10},{"x":25,"y":10},{"x":25,"y":25},{"x":10,"y":25}]'::jsonb),
      (p_id, '102', 1500.00, '30x50', 3000000.00, 'north', true, 40, 'available', '[{"x":30,"y":10},{"x":45,"y":10},{"x":45,"y":25},{"x":30,"y":25}]'::jsonb),
      (p_id, '103', 1800.00, '30x60', 3600000.00, 'south_east', false, 30, 'booked', '[{"x":50,"y":10},{"x":65,"y":10},{"x":65,"y":25},{"x":50,"y":25}]'::jsonb),
      (p_id, '104', 2000.00, '40x50', 4000000.00, 'north_west', true, 40, 'pending', '[{"x":10,"y":30},{"x":25,"y":30},{"x":25,"y":45},{"x":10,"y":45}]'::jsonb),
      (p_id, '105', 1200.00, '30x40', 2400000.00, 'west', false, 30, 'available', '[{"x":30,"y":30},{"x":45,"y":30},{"x":45,"y":45},{"x":30,"y":45}]'::jsonb)
    ON CONFLICT (project_id, plot_number) DO NOTHING;
  END IF;
END $$;
