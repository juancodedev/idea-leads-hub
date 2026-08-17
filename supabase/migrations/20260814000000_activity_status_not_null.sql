-- Activity status NOT NULL migration (CF-1, slice 4 — rollout step 4)
--
-- FINAL rollout migration for the activity status surface. Locks the
-- invariant: this migration applies ONLY after every legacy `completed`
-- writer has been migrated to the status surface (rollout steps 1–3) and
-- the post-deploy invariant check has passed:
--
--   SELECT count(*) FROM public.activities
--   WHERE completed IS DISTINCT FROM (status = 'COMPLETED');
--
--   Expected: zero rows (see docs/activities-status-rollout.md).
--
-- Defensive/idempotent: repairs any straggler rows that a legacy writer
-- created without `status` in the window between the data-prep migration
-- (20260813000001) and this one, then SET DEFAULT 'PENDING' closes the hole
-- for future writers, and SET NOT NULL enforces it. Re-running is safe:
-- the backfill matches rows only when `status IS NULL`, and SET DEFAULT /
-- SET NOT NULL are idempotent ALTER statements.
--
-- Rollout runbook: docs/activities-status-rollout.md

BEGIN;

-- 1. Repair stragglers (idempotent): rows created by legacy writers between
--    the data-prep migration and the code deploy have `status IS NULL`.
--    Backfill them with the same mapping the data-prep migration used so
--    the `completed = (status = 'COMPLETED')` invariant holds everywhere.
UPDATE public.activities
SET status = CASE WHEN completed THEN 'COMPLETED' ELSE 'PENDING' END
WHERE status IS NULL;

-- 2. Set the default for all future writes.
ALTER TABLE public.activities
  ALTER COLUMN status SET DEFAULT 'PENDING';

-- 3. Enforce the invariant: every row now carries an explicit status.
ALTER TABLE public.activities
  ALTER COLUMN status SET NOT NULL;

COMMIT;