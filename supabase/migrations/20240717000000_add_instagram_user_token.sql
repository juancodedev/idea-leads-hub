BEGIN;

-- Add column to store the User Access Token separately from the Page Access Token
-- instagram_token = Page Access Token (used for API calls)
-- instagram_user_token = User Access Token (used for token refresh via fb_exchange_token)
ALTER TABLE public.user_secrets ADD COLUMN IF NOT EXISTS instagram_user_token TEXT;

COMMIT;
