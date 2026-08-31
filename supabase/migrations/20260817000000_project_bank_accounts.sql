-- Migration: Create project_bank_accounts table and link to project_fund_transfers

CREATE TABLE IF NOT EXISTS public.project_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    branch_name TEXT,
    account_type TEXT NOT NULL DEFAULT 'Escrow',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_project_bank_accounts_project_id ON public.project_bank_accounts(project_id);

-- Add foreign key columns to project_fund_transfers
ALTER TABLE public.project_fund_transfers
  ADD COLUMN IF NOT EXISTS source_bank_account_id UUID REFERENCES public.project_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_bank_account_id UUID REFERENCES public.project_bank_accounts(id) ON DELETE SET NULL;

-- Enable RLS on project_bank_accounts
ALTER TABLE public.project_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_bank_accounts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_bank_accounts' AND policyname = 'Authenticated users can read project bank accounts') THEN
        CREATE POLICY "Authenticated users can read project bank accounts"
            ON public.project_bank_accounts
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_bank_accounts' AND policyname = 'Admins and Accounts can insert project bank accounts') THEN
        CREATE POLICY "Admins and Accounts can insert project bank accounts"
            ON public.project_bank_accounts
            FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role::text IN ('admin', 'super_admin', 'management', 'accounts')
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_bank_accounts' AND policyname = 'Admins and Accounts can update project bank accounts') THEN
        CREATE POLICY "Admins and Accounts can update project bank accounts"
            ON public.project_bank_accounts
            FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role::text IN ('admin', 'super_admin', 'management', 'accounts')
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_bank_accounts' AND policyname = 'Admins and Accounts can delete project bank accounts') THEN
        CREATE POLICY "Admins and Accounts can delete project bank accounts"
            ON public.project_bank_accounts
            FOR DELETE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role::text IN ('admin', 'super_admin', 'management', 'accounts')
                )
            );
    END IF;
END $$;
