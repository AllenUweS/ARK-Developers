-- Migration: Create lead_drop_reasons table to store why leads were dropped
-- This table records the detailed reason, notes, and the stage from which the lead was dropped.

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

-- Index for fast lookups by lead_id
CREATE INDEX IF NOT EXISTS idx_lead_drop_reasons_lead_id ON public.lead_drop_reasons(lead_id);

-- Enable RLS
ALTER TABLE public.lead_drop_reasons ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can manage lead_drop_reasons"
  ON public.lead_drop_reasons
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
