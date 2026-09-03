-- Migration: Add notice remark columns to booking_cancellations table
-- Allows recording stage-specific legal notice escalation and revocation remarks.

ALTER TABLE public.booking_cancellations
ADD COLUMN IF NOT EXISTS notice_1_remarks TEXT,
ADD COLUMN IF NOT EXISTS notice_2_remarks TEXT,
ADD COLUMN IF NOT EXISTS notice_3_remarks TEXT,
ADD COLUMN IF NOT EXISTS revocation_remarks TEXT;
