BEGIN;

-- Add address and website columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

COMMIT;
