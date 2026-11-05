-- Messaging pipeline — migration D (S1, S6)
--
-- 1. messaging_record_echo: when another transaction stores the same mid
--    concurrently (echo redelivery, or messaging_mark_sent with the mid the
--    echo carries), the fallback INSERT hits messages_external_id_uq. That is
--    a duplicate echo: return outcome 'duplicate' with the existing message id
--    instead of raising (before this migration the webhook event failed and
--    cost one sweep retry). Every other path is identical to
--    20261103000000_messaging_tables.sql; any other unique violation re-raises.
-- 2. conversations.unread_count >= 0 enforced by a CHECK (S1). Added NOT VALID
--    and then validated; skipped when the constraint already exists.
--
-- Behaviour tests (pnpm test:db, local only): supabase/tests/run.sh probes
-- P2a/P4a and supabase/tests/read_state.sql section 3.

BEGIN;

CREATE OR REPLACE FUNCTION public.messaging_record_echo(
  p_conversation_id uuid,
  p_external_id text,
  p_body text,
  p_event_at timestamptz,
  p_raw jsonb,
  p_legacy jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
  v_user_id uuid;
  v_legacy_id uuid;
  v_outcome text := 'inserted';
  v_constraint text;
BEGIN
  SELECT user_id INTO v_user_id FROM public.conversations WHERE id = p_conversation_id;

  -- Idempotency: a message with this mid already exists -> skip
  IF EXISTS (
    SELECT 1 FROM public.messages
    WHERE external_id = p_external_id AND external_id IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('outcome', 'duplicate', 'message_id', (SELECT id FROM public.messages WHERE external_id = p_external_id LIMIT 1));
  END IF;

  -- ADR-12: adopt the most recent out/pending-or-failed row with same body,
  -- created within 2 minutes before the echo event's own timestamp.
  BEGIN
    SELECT m.id INTO v_message_id
    FROM public.messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'out'
      AND m.external_id IS NULL
      AND m.status IN ('pending', 'failed')
      AND m.body = p_body
      AND m.created_at >= p_event_at - interval '2 minutes'
      AND m.created_at <= p_event_at
    ORDER BY m.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_message_id IS NOT NULL THEN
      v_outcome := 'adopted';

      UPDATE public.messages
      SET external_id = p_external_id,
          status = 'sent',
          error_message = NULL,
          hint = NULL,
          updated_at = now()
      WHERE id = v_message_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_message_id := NULL;
  END;

  IF v_message_id IS NULL THEN
    -- No row to adopt -> insert a new out/sent message
    BEGIN
      INSERT INTO public.messages (
        user_id, conversation_id, direction, origin, type, body,
        external_id, status, raw_payload, created_at, updated_at
      )
      VALUES (
        v_user_id, p_conversation_id, 'out', 'human', 'text', p_body,
        p_external_id, 'sent', p_raw, p_event_at, p_event_at
      )
      RETURNING id INTO v_message_id;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'messages_external_id_uq' THEN
        RAISE;
      END IF;
      -- A concurrent transaction committed this mid first -> duplicate echo
      RETURN jsonb_build_object('outcome', 'duplicate', 'message_id', (SELECT id FROM public.messages WHERE external_id = p_external_id LIMIT 1));
    END;
  END IF;

  -- Ensure exactly one legacy activity (ADR-7 / JD-7)
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.activities a ON a.id = m.legacy_activity_id
    WHERE m.id = v_message_id
  ) THEN
    INSERT INTO public.activities (
      user_id, lead_id, type, title, description, created_at, updated_at
    )
    SELECT
      c.user_id, c.lead_id, 'INSTAGRAM_MESSAGE',
      COALESCE(p_legacy->>'title', 'Instagram DM to ' || c.external_id),
      p_body, p_event_at, p_event_at
    FROM public.conversations c
    WHERE c.id = p_conversation_id
    RETURNING id INTO v_legacy_id;

    UPDATE public.messages
    SET legacy_activity_id = v_legacy_id
    WHERE id = v_message_id;
  END IF;

  -- Update conversation last_message_*
  UPDATE public.conversations
  SET last_message_at = GREATEST(COALESCE(last_message_at, p_event_at), p_event_at),
      last_message_preview = p_body,
      updated_at = now()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object('outcome', v_outcome, 'message_id', v_message_id);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_unread_count_nonneg'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_unread_count_nonneg CHECK (unread_count >= 0) NOT VALID;
    ALTER TABLE public.conversations
      VALIDATE CONSTRAINT conversations_unread_count_nonneg;
  END IF;
END;
$$;

COMMIT;
