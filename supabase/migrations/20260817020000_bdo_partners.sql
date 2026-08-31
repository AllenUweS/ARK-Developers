-- Migration: BDO (Business Development Officers / Outsourced Partners) & Lead/Booking Attribution
-- Description: Creates public.bdo_partners table and adds attribution columns to plot_leads and bookings.

-- 1. Create public.bdo_partners Table
CREATE TABLE IF NOT EXISTS public.bdo_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  agency_name TEXT,
  bdo_code TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_bdo_partners_is_active ON public.bdo_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_bdo_partners_bdo_code ON public.bdo_partners(bdo_code);

-- Permissions & RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bdo_partners TO authenticated;
GRANT ALL ON public.bdo_partners TO service_role;
ALTER TABLE public.bdo_partners ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bdo_partners' AND policyname = 'Authenticated users read active BDO partners') THEN
        CREATE POLICY "Authenticated users read active BDO partners"
        ON public.bdo_partners
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bdo_partners' AND policyname = 'Admins and managers manage BDO partners') THEN
        CREATE POLICY "Admins and managers manage BDO partners"
        ON public.bdo_partners
        FOR ALL
        TO authenticated
        USING (
            created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role::text IN ('admin', 'super_admin', 'management', 'manager', 'sales_head', 'accounts')
            )
        )
        WITH CHECK (
            created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role::text IN ('admin', 'super_admin', 'management', 'manager', 'sales_head', 'accounts')
            )
        );
    END IF;
END $$;

-- 2. Add Attribution columns to public.plot_leads
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS bdo_id UUID REFERENCES public.bdo_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_bdo_name TEXT,
  ADD COLUMN IF NOT EXISTS attribution_type TEXT DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS idx_plot_leads_bdo_id ON public.plot_leads(bdo_id);

-- 3. Add Attribution columns to public.bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS bdo_id UUID REFERENCES public.bdo_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_bdo_name TEXT,
  ADD COLUMN IF NOT EXISTS attribution_type TEXT DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS idx_bookings_bdo_id ON public.bookings(bdo_id);

-- 4. Seed initial sample BDO Partners for testing
INSERT INTO public.bdo_partners (name, phone, agency_name, bdo_code, commission_rate, notes)
VALUES 
  ('Rajesh Kumar', '+91 98765 43210', 'Apex Realty Outsourcing', 'BDO-001', 2.5, 'Primary outsourced partner for North Bengaluru'),
  ('Sunita Sharma', '+91 98123 45678', 'Global Property Associates', 'BDO-002', 3.0, 'Independent BDO agent')
ON CONFLICT DO NOTHING;
