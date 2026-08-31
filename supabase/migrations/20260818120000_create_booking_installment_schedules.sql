-- Migration: Create booking_installment_schedules table for full CRUD EMI scheduling
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

-- Index for quick lookup by booking
CREATE INDEX IF NOT EXISTS idx_booking_installment_schedules_booking_id 
  ON public.booking_installment_schedules(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_installment_schedules_status 
  ON public.booking_installment_schedules(status);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_installment_schedules TO authenticated;
GRANT ALL ON public.booking_installment_schedules TO service_role;

-- Row Level Security
ALTER TABLE public.booking_installment_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage installment schedules" ON public.booking_installment_schedules;
CREATE POLICY "Authenticated users manage installment schedules" 
  ON public.booking_installment_schedules 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at_booking_installment_schedules()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_installment_schedules_updated_at ON public.booking_installment_schedules;
CREATE TRIGGER trg_booking_installment_schedules_updated_at
  BEFORE UPDATE ON public.booking_installment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_booking_installment_schedules();
