-- Idempotent notes and activities for integrations.
--
-- external_id: client-owned identifier for the note or activity, e.g.
--   "cafe-lindo.cl#correo-1". Unique per user, so re-sending the same payload
--   (the Prospector re-pushes on every button press) upserts instead of
--   duplicating the row.

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_external_id_length;
ALTER TABLE public.notes ADD CONSTRAINT notes_external_id_length
  CHECK (external_id IS NULL OR char_length(external_id) <= 200);

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_external_id_length;
ALTER TABLE public.activities ADD CONSTRAINT activities_external_id_length
  CHECK (external_id IS NULL OR char_length(external_id) <= 200);

CREATE UNIQUE INDEX IF NOT EXISTS notes_user_external_id_key
  ON public.notes (user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS activities_user_external_id_key
  ON public.activities (user_id, external_id)
  WHERE external_id IS NOT NULL;
