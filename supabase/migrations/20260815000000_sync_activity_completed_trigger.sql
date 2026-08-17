-- Activity completed sync hook migration (CF-1, slice 4 — rollout step 5)
--
-- FINAL safety-net migration for the activity status surface. Deployed LAST,
-- gated until the post-deploy invariant check (step 4 in
-- docs/activities-status-rollout.md) has passed with zero violating rows:
--
--   SELECT count(*) FROM public.activities
--   WHERE completed IS DISTINCT FROM (status = 'COMPLETED');
--
-- Every writer has already been migrated to dual-write
-- `completed = (status = 'COMPLETED')` in code (rollout steps 1–3), so in
-- normal operation this BEFORE INSERT/UPDATE sync function never flips a
-- write. It exists purely as a safety net: if any future code path writes
-- `status` without keeping the legacy boolean in sync, the sync function
-- re-derives `completed` so the two surfaces can never diverge.
--
-- BR-3: this sync function touches ONLY `completed`. It deliberately does
-- NOT write `read_at` — completion never implies read and read never
-- implies completion. Do not add read_at coupling here.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS before
-- CREATE TRIGGER, matching the leads sync convention
-- (20240509200500_sync_lead_status_trigger.sql).
--
-- Rollout runbook: docs/activities-status-rollout.md

BEGIN;

-- Sync function: re-derive the legacy completed boolean from status.
CREATE OR REPLACE FUNCTION public.fn_sync_activity_completed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completed := (NEW.status = 'COMPLETED');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Safety net: keep completed in sync on every insert/update of activities.
DROP TRIGGER IF EXISTS tr_sync_activity_completed ON public.activities;
CREATE TRIGGER tr_sync_activity_completed
BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_activity_completed();

COMMIT;