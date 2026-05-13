BEGIN;

-- 1. Add idea_id and attachments to activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Update type constraint to include INVESTIGATION and ACTION
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check 
CHECK (type IN ('CALL', 'MEETING', 'FOLLOW_UP', 'EMAIL', 'TASK', 'NOTE', 'REMINDER', 'INVESTIGATION', 'ACTION'));

-- 3. Ensure updated_at trigger is present for auditing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_activities_updated_at') THEN
        CREATE TRIGGER handle_activities_updated_at
        BEFORE UPDATE ON public.activities
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        -- If handle_updated_at doesn't exist, we don't fail the whole migration
        NULL;
END $$;

COMMIT;
