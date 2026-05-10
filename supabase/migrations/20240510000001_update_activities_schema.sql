-- Update Activities schema to support rich domain
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Migration: Set title from description or default if null
UPDATE public.activities SET title = COALESCE(SUBSTRING(description FROM 1 FOR 50), 'Sin título') WHERE title IS NULL;

ALTER TABLE public.activities ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for activity types (optional but recommended)
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check 
CHECK (type IN ('CALL', 'MEETING', 'FOLLOW_UP', 'EMAIL', 'TASK', 'NOTE', 'REMINDER'));

-- Ensure RLS is still correct
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
