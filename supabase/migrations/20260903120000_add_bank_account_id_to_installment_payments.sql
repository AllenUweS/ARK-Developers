-- Migration: Add optional bank_account_id foreign key column to installment_payments
-- This links individual installment collection receipts directly to project bank accounts.

ALTER TABLE public.installment_payments
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.project_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS installment_payments_bank_account_id_idx ON public.installment_payments(bank_account_id);
