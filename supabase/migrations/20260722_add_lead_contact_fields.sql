-- Add lead contact enrichment fields
-- job_title: professional role/position of the contact person
-- linkedin_url: LinkedIn profile URL
-- estimated_value: estimated deal value for prioritization
-- next_follow_up: next follow-up date to avoid cold leads

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMPTZ;
