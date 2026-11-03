-- Messaging pipeline data model (Phase 1)
--
-- Creates the conversations, messages, channel_accounts and webhook_events
-- tables, the atomic ingest/echo/deliver/claim SQL functions (ADR-10), RLS
-- policies, FK indexes and the realtime publication.
--
-- Rollout runbook: docs/messaging-pipeline-rollout.md
-- See also: openspec/changes/messaging-pipeline/design.md (§4, ADR-10)

BEGIN;

-- 1. channel_accounts — one connected sender identity per user
CREATE TABLE IF NOT EXISTS public.channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  channel text NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
  external_account_id text NOT NULL, -- ig_id / page_id / phone_number_id
  page_id text,
  display_name text,
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_account_id)
);

-- 2. conversations — one thread per channel account and external participant
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  lead_id uuid REFERENCES public.leads(id),
  account_id uuid REFERENCES public.channel_accounts(id),
  channel text NOT NULL DEFAULT 'meta',
  external_id text NOT NULL, -- IGSID / PSID / wa_id
  participant_name text,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);

-- 3. messages — one row per inbound/outbound message
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  origin text CHECK (origin IN ('human', 'agent', 'template', 'auto')),
  type text NOT NULL DEFAULT 'text',
  body text,
  external_id text, -- Meta mid
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending', 'sent', 'delivered', 'read', 'failed')),
  error_message text,
  hint text,
  legacy_activity_id uuid UNIQUE, -- link to the public.activities timeline row
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uq
  ON public.messages (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at);

-- 4. webhook_events — idempotent claim + retry sweep queue
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id text PRIMARY KEY,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_status_idx
  ON public.webhook_events (status, received_at);

