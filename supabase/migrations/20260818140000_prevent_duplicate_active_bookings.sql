-- Migration: Cleanup duplicate pending bookings and enforce unique active booking per plot
-- 1. Auto-cancel older duplicate pending booking submissions for the same plot, keeping only the latest one
UPDATE public.bookings b1
SET status = 'cancelled',
    remarks = COALESCE(b1.remarks, '') || E'\n\n[System] Auto-cancelled duplicate pending booking submission.'
WHERE b1.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.bookings b2
    WHERE b2.plot_id = b1.plot_id
      AND b2.status IN ('pending', 'approved')
      AND b2.created_at > b1.created_at
  );

-- 2. Create unique partial index on bookings(plot_id) for active pipeline statuses ('pending', 'approved')
-- This prevents race conditions or double-submitting from creating multiple active pipelines for the same plot
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_per_plot
ON public.bookings (plot_id)
WHERE status IN ('pending', 'approved');
