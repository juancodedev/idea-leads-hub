BEGIN;

-- 1. Add Instagram fields to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram_scoped_id TEXT;

-- 2. Create user_secrets table for per-user encrypted token storage
CREATE TABLE IF NOT EXISTS public.user_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_token TEXT,
  instagram_ig_id TEXT,
  instagram_page_id TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Enable RLS on user_secrets
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if re-running migration
DROP POLICY IF EXISTS "Users can manage their own secrets" ON public.user_secrets;

CREATE POLICY "Users can manage their own secrets" ON public.user_secrets
  FOR ALL
  USING (auth.uid() = user_id);

-- 4. Enable pgcrypto extension for encrypted token storage
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 5. Update activities_type_check constraint to include INSTAGRAM_MESSAGE
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check
CHECK (type IN (
  'CALL', 'MEETING', 'FOLLOW_UP', 'EMAIL', 'TASK', 'NOTE', 'REMINDER',
  'INVESTIGATION', 'ACTION', 'INSTAGRAM_MESSAGE'
));

COMMIT;
