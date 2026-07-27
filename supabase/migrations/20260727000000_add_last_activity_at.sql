-- Add last_activity_at to leads for accurate pipeline card dates
--
-- Currently, PipelineCard.tsx shows lead.createdAt because lastActivityAt
-- is only computed from the activities table (emails, IG messages, etc.)
-- but NOT from notes, stage changes, or lead updates.
--
-- This migration:
--   1. Adds last_activity_at column to leads
--   2. Creates triggers to keep it in sync on:
--      - notes INSERT (notes are the most common interaction)
--      - activities INSERT (emails, IG messages, tasks)
--      - leads INSERT/UPDATE (stage changes, profile edits)
--   3. Backfills existing leads

-- 1. Add column (nullable — no default, computed from existing data)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- 2. Trigger functions (one per table — each only accesses fields on its own table)

-- Notes: after-insert, update the parent lead's last_activity_at
CREATE OR REPLACE FUNCTION public.fn_notes_touch_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET last_activity_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Activities: after-insert, update the parent lead's last_activity_at
CREATE OR REPLACE FUNCTION public.fn_activities_touch_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET last_activity_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old shared function to avoid confusion (triggers
-- now use dedicated per-table functions above)
DROP FUNCTION IF EXISTS public.fn_touch_lead_last_activity();

-- Leads: before insert or update, set last_activity_at = NOW()
CREATE OR REPLACE FUNCTION public.fn_leads_set_last_activity_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Triggers

-- Notes: when a note is added to a lead, update its last_activity_at
DROP TRIGGER IF EXISTS tr_notes_touch_lead_last_activity ON public.notes;
CREATE TRIGGER tr_notes_touch_lead_last_activity
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notes_touch_lead_last_activity();

-- Activities: when an activity (email, IG message, etc.) is linked to a lead
DROP TRIGGER IF EXISTS tr_activities_touch_lead_last_activity ON public.activities;
CREATE TRIGGER tr_activities_touch_lead_last_activity
  AFTER INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_activities_touch_lead_last_activity();

-- Leads: auto-set last_activity_at on insert and any update (new lead, stage change, profile edit, etc.)
DROP TRIGGER IF EXISTS tr_leads_set_last_activity_at ON public.leads;
CREATE TRIGGER tr_leads_set_last_activity_at
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_leads_set_last_activity_at();

-- 4. Backfill existing leads: set last_activity_at to the most recent of
--    created_at, updated_at, latest note, and latest activity
UPDATE public.leads l
SET last_activity_at = (
  SELECT GREATEST(
    l.created_at,
    l.updated_at,
    COALESCE((SELECT MAX(a.created_at) FROM public.activities a WHERE a.lead_id = l.id), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(n.created_at) FROM public.notes n WHERE n.lead_id = l.id), '-infinity'::timestamptz)
  )
);

-- 5. Add an index for potential sorting/filtering by last_activity_at
CREATE INDEX IF NOT EXISTS idx_leads_last_activity_at ON public.leads (last_activity_at DESC);

COMMENT ON COLUMN public.leads.last_activity_at IS 'Set automatically by triggers on notes/activities INSERT and leads INSERT/UPDATE. Reflects the most recent interaction with this lead.';
