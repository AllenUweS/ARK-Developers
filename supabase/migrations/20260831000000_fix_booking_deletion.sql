-- ==============================================================================
-- FIX BOOKING DELETION & CASCADING RLS POLICIES
-- ==============================================================================

-- 1. Create atomic SECURITY DEFINER function to completely delete a booking
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
  -- Find the plot_id for this booking
  SELECT plot_id INTO target_plot_id FROM public.bookings WHERE id = _booking_id;
  
  IF target_plot_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = _booking_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found');
  END IF;

  -- Delete all sub-records explicitly to prevent FK violations
  DELETE FROM public.booking_cancellations WHERE booking_id = _booking_id;
  DELETE FROM public.incentive_disbursals WHERE booking_id = _booking_id;
  DELETE FROM public.installment_payments WHERE booking_id = _booking_id;
  DELETE FROM public.booking_installment_schedules WHERE booking_id = _booking_id;
  DELETE FROM public.incentives WHERE booking_id = _booking_id;

  -- Delete the main booking row
  DELETE FROM public.bookings WHERE id = _booking_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Restore plot status to 'available' if plot is attached
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

-- 2. Add RLS DELETE policies for bookings and related tables
DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
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

DROP POLICY IF EXISTS "Authenticated delete incentive_disbursals" ON public.incentive_disbursals;
CREATE POLICY "Authenticated delete incentive_disbursals" ON public.incentive_disbursals
  FOR DELETE TO authenticated USING (true);