-- 5. FK indexes
CREATE INDEX IF NOT EXISTS conversations_user_id_last_message_at_idx
  ON public.conversations (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_lead_id_idx
  ON public.conversations (lead_id);

-- 6. RLS — ownership on every referenced row, not only user_id
ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_accounts_user_owned ON public.channel_accounts;
CREATE POLICY channel_accounts_user_owned ON public.channel_accounts
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS conversations_user_owned ON public.conversations;
CREATE POLICY conversations_user_owned ON public.conversations
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND account_id IN (
      SELECT id FROM public.channel_accounts WHERE user_id = (SELECT auth.uid())
    )
    AND (
      lead_id IS NULL
      OR lead_id IN (SELECT id FROM public.leads WHERE user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS messages_user_owned ON public.messages;
CREATE POLICY messages_user_owned ON public.messages
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND conversation_id IN (
      SELECT id FROM public.conversations WHERE user_id = (SELECT auth.uid())
    )
  );

-- webhook_events: RLS enabled but NO policy for authenticated/anon —
-- service-role client only. Kept policy-free on purpose (JD-10).

-- 7. Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations, public.messages;

-- 8. ADR-10 — one transaction per state change, SECURITY INVOKER functions

-- 8.1 Ingest a single inbound message (atomic: message + legacy activity + counters)
CREATE OR REPLACE FUNCTION public.messaging_ingest_inbound(
  p_conversation_id uuid,
  p_external_id text,
  p_type text,
  p_body text,
  p_raw jsonb,
  p_at timestamptz,
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
  v_inserted boolean := false;
BEGIN
  -- Resolve the owning user from the conversation (application guarantees it exists)
  SELECT user_id INTO v_user_id FROM public.conversations WHERE id = p_conversation_id;

  -- Insert the message; idempotent on external_id (a re-sent mid is a no-op)
  INSERT INTO public.messages (
    user_id, conversation_id, direction, origin, type, body,
    external_id, status, raw_payload, created_at, updated_at
  )
  VALUES (
    v_user_id, p_conversation_id, 'in', 'human', p_type, p_body,
    p_external_id, 'received', p_raw, p_at, p_at
  )
  ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_message_id;

  IF v_message_id IS NOT NULL THEN
    v_inserted := true;

    -- Write the legacy timeline activity and link it (same transaction, JD-1 / JD-12)
    INSERT INTO public.activities (
      user_id, lead_id, type, title, description, created_at, updated_at
    )
    SELECT
      c.user_id, c.lead_id, 'INSTAGRAM_MESSAGE',
      COALESCE(p_legacy->>'title', 'Instagram DM from ' || c.external_id),
      p_body, p_at, p_at
    FROM public.conversations c
    WHERE c.id = p_conversation_id
    RETURNING id INTO v_legacy_id;

    UPDATE public.messages
    SET legacy_activity_id = v_legacy_id
    WHERE id = v_message_id;

    -- Update conversation counters
    UPDATE public.conversations
    SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, p_at), p_at),
        last_message_at = GREATEST(COALESCE(last_message_at, p_at), p_at),
        last_message_preview = p_body,
        unread_count = unread_count + 1,
        updated_at = now()
    WHERE id = p_conversation_id;
  END IF;

  RETURN jsonb_build_object('inserted', v_inserted, 'message_id', v_message_id);
END;
$$;

-- 8.2 Record an echo (outbound message sent from the channel or native app)
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
    INSERT INTO public.messages (
      user_id, conversation_id, direction, origin, type, body,
      external_id, status, raw_payload, created_at, updated_at
    )
    VALUES (
      v_user_id, p_conversation_id, 'out', 'human', 'text', p_body,
      p_external_id, 'sent', p_raw, p_event_at, p_event_at
    )
    RETURNING id INTO v_message_id;
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

-- 8.3 Mark a sent message (called after a successful Graph send)
CREATE OR REPLACE FUNCTION public.messaging_mark_sent(
  p_message_id uuid,
  p_external_id text,
  p_legacy jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_user_id uuid;
  v_legacy_id uuid;
BEGIN
  -- Only flip pending -> sent; an echo-adopted row stays sent (no downgrade)
  UPDATE public.messages
  SET status = 'sent',
      external_id = p_external_id,
      updated_at = now()
  WHERE id = p_message_id
    AND status = 'pending';

  -- Ensure the legacy activity exists (this call or an earlier echo made it sent)
  SELECT m.conversation_id, m.user_id INTO v_conversation_id, v_user_id
  FROM public.messages m WHERE m.id = p_message_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.activities a WHERE a.id = (SELECT legacy_activity_id FROM public.messages WHERE id = p_message_id)
  ) THEN
    INSERT INTO public.activities (
      user_id, lead_id, type, title, description, created_at, updated_at
    )
    SELECT
      v_user_id, c.lead_id, 'INSTAGRAM_MESSAGE',
      COALESCE(p_legacy->>'title', 'Instagram DM to ' || c.external_id),
      (SELECT body FROM public.messages WHERE id = p_message_id),
      now(), now()
    FROM public.conversations c WHERE c.id = v_conversation_id
    RETURNING id INTO v_legacy_id;

    UPDATE public.messages
    SET legacy_activity_id = v_legacy_id
    WHERE id = p_message_id;
  END IF;

  -- Update conversation last_message_* on success
  UPDATE public.conversations
  SET last_message_at = GREATEST(COALESCE(last_message_at, now()), now()),
      last_message_preview = (SELECT body FROM public.messages WHERE id = p_message_id),
      updated_at = now()
  WHERE id = v_conversation_id;

  RETURN jsonb_build_object(
    'id', p_message_id,
    'status', 'sent',
    'external_id', p_external_id,
    'conversation_id', v_conversation_id
  );
END;
$$;

-- 8.4 Claim up to p_limit retryable events atomically (ADR-5)
CREATE OR REPLACE FUNCTION public.messaging_claim_retry(p_limit int)
RETURNS TABLE (
  event_id text,
  provider text,
  payload jsonb,
  attempts int
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.webhook_events
  SET attempts = attempts + 1
  WHERE event_id IN (
    SELECT event_id
    FROM public.webhook_events
    WHERE status = 'received'
      AND attempts < 3
      AND received_at < now() - interval '2 minutes'
    ORDER BY received_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING event_id, provider, payload, attempts;
END;
$$;

-- 8.5 Mark a set of conversations as read (unread_count = 0 + read_at on legacy activities)
CREATE OR REPLACE FUNCTION public.messaging_set_conversations_read(p_conversation_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET unread_count = 0,
      updated_at = now()
  WHERE id = ANY(p_conversation_ids);

  UPDATE public.activities a
  SET read_at = now()
  FROM public.messages m
  WHERE a.id = m.legacy_activity_id
    AND m.conversation_id = ANY(p_conversation_ids)
    AND m.direction = 'in'
    AND a.type = 'INSTAGRAM_MESSAGE'
    AND a.read_at IS NULL;
END;
$$;

-- 8.6 Sync conversation unread_count when an activity's read_at actually changes
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
  -- Find the conversation linked through messages.legacy_activity_id
  SELECT c.id INTO v_conversation_id
  FROM public.activities a
  JOIN public.messages m ON m.legacy_activity_id = a.id
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE a.id = p_activity_id
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    RETURN; -- activity not linked to a message (not copied) -> nothing to sync
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