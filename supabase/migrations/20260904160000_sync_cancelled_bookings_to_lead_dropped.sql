-- Migration: Ensure cancelled and rejected bookings automatically set associated plot_leads to 'dropped' and clear plot_id

-- 1. One-time data correction: Update all existing leads tied to cancelled/rejected bookings
UPDATE public.plot_leads pl
SET 
  status = 'dropped',
  plot_id = NULL
FROM public.bookings b
WHERE (b.lead_id = pl.id OR (b.plot_id = pl.plot_id AND pl.plot_id IS NOT NULL))
  AND b.status::text IN ('cancelled', 'rejected')
  AND pl.status = 'converted';

-- 2. Update trigger function: sync_booking_to_lead()
-- Note: Uses NEW.status::text to prevent PostgreSQL enum type casting errors.
-- Allowed booking_status values are: 'pending', 'approved', 'rejected', 'cancelled', 'on_hold'.
CREATE OR REPLACE FUNCTION public.sync_booking_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.plot_leads
    SET 
      name = NEW.customer_name,
      phone = NEW.customer_phone,
      email = COALESCE(NEW.customer_email, email),
      status = CASE 
        WHEN NEW.status::text IN ('approved', 'pending', 'on_hold') THEN 'converted'
        WHEN NEW.status::text IN ('cancelled', 'rejected') THEN 'dropped'
        ELSE status 
      END,
      plot_id = CASE
        WHEN NEW.status::text IN ('cancelled', 'rejected') THEN NULL
        ELSE plot_id
      END
    WHERE id = NEW.lead_id;
  ELSIF NEW.plot_id IS NOT NULL THEN
    UPDATE public.plot_leads
    SET 
      name = NEW.customer_name,
      phone = NEW.customer_phone,
      email = COALESCE(NEW.customer_email, email),
      status = CASE 
        WHEN NEW.status::text IN ('approved', 'pending', 'on_hold') THEN 'converted'
        WHEN NEW.status::text IN ('cancelled', 'rejected') THEN 'dropped'
        ELSE status 
      END,
      plot_id = CASE
        WHEN NEW.status::text IN ('cancelled', 'rejected') THEN NULL
        ELSE plot_id
      END
    WHERE plot_id = NEW.plot_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_to_lead ON public.bookings;
CREATE TRIGGER trg_sync_booking_to_lead
  AFTER INSERT OR UPDATE OF customer_name, customer_phone, customer_email, status, plot_id, lead_id
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_booking_to_lead();
