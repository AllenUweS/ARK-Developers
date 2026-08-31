-- Multi-Stage Sequential Booking Approval Workflow Migration
-- Flow: Executive -> Sales Head (Manager) -> Admin -> CRM Dept -> Accounts Dept -> Completed & Booked

ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS approval_stage TEXT DEFAULT 'sales_head_approval',
ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb;

-- Backfill existing bookings for seamless backward compatibility
UPDATE public.bookings 
SET approval_stage = 'completed' 
WHERE status::text IN ('approved', 'sold') AND (approval_stage IS NULL OR approval_stage = 'sales_head_approval');

UPDATE public.bookings 
SET approval_stage = 'sales_head_approval' 
WHERE status::text = 'pending' AND approval_stage IS NULL;
