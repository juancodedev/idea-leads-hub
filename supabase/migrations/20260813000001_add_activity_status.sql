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
--
-- Batching guidance (large tables): wrap this UPDATE (and step 3) in a loop
-- over bounded batches and a statement_timeout, e.g.:
--   SET statement_timeout = '10min';
--   UPDATE public.activities SET status = ...
--    WHERE status IS NULL AND id IN (
--      SELECT id FROM public.activities
--       WHERE status IS NULL ORDER BY created_at LIMIT 50000);
-- Repeat until no rows remain, or run the same batches inside a DO block
-- with pg_sleep between iterations to avoid hammering the primary.
UPDATE public.activities
SET status = CASE WHEN completed THEN 'COMPLETED' ELSE 'PENDING' END
WHERE status IS NULL;

-- 3. Backfill Instagram read_at from completed_at with created_at fallback
--
-- ONE-TIME HISTORICAL MAPPING (do not re-run, do not keep in sync): legacy
-- rows coupled "completed => read" — the old /read endpoint marked a message
-- read by setting completed=true. This UPDATE translates that historical
-- coupling into read_at exactly once. Going forward, completion NEVER
-- implies read and read NEVER implies completion (BR-3): moveStatus and
-- markRead/markUnread write the two surfaces independently, and no trigger
-- may keep read_at coupled to completed. See docs/activities-status-rollout.md
-- "Backfill vs BR-3" for the post-deploy checks that must NOT flag these rows.
UPDATE public.activities
SET read_at = COALESCE(completed_at, created_at, now())
WHERE type = 'INSTAGRAM_MESSAGE'
  AND completed = true
  AND read_at IS NULL;

-- 4. Add CHECK constraint over the three enum values
--
-- Two-phase (NOT VALID + VALIDATE CONSTRAINT): ADD CONSTRAINT ... NOT VALID
-- only takes a brief catalog lock; the full-row scan happens under the weaker
-- SHARE UPDATE EXCLUSIVE lock during VALIDATE, avoiding a long ACCESS
-- EXCLUSIVE block on a large table. The backfill above guarantees the data
-- already satisfies the check, so validation is a fast no-op scan.
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_status_check
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')) NOT VALID;
ALTER TABLE public.activities VALIDATE CONSTRAINT activities_status_check;

COMMIT;