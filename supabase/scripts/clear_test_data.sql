-- ==============================================================================
-- FAIL-SAFE SCRIPT: CLEAR ALL LEADS, BOOKINGS, PAYMENTS & RESET PLOTS
-- ==============================================================================
-- Run this in your Supabase SQL Editor. It automatically checks table existence.

DO $$
BEGIN
  -- 1. Reset all plots to 'available' and disconnect lead locks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plots') THEN
    UPDATE public.plots
    SET status = 'available',
        selected_lead_id = NULL;
  END IF;

  -- 2. Clear booking sub-records & dependencies (if tables exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_cancellations') THEN
    DELETE FROM public.booking_cancellations;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'incentive_disbursals') THEN
    DELETE FROM public.incentive_disbursals;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'incentive_grants') THEN
    DELETE FROM public.incentive_grants;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'incentives') THEN
    DELETE FROM public.incentives;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'installment_payments') THEN
    DELETE FROM public.installment_payments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_installment_schedules') THEN
    DELETE FROM public.booking_installment_schedules;
  END IF;

  -- 3. Clear all bookings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    DELETE FROM public.bookings;
  END IF;

  -- 4. Clear all plot leads & inquiries
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plot_leads') THEN
    DELETE FROM public.plot_leads;
  END IF;

  -- 5. Clear optional site visit logs & notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_visit_photos') THEN
    DELETE FROM public.site_visit_photos;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_visits') THEN
    DELETE FROM public.site_visits;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_notifications') THEN
    DELETE FROM public.user_notifications;
  END IF;

  RAISE NOTICE 'Successfully reset all plots to available and cleared all leads & booking test data!';
END $$;

-- Verify results
SELECT 
  (SELECT COUNT(*) FROM public.bookings) AS remaining_bookings,
  (SELECT COUNT(*) FROM public.plot_leads) AS remaining_leads,
  (SELECT COUNT(*) FROM public.installment_payments) AS remaining_payments,
  (SELECT COUNT(*) FROM public.plots WHERE status != 'available') AS non_available_plots;
