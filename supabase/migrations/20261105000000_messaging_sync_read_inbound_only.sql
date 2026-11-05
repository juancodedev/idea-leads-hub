-- Messaging pipeline — migration C (S12)
--
-- messaging_sync_legacy_read only adjusts conversations.unread_count for
-- INBOUND legacy activities. unread_count counts unread inbound messages, so
-- marking an outbound legacy activity read or unread must not change it
-- (before this migration it did: unread +1 / -1 for an outbound activity).
--
-- Same signature, SECURITY INVOKER and search_path as in
-- 20261103000000_messaging_tables.sql. The caller writes activities.read_at
-- after this call; this function never writes public.activities.
-- Behaviour test: supabase/tests/read_state.sql (pnpm test:db, local only).

BEGIN;

CREATE OR REPLACE FUNCTION public.messaging_sync_legacy_read(
  p_activity_id uuid,
  p_read boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_was_read boolean;
BEGIN
  -- Conversation linked through an INBOUND message's legacy_activity_id
  SELECT c.id INTO v_conversation_id
  FROM public.activities a
  JOIN public.messages m ON m.legacy_activity_id = a.id
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE a.id = p_activity_id
    AND m.direction = 'in'
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    RETURN; -- not linked to an inbound message -> nothing to sync
  END IF;

  -- Only act when read_at actually changes
  SELECT (read_at IS NOT NULL) INTO v_was_read
  FROM public.activities WHERE id = p_activity_id;

  IF p_read AND NOT v_was_read THEN
    UPDATE public.conversations
    SET unread_count = GREATEST(unread_count - 1, 0),
        updated_at = now()
    WHERE id = v_conversation_id;
  ELSIF NOT p_read AND v_was_read THEN
    UPDATE public.conversations
    SET unread_count = unread_count + 1,
        updated_at = now()
    WHERE id = v_conversation_id;
  END IF;
END;
$$;

COMMIT;
