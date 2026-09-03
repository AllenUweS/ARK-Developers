-- Migration: Fix RLS Policies for installment_payments
-- Grants permission to all authenticated staff roles (Employees, Accounts, Managers, Admins) to insert and manage installment payments.

-- 1. Drop existing restrictive policy if present
DROP POLICY IF EXISTS "Admins manage installment payments" ON public.installment_payments;
DROP POLICY IF EXISTS "Authenticated users manage installment_payments" ON public.installment_payments;
DROP POLICY IF EXISTS "Authenticated insert installment_payments" ON public.installment_payments;

-- 2. Create open policy for all authenticated staff members
CREATE POLICY "Authenticated users manage installment_payments"
  ON public.installment_payments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Security Definer RPC helper for fail-safe payment insertion
CREATE OR REPLACE FUNCTION public.record_installment_payment_v2(
  _booking_id UUID,
  _amount NUMERIC,
  _paid_on DATE,
  _payment_method TEXT,
  _reference_number TEXT DEFAULT NULL,
  _bank_account_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  -- Try insertion with bank_account_id if available
  BEGIN
    INSERT INTO public.installment_payments (
      booking_id, amount, paid_on, payment_method, reference_number, bank_account_id, notes, created_by
    ) VALUES (
      _booking_id, _amount, _paid_on, _payment_method, _reference_number, _bank_account_id, _notes, auth.uid()
    ) RETURNING id INTO v_new_id;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback insert without bank_account_id if column missing in older DB schemas
    INSERT INTO public.installment_payments (
      booking_id, amount, paid_on, payment_method, reference_number, notes, created_by
    ) VALUES (
      _booking_id, _amount, _paid_on, _payment_method, _reference_number, _notes, auth.uid()
    ) RETURNING id INTO v_new_id;
  END;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_installment_payment_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_installment_payment_v2 TO service_role;
