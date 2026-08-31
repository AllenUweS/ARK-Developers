-- Migration: Fix ram's booking values to match agreed price (25,00,000), advance paid (5,00,000), and incentive (15,000)
UPDATE public.bookings
SET total_price = 2500000.00,
    advance_paid = 500000.00,
    booking_amount = 500000.00,
    incentive_amount = 15000.00,
    agreed_incentive_amount = 15000.00,
    external_bdo_name = 'Vinayak Patil',
    attribution_type = 'manual_external',
    updated_at = now()
WHERE LOWER(customer_name) LIKE '%ram%'
   OR plot_id IN (SELECT id FROM public.plots WHERE plot_number ILIKE '%p22%');
