-- API keys for machine-to-machine integrations (e.g. the Prospector).
-- Only a SHA-256 hash is stored; the plaintext key is shown once at creation
-- and is never recoverable afterwards.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys (user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owners can see their keys (hashes are never returned as plaintext keys) and
-- revoke them by setting revoked_at. Verification runs with the service role.
DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
CREATE POLICY "Users can view own api keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own api keys" ON public.api_keys;
CREATE POLICY "Users can create own api keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can revoke own api keys" ON public.api_keys;
CREATE POLICY "Users can revoke own api keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);
