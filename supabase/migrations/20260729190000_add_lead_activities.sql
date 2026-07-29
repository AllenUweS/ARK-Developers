-- Add contacted tracking fields to plot_leads
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacted_channel TEXT,
  ADD COLUMN IF NOT EXISTS contacted_notes TEXT;

-- Create lead_activities table for tracking complete lead lifecycle audit trail
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.plot_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'created', 'stage_change', 'contacted', 'plot_mapped', 'meeting_scheduled', 'note_added', 'converted', 'dropped'
  from_status TEXT,
  to_status TEXT,
  channel TEXT, -- 'Phone Call', 'WhatsApp', 'Email', 'In-Person Meeting', 'Site Visit', 'Web Form', 'Referral', 'Social Media', etc.
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities(created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read lead_activities" ON public.lead_activities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert lead_activities" ON public.lead_activities
  FOR INSERT TO authenticated WITH CHECK (true);
