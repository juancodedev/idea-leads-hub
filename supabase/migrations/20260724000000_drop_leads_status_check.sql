-- Drop the leads_status_check constraint since status is now synced from
-- pipeline_stages.name via the tr_sync_lead_status trigger, and users can
-- create arbitrary pipeline stage names.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
