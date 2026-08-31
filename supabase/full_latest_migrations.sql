-- ==============================================================================
-- TERRA 2.0 (ARK) — EXHAUSTIVE ULTIMATE MIGRATION SCRIPT
-- Execute this entire file in your Supabase SQL Editor.
-- Covers all booking installment fields, lead activities, site visits,
-- treasury, incentive grants, notifications, and approval workflows.
-- ==============================================================================

SET search_path = public, extensions, auth;

-- 1. ADD ENUM VALUES & NEW TYPES
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'management';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'crm';

DO $$ BEGIN
    CREATE TYPE public.meeting_type AS ENUM ('in_person', 'virtual_call', 'site_visit', 'phone_call', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.meeting_outcome AS ENUM ('positive', 'neutral', 'negative', 'rescheduled', 'no_show', 'pending');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_plan AS ENUM ('bank_loan', 'full_payment', 'installment_plan', 'token_advance');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','super_admin','management','accounts')) $$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role::text 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    WHEN 'management' THEN 3 
    WHEN 'manager' THEN 4 
    WHEN 'accounts' THEN 5 
    WHEN 'crm' THEN 6 
    ELSE 7 
  END LIMIT 1
$$;

-- 3. PLOTS TABLE UPDATES
ALTER TABLE public.plots
  ADD COLUMN IF NOT EXISTS incentive_percentage NUMERIC(5,2) DEFAULT 0;

-- 4. BOOKINGS TABLE UPDATES
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count > 0),
  ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS first_installment_due_date DATE,
  ADD COLUMN IF NOT EXISTS incentive_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_stage TEXT DEFAULT 'sales_head_approval',
  ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb;

UPDATE public.bookings 
SET approval_stage = 'completed' 
WHERE status::text IN ('approved', 'sold') AND (approval_stage IS NULL OR approval_stage = 'sales_head_approval');

UPDATE public.bookings 
SET approval_stage = 'sales_head_approval' 
WHERE status::text = 'pending' AND approval_stage IS NULL;

-- 5. INSTALLMENT PAYMENTS TABLE
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

CREATE INDEX IF NOT EXISTS installment_payments_booking_id_idx ON public.installment_payments(booking_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_payments TO authenticated;
GRANT ALL ON public.installment_payments TO service_role;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage installment payments" ON public.installment_payments;
CREATE POLICY "Admins manage installment payments" ON public.installment_payments FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 6. INCENTIVE GRANTS TABLE
CREATE TABLE IF NOT EXISTS public.incentive_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.incentive_grants TO authenticated;
GRANT ALL ON public.incentive_grants TO service_role;
ALTER TABLE public.incentive_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_employee_incentives(_employee_id UUID, _manager_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_or_super(_manager_id)
    OR public.has_role(_manager_id, 'manager') AND public.is_manager_of(_employee_id, _manager_id)
$$;

DROP POLICY IF EXISTS "Admins and managers read relevant incentive grants" ON public.incentive_grants;
CREATE POLICY "Admins and managers read relevant incentive grants" ON public.incentive_grants FOR SELECT TO authenticated USING (public.can_manage_employee_incentives(employee_id, auth.uid()));

DROP POLICY IF EXISTS "Admins and managers grant relevant incentives" ON public.incentive_grants;
CREATE POLICY "Admins and managers grant relevant incentives" ON public.incentive_grants FOR INSERT TO authenticated WITH CHECK (granted_by = auth.uid() AND public.can_manage_employee_incentives(employee_id, auth.uid()));

-- 7. PLOT LEADS TABLE UPDATES
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacted_channel TEXT,
  ADD COLUMN IF NOT EXISTS contacted_notes TEXT,
  ADD COLUMN IF NOT EXISTS meeting_type public.meeting_type,
  ADD COLUMN IF NOT EXISTS meeting_notes TEXT,
  ADD COLUMN IF NOT EXISTS meeting_attendees TEXT,
  ADD COLUMN IF NOT EXISTS meeting_outcome public.meeting_outcome DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS meeting_follow_up_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiated_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_plan public.payment_plan DEFAULT 'bank_loan',
  ADD COLUMN IF NOT EXISTS discount_offered TEXT,
  ADD COLUMN IF NOT EXISTS negotiation_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 8. LEAD ACTIVITIES & DROP REASONS
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.plot_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  channel TEXT,
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read lead_activities" ON public.lead_activities;
CREATE POLICY "Authenticated read lead_activities" ON public.lead_activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert lead_activities" ON public.lead_activities;
CREATE POLICY "Authenticated insert lead_activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lead_drop_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.plot_leads(id) ON DELETE CASCADE,
  dropped_from_stage TEXT NOT NULL DEFAULT 'new',
  reason TEXT NOT NULL,
  reason_label TEXT,
  notes TEXT,
  dropped_by UUID REFERENCES auth.users(id),
  dropped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_drop_reasons TO authenticated;
GRANT ALL ON public.lead_drop_reasons TO service_role;
ALTER TABLE public.lead_drop_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage lead_drop_reasons" ON public.lead_drop_reasons;
CREATE POLICY "Authenticated users can manage lead_drop_reasons" ON public.lead_drop_reasons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. SITE VISITS & PHOTO PROOFS
CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.plot_leads(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  accuracy_meters NUMERIC(10,2) NOT NULL DEFAULT 0,
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'verified', 'needs_review')),
  notes TEXT,
  correction_note TEXT,
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.site_visits(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT,
  file_name TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_meters NUMERIC(10,2),
  exif_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.site_visits TO authenticated;
GRANT SELECT, INSERT ON public.site_visit_photos TO authenticated;
GRANT ALL ON public.site_visits, public.site_visit_photos TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_site_visit(_visit_id UUID, _viewer_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_visits visit
    WHERE visit.id = _visit_id AND (
      visit.employee_id = _viewer_id OR public.is_admin_or_super(_viewer_id)
      OR (public.has_role(_viewer_id, 'manager') AND public.is_manager_of(visit.employee_id, _viewer_id))
    )
  )
$$;

DROP POLICY IF EXISTS "Employees and reviewers read site visits" ON public.site_visits;
CREATE POLICY "Employees and reviewers read site visits" ON public.site_visits FOR SELECT TO authenticated USING (public.can_view_site_visit(id, auth.uid()));

DROP POLICY IF EXISTS "Employees and reviewers read visit photos" ON public.site_visit_photos;
CREATE POLICY "Employees and reviewers read visit photos" ON public.site_visit_photos FOR SELECT TO authenticated USING (public.can_view_site_visit(visit_id, auth.uid()));

-- 10. TREASURY & FUND TRANSFERS
CREATE TABLE IF NOT EXISTS public.project_fund_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    target_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    transferred_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    purpose TEXT,
    repayment_due_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    repaid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_fund_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view transfers" ON public.project_fund_transfers;
CREATE POLICY "Authenticated users view transfers" ON public.project_fund_transfers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins and management manage transfers" ON public.project_fund_transfers;
CREATE POLICY "Admins and management manage transfers" ON public.project_fund_transfers FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.project_transfer_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.project_fund_transfers(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    repaid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_transfer_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view repayments" ON public.project_transfer_repayments;
CREATE POLICY "Authenticated users view repayments" ON public.project_transfer_repayments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users insert repayments" ON public.project_transfer_repayments;
CREATE POLICY "Authenticated users insert repayments" ON public.project_transfer_repayments FOR INSERT TO authenticated WITH CHECK (true);

-- 11. USER NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications" ON public.user_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users update own notifications" ON public.user_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 12. PIPELINE RLS POLICIES FOR BOOKINGS (SELECT & UPDATE)
DROP POLICY IF EXISTS "Employees read own or team bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins read all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users read bookings" ON public.bookings;

CREATE POLICY "Authenticated users read bookings" ON public.bookings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated update bookings" ON public.bookings;

CREATE POLICY "Authenticated update bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 13. AUTOMATED ROLE SYNC FOR DEPARTMENT TEST ACCOUNTS
UPDATE public.user_roles 
SET role = 'accounts'::public.app_role
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE '%account%'
) OR user_id IN (
  SELECT id FROM public.profiles WHERE full_name ILIKE '%account%' OR email ILIKE '%account%'
);

UPDATE public.user_roles 
SET role = 'crm'::public.app_role
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE '%crm%'
) OR user_id IN (
  SELECT id FROM public.profiles WHERE full_name ILIKE '%crm%' OR email ILIKE '%crm%'
);

UPDATE public.user_roles 
SET role = 'manager'::public.app_role
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE '%manager%'
) OR user_id IN (
  SELECT id FROM public.profiles WHERE full_name ILIKE '%manager%' OR email ILIKE '%manager%'
);

