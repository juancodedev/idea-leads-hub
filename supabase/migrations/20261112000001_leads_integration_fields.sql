-- Lead integration + qualification fields.
--
-- external_id: client-owned identifier (e.g. the prospect domain). Unique per
--   user so a retried integration send or a repeated backfill upserts instead
--   of duplicating the lead.
-- city / industry: location and business category used to prioritize.
-- opportunity_score: imported prioritization score (0-100).
-- rating / reviews_count: marketplace reputation signals.

ALTER TABLE public.leads
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_score INTEGER,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_opportunity_score_range;
ALTER TABLE public.leads ADD CONSTRAINT leads_opportunity_score_range
  CHECK (opportunity_score IS NULL OR opportunity_score BETWEEN 0 AND 100);

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_rating_range;
ALTER TABLE public.leads ADD CONSTRAINT leads_rating_range
  CHECK (rating IS NULL OR rating BETWEEN 0 AND 5);

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_reviews_count_non_negative;
ALTER TABLE public.leads ADD CONSTRAINT leads_reviews_count_non_negative
  CHECK (reviews_count IS NULL OR reviews_count >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS leads_user_external_id_key
  ON public.leads (user_id, external_id)
  WHERE external_id IS NOT NULL;
