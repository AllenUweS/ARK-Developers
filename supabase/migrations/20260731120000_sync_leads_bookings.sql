-- Sync existing plot_leads with active bookings data
UPDATE public.plot_leads pl
SET 
  name = b.customer_name,
  phone = b.customer_phone,
  email = COALESCE(b.customer_email, pl.email),
  status = 'converted'
FROM public.bookings b
WHERE (b.lead_id = pl.id OR (b.plot_id = pl.plot_id AND pl.plot_id IS NOT NULL))
  AND b.status IN ('approved', 'pending', 'on_hold');

-- Trigger function: When a booking is inserted or updated, sync customer details to plot_leads
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
      status = CASE WHEN NEW.status IN ('approved', 'pending', 'on_hold') THEN 'converted' ELSE status END
    WHERE id = NEW.lead_id;
  ELSIF NEW.plot_id IS NOT NULL THEN
    UPDATE public.plot_leads
    SET 
      name = NEW.customer_name,
      phone = NEW.customer_phone,
      email = COALESCE(NEW.customer_email, email),
      status = CASE WHEN NEW.status IN ('approved', 'pending', 'on_hold') THEN 'converted' ELSE status END
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

-- Trigger function: When a plot lead's contact info is updated, sync to active bookings
CREATE OR REPLACE FUNCTION public.sync_lead_to_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (OLD.name IS DISTINCT FROM NEW.name OR OLD.phone IS DISTINCT FROM NEW.phone OR OLD.email IS DISTINCT FROM NEW.email) THEN
    UPDATE public.bookings
    SET 
      customer_name = NEW.name,
      customer_phone = NEW.phone,
      customer_email = COALESCE(NEW.email, customer_email)
    WHERE (lead_id = NEW.id OR (plot_id = NEW.plot_id AND NEW.plot_id IS NOT NULL))
      AND status IN ('approved', 'pending', 'on_hold');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_to_booking ON public.plot_leads;
CREATE TRIGGER trg_sync_lead_to_booking
  AFTER UPDATE OF name, phone, email
  ON public.plot_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_to_booking();
