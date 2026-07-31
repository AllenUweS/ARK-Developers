-- Enhanced Meeting Lifecycle Tracking for Lead Conversion
-- ------------------------------------------------------------------
-- Adds comprehensive meeting tracking to capture the complete
-- lifecycle of lead-to-meeting conversions with creative metadata
-- for better analytics and customer journey insights.

-- Meeting Type Enumeration
CREATE TYPE public.meeting_type AS ENUM (
  'in_person',      -- Face-to-face meeting at office or customer location
  'virtual_call',   -- Video call (Google Meet, Zoom, etc.)
  'site_visit',     -- Physical site visit to plot location
  'phone_call',     -- Scheduled phone call
  'hybrid'          -- Combination of virtual + in-person
);

-- Add meeting lifecycle columns to plot_leads
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS meeting_type public.meeting_type,
  ADD COLUMN IF NOT EXISTS meeting_notes TEXT,
  ADD COLUMN IF NOT EXISTS meeting_attendees TEXT,
  ADD COLUMN IF NOT EXISTS meeting_outcome TEXT,
  ADD COLUMN IF NOT EXISTS meeting_follow_up_date TIMESTAMPTZ;

-- Meeting Outcome Enumeration
CREATE TYPE public.meeting_outcome AS ENUM (
  'positive',        -- Customer showed strong interest
  'neutral',         -- Customer interested but needs time
  'negative',        -- Customer not interested
  'rescheduled',     -- Meeting needs to be rescheduled
  'no_show',         -- Customer didn't attend
  'pending'          -- Meeting outcome not yet recorded
);

ALTER TABLE public.plot_leads
  ALTER COLUMN meeting_outcome TYPE public.meeting_outcome USING 'pending'::public.meeting_outcome;

-- Add indexes for meeting-based queries
CREATE INDEX IF NOT EXISTS idx_plot_leads_meeting_date ON public.plot_leads(meeting_date) WHERE meeting_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plot_leads_meeting_type ON public.plot_leads(meeting_type) WHERE meeting_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plot_leads_status_meeting ON public.plot_leads(status, meeting_date) WHERE status IN ('meeting_scheduled', 'negotiating');

-- Meeting Lifecycle Analytics Function
CREATE OR REPLACE FUNCTION public.get_meeting_lifecycle_stats(days_range INTEGER DEFAULT 30)
RETURNS TABLE (
  meeting_type public.meeting_type,
  total_meetings BIGINT,
  successful_conversions BIGINT,
  conversion_rate NUMERIC,
  avg_meeting_duration INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.meeting_type,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE pl.status = 'converted')::BIGINT,
    ROUND(COUNT(*) FILTER (WHERE pl.status = 'converted')::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0) * 100, 2),
    NULL::INTERVAL -- Can be enhanced with actual duration tracking
  FROM public.plot_leads pl
  WHERE pl.meeting_date >= NOW() - (days_range || ' days')::INTERVAL
    AND pl.meeting_type IS NOT NULL
  GROUP BY pl.meeting_type
  ORDER BY total_meetings DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log meeting outcome and update lead lifecycle
CREATE OR REPLACE FUNCTION public.log_meeting_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log if meeting outcome is being set/updated
  IF NEW.meeting_outcome IS DISTINCT FROM OLD.meeting_outcome AND NEW.meeting_outcome IS NOT NULL THEN
    INSERT INTO public.lead_activities (
      lead_id,
      activity_type,
      from_status,
      to_status,
      notes,
      metadata,
      performed_by
    )
    VALUES (
      NEW.id,
      'meeting_outcome',
      OLD.status,
      NEW.status,
      'Meeting outcome recorded: ' || NEW.meeting_outcome::TEXT ||
        CASE
          WHEN NEW.meeting_notes IS NOT NULL THEN '. Notes: ' || NEW.meeting_notes
          ELSE ''
        END,
      jsonb_build_object(
        'meeting_type', NEW.meeting_type::TEXT,
        'meeting_date', NEW.meeting_date,
        'meeting_location', NEW.meeting_location,
        'attendees', NEW.meeting_attendees,
        'outcome', NEW.meeting_outcome::TEXT,
        'follow_up_date', NEW.meeting_follow_up_date
      ),
      NEW.updated_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Add updated_by column if not exists for tracking
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create trigger for meeting outcome logging
DROP TRIGGER IF EXISTS trg_log_meeting_outcome ON public.plot_leads;
CREATE TRIGGER trg_log_meeting_outcome
  AFTER UPDATE OF meeting_outcome, meeting_notes, meeting_attendees, updated_by
  ON public.plot_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_meeting_outcome();

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.get_meeting_lifecycle_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_meeting_outcome TO service_role;

-- Comment for documentation
COMMENT ON COLUMN public.plot_leads.meeting_type IS 'Type of meeting scheduled: in_person, virtual_call, site_visit, phone_call, or hybrid';
COMMENT ON COLUMN public.plot_leads.meeting_notes IS 'Specific agenda, discussion points, and notes from the meeting';
COMMENT ON COLUMN public.plot_leads.meeting_attendees IS 'List of attendees: Customer, Family members, Business partners, etc.';
COMMENT ON COLUMN public.plot_leads.meeting_outcome IS 'Result of the meeting: positive, neutral, negative, rescheduled, no_show, or pending';
COMMENT ON COLUMN public.plot_leads.meeting_follow_up_date IS 'Scheduled follow-up date after the meeting';
COMMENT ON COLUMN public.plot_leads.updated_by IS 'User who last updated this lead record';
