-- Migration: Create booking_cancellations table for 3-Notice Escalation Workflow
CREATE TABLE IF NOT EXISTS public.booking_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  cancellation_type TEXT NOT NULL CHECK (cancellation_type IN ('customer_requested', 'emi_default')),
  notice_stage INT NOT NULL DEFAULT 1 CHECK (notice_stage IN (0, 1, 2, 3)),
  status TEXT NOT NULL DEFAULT 'notice_1_issued' CHECK (status IN ('notice_1_issued', 'notice_2_issued', 'notice_3_completed', 'revoked')),
  reason TEXT,
  notice_1_sent_at TIMESTAMPTZ DEFAULT now(),
  notice_1_sent_by UUID REFERENCES auth.users(id),
  notice_2_sent_at TIMESTAMPTZ,
  notice_2_sent_by UUID REFERENCES auth.users(id),
  notice_3_sent_at TIMESTAMPTZ,
  notice_3_sent_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_booking_cancellations_booking ON public.booking_cancellations(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_cancellations_plot ON public.booking_cancellations(plot_id);

-- Enable RLS
ALTER TABLE public.booking_cancellations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage booking_cancellations
CREATE POLICY "Allow authenticated users full access to booking_cancellations"
  ON public.booking_cancellations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
