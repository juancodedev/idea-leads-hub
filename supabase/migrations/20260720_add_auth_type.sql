BEGIN;

-- Add auth_type column to distinguish Facebook Login from Instagram Business Login
-- NULL = legacy Facebook Login
-- 'facebook' = Facebook Login
-- 'instagram_business_login' = Instagram Business Login
ALTER TABLE public.user_secrets ADD COLUMN IF NOT EXISTS auth_type TEXT;

COMMIT;
