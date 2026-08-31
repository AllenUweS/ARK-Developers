-- Migration: Incentive Installment Disbursals & Agreed Incentive Amounts
-- Description: Adds agreed_incentive_amount to bookings and creates public.incentive_disbursals table.

-- 1. Ensure agreed_incentive_amount column exists on public.bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS agreed_incentive_amount NUMERIC(14,2) DEFAULT 0;

-- Sync agreed_incentive_amount with existing incentive_amount column if present
UPDATE public.bookings
SET agreed_incentive_amount = COALESCE(incentive_amount, 0)
WHERE agreed_incentive_amount IS NULL OR agreed_incentive_amount = 0;

-- 2. Create public.incentive_disbursals Table
CREATE TABLE IF NOT EXISTS public.incentive_disbursals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  installment_number INT NOT NULL DEFAULT 1,
  milestone_name TEXT NOT NULL DEFAULT '50% Advance Release',
  payment_method TEXT DEFAULT 'Bank Transfer',
  reference_number TEXT,
  notes TEXT,
  disbursed_by UUID NOT NULL REFERENCES auth.users(id),
  disbursed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incentive_disbursals_booking_id ON public.incentive_disbursals(booking_id);
CREATE INDEX IF NOT EXISTS idx_incentive_disbursals_employee_id ON public.incentive_disbursals(employee_id);

-- Permissions
GRANT SELECT, INSERT ON public.incentive_disbursals TO authenticated;
GRANT ALL ON public.incentive_disbursals TO service_role;
ALTER TABLE public.incentive_disbursals ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for public.incentive_disbursals
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incentive_disbursals' AND policyname = 'Admins and managers read relevant incentive disbursals') THEN
        CREATE POLICY "Admins and managers read relevant incentive disbursals"
        ON public.incentive_disbursals
        FOR SELECT
        TO authenticated
        USING (
            employee_id = auth.uid()
            OR disbursed_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role::text IN ('admin', 'super_admin', 'management', 'manager', 'sales_head', 'accounts')
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incentive_disbursals' AND policyname = 'Admins and managers disburse incentives') THEN
        CREATE POLICY "Admins and managers disburse incentives"
        ON public.incentive_disbursals
        FOR INSERT
        TO authenticated
        WITH CHECK (
            disbursed_by = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role::text IN ('admin', 'super_admin', 'management', 'manager', 'sales_head', 'accounts')
            )
        );
    END IF;
END $$;