-- 14. BOOKING APPLICATION FORM DETAILED COLUMNS
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS landline TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS marital_status BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nominee_name TEXT,
  ADD COLUMN IF NOT EXISTS nominee_relationship TEXT,
  ADD COLUMN IF NOT EXISTS buying_purpose TEXT,
  ADD COLUMN IF NOT EXISTS rate_per_sqft NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS plot_area NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tc_name TEXT,
  ADD COLUMN IF NOT EXISTS lead_name TEXT,
  ADD COLUMN IF NOT EXISTS closer_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'Personal';

-- 15. ATOMIC BOOKING DELETION RPC & DELETE POLICIES
CREATE OR REPLACE FUNCTION public.delete_booking_completely(_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_plot_id UUID;
  deleted_count INT := 0;
BEGIN
  SELECT plot_id INTO target_plot_id FROM public.bookings WHERE id = _booking_id;
  
  DELETE FROM public.booking_cancellations WHERE booking_id = _booking_id;
  DELETE FROM public.incentive_disbursals WHERE booking_id = _booking_id;
  DELETE FROM public.installment_payments WHERE booking_id = _booking_id;
  DELETE FROM public.booking_installment_schedules WHERE booking_id = _booking_id;
  DELETE FROM public.incentives WHERE booking_id = _booking_id;

  DELETE FROM public.bookings WHERE id = _booking_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF target_plot_id IS NOT NULL THEN
    UPDATE public.plots 
    SET status = 'available', selected_lead_id = NULL 
    WHERE id = target_plot_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted_rows', deleted_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_booking_completely(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_booking_completely(UUID) TO service_role;

DROP POLICY IF EXISTS "Authenticated users delete bookings" ON public.bookings;
CREATE POLICY "Authenticated users delete bookings" ON public.bookings
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete installment_payments" ON public.installment_payments;
CREATE POLICY "Authenticated delete installment_payments" ON public.installment_payments
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete booking_schedules" ON public.booking_installment_schedules;
CREATE POLICY "Authenticated delete booking_schedules" ON public.booking_installment_schedules
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete booking_cancellations" ON public.booking_cancellations;
CREATE POLICY "Authenticated delete booking_cancellations" ON public.booking_cancellations
  FOR DELETE TO authenticated USING (true);
