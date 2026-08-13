-- Activity status data-prep migration (CF-1, slice 1)
--
-- Adds the nullable `status` and `read_at` columns to public.activities and
-- backfills them from existing data. This migration is deliberately data-prep
-- ONLY: it does not enforce a NOT NULL constraint (that ships with the
-- writer migrations) and
-- does NOT create the completed/status sync hook (rollout gating).
--
-- Rollout runbook: docs/activities-status-rollout.md

BEGIN;

-- 1. Add nullable status and read_at columns
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Backfill status from the completed flag
UPDATE public.activities
SET status = CASE WHEN completed THEN 'COMPLETED' ELSE 'PENDING' END
WHERE status IS NULL;

-- 3. Backfill Instagram read_at from completed_at with created_at fallback
UPDATE public.activities
SET read_at = COALESCE(completed_at, created_at, now())
WHERE type = 'INSTAGRAM_MESSAGE'
  AND completed = true
  AND read_at IS NULL;

-- 4. Add CHECK constraint over the three enum values
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_status_check
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'));

COMMIT;