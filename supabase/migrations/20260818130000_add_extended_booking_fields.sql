-- Migration: Add extended buyer profile & deal attribution fields to public.bookings
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
  ADD COLUMN IF NOT EXISTS rate_per_sqft NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS plot_area NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tc_name TEXT,
  ADD COLUMN IF NOT EXISTS tc_place TEXT,
  ADD COLUMN IF NOT EXISTS lead_name TEXT,
  ADD COLUMN IF NOT EXISTS closer_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS receipt_date DATE,
  ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'Personal',
  ADD COLUMN IF NOT EXISTS bdo_id UUID,
  ADD COLUMN IF NOT EXISTS external_bdo_name TEXT,
  ADD COLUMN IF NOT EXISTS attribution_type TEXT DEFAULT 'internal';

-- Add address column to plot_leads if missing
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Also add to booking_installment_schedules if needed
CREATE TABLE IF NOT EXISTS public.booking_installment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
