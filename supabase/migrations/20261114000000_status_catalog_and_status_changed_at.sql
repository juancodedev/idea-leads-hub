-- Two-way sync support for the Prospector integration.
--
-- status_changed_at: when the lead's status last changed. The integration polls
--   `GET /api/leads?updatedSince=...` to notice a lead the user marked as
--   do-not-contact; filtering on updated_at would also count a contact-data push
--   as a change made in the CRM.
--
-- pipeline_stages.is_do_not_contact: marks the statuses that mean "stop writing
--   to this lead". Published by GET /api/leads/statuses as `doNotContact`.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Backfill without pretending every row just changed.
UPDATE public.leads
SET status_changed_at = COALESCE(updated_at, created_at, now())
WHERE status_changed_at IS NULL;

ALTER TABLE public.leads ALTER COLUMN status_changed_at SET DEFAULT now();
ALTER TABLE public.leads ALTER COLUMN status_changed_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS leads_user_status_changed_at_idx
  ON public.leads (user_id, status_changed_at);

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS is_do_not_contact BOOLEAN NOT NULL DEFAULT false;

-- Existing installs already have lost/discarded stages: flag them so the
-- integration can stop its sequence without waiting for someone to toggle them.
UPDATE public.pipeline_stages
SET is_do_not_contact = true
WHERE is_do_not_contact = false
  AND lower(translate(name, 'áéíóúÁÉÍÓÚüÜ', 'aeiouAEIOUuU')) IN (
    'perdido', 'perdida', 'descartado', 'descartada', 'reboto', 'rebotado',
    'no contactar', 'no enviar', 'no llamar'
  );

-- Keep status_changed_at honest: only a status change moves it.
CREATE OR REPLACE FUNCTION public.fn_sync_lead_status_with_stage()
RETURNS TRIGGER AS $$
BEGIN
    -- CASO 1: Cambia la Etapa (stage_id) -> Actualizamos el texto del status
    IF (NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id IS NOT NULL) THEN
        SELECT name INTO NEW.status
        FROM public.pipeline_stages
        WHERE id = NEW.stage_id;

    -- CASO 2: Cambia el texto del status -> Actualizamos el stage_id
    ELSIF (NEW.status IS DISTINCT FROM OLD.status OR (NEW.stage_id IS NULL AND NEW.status IS NOT NULL)) THEN
        SELECT id INTO NEW.stage_id
        FROM public.pipeline_stages
        WHERE name ILIKE NEW.status
        AND user_id = NEW.user_id
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- status_changed_at: tracks status changes only, so a data push does not
    -- look like a change made in the CRM.
    IF TG_OP = 'INSERT' THEN
        NEW.status_changed_at := COALESCE(NEW.status_changed_at, now());
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.status_changed_at := now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_lead_status ON public.leads;
CREATE TRIGGER tr_sync_lead_status
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_lead_status_with_stage();