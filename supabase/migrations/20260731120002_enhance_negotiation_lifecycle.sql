-- Enhanced Negotiation Lifecycle Tracking for Lead Conversion
-- ------------------------------------------------------------------
-- Adds negotiation tracking columns and triggers to plot_leads table
-- to support Step 4 (Meeting Scheduled -> Negotiating) lifecycle transition.

-- Payment Plan Structure Enumeration
CREATE TYPE public.payment_plan AS ENUM (
  'bank_loan',         -- Bank Loan (80%) + Self Advance (20%)
  'full_payment',      -- 100% Full Self-Funded Payment
  'installment_plan',  -- Custom Installment Plan
  'token_advance'      -- Token Advance Booking
);

-- Add negotiation lifecycle columns to plot_leads
ALTER TABLE public.plot_leads
  ADD COLUMN IF NOT EXISTS negotiated_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_plan public.payment_plan DEFAULT 'bank_loan',
  ADD COLUMN IF NOT EXISTS discount_offered TEXT,
  ADD COLUMN IF NOT EXISTS negotiation_notes TEXT;

-- Create index for negotiation price queries
CREATE INDEX IF NOT EXISTS idx_plot_leads_negotiated_price ON public.plot_leads(negotiated_price) WHERE negotiated_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plot_leads_payment_plan ON public.plot_leads(payment_plan) WHERE payment_plan IS NOT NULL;

-- Function to log negotiation details and update lead lifecycle
CREATE OR REPLACE FUNCTION public.log_negotiation_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log activity when lead transitions to negotiating or negotiation terms are set
  IF (NEW.status = 'negotiating' AND OLD.status IS DISTINCT FROM 'negotiating') OR 
     (NEW.status = 'negotiating' AND NEW.negotiated_price IS DISTINCT FROM OLD.negotiated_price) THEN
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
      'negotiating',
      OLD.status,
      NEW.status,
      'Price & Terms Negotiation Recorded. Price: ₹' || COALESCE(NEW.negotiated_price::TEXT, 'N/A') ||
        CASE WHEN NEW.payment_plan IS NOT NULL THEN ' | Plan: ' || NEW.payment_plan::TEXT ELSE '' END ||
        CASE WHEN NEW.discount_offered IS NOT NULL THEN ' | Waiver: ' || NEW.discount_offered ELSE '' END ||
        CASE WHEN NEW.negotiation_notes IS NOT NULL THEN ' | Notes: ' || NEW.negotiation_notes ELSE '' END,
      jsonb_build_object(
        'negotiated_price', NEW.negotiated_price,
        'payment_plan', NEW.payment_plan::TEXT,
        'discount_offered', NEW.discount_offered,
        'negotiation_notes', NEW.negotiation_notes
      ),
      COALESCE(NEW.updated_by, auth.uid())
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for negotiation activity logging
DROP TRIGGER IF EXISTS trg_log_negotiation_activity ON public.plot_leads;
CREATE TRIGGER trg_log_negotiation_activity
  AFTER UPDATE OF status, negotiated_price, payment_plan, discount_offered, negotiation_notes
  ON public.plot_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_negotiation_activity();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_negotiation_activity TO service_role;

-- Comments for documentation
COMMENT ON COLUMN public.plot_leads.negotiated_price IS 'Offered/negotiated plot price during sales negotiation';
COMMENT ON COLUMN public.plot_leads.payment_plan IS 'Agreed payment structure: bank_loan, full_payment, installment_plan, or token_advance';
COMMENT ON COLUMN public.plot_leads.discount_offered IS 'Special discount, waiver, or registration fee inclusions offered';
COMMENT ON COLUMN public.plot_leads.negotiation_notes IS 'Detailed terms, buyer counter-offer, and decision timeline notes';
