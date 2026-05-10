BEGIN;

-- 1. Rename columns to match requested entity names (in snake_case for DB)
ALTER TABLE IF EXISTS public.ideas RENAME COLUMN user_id TO created_by;
ALTER TABLE IF EXISTS public.ideas RENAME COLUMN related_lead_id TO lead_id;

-- 2. Add archived_at column
ALTER TABLE IF EXISTS public.ideas ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- 3. Update status constraint
-- First, drop the old constraint
ALTER TABLE IF EXISTS public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;

-- Update existing data to match new statuses (mapping old to new)
UPDATE public.ideas SET status = 'RESEARCHING' WHERE status = 'Investigando';
UPDATE public.ideas SET status = 'IN_PROGRESS' WHERE status = 'En Progreso';
UPDATE public.ideas SET status = 'COMPLETED' WHERE status = 'Validada';
UPDATE public.ideas SET status = 'BACKLOG' WHERE status IN ('Borrador', 'Descartada');

-- Add new constraint
ALTER TABLE IF EXISTS public.ideas ADD CONSTRAINT ideas_status_check 
  CHECK (status IN ('BACKLOG', 'RESEARCHING', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'));

-- Set default to BACKLOG
ALTER TABLE IF EXISTS public.ideas ALTER COLUMN status SET DEFAULT 'BACKLOG';

-- 4. Update priority type and constraint
-- Priority was INT, now we want strings: LOW, MEDIUM, HIGH, CRITICAL
-- Drop old constraint if exists (it wasn't named in initial schema, but let's be safe)
-- Actually, let's just change the column type to TEXT
ALTER TABLE IF EXISTS public.ideas ALTER COLUMN priority TYPE TEXT USING 
  CASE 
    WHEN priority <= 1 THEN 'LOW'
    WHEN priority = 2 THEN 'MEDIUM'
    WHEN priority = 3 THEN 'MEDIUM'
    WHEN priority = 4 THEN 'HIGH'
    WHEN priority >= 5 THEN 'CRITICAL'
    ELSE 'MEDIUM'
  END;

-- Add new constraint for priority
ALTER TABLE IF EXISTS public.ideas ADD CONSTRAINT ideas_priority_check 
  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

-- Set default to MEDIUM
ALTER TABLE IF EXISTS public.ideas ALTER COLUMN priority SET DEFAULT 'MEDIUM';

-- 5. RLS Policies - Always DROP before CREATE as per migration rules
DROP POLICY IF EXISTS "Users can access own ideas" ON public.ideas;
CREATE POLICY "Users can access own ideas" ON public.ideas 
  FOR ALL USING (auth.uid() = created_by);

COMMIT;
