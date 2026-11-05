-- Messaging pipeline history backfill (Migration B, S9 / BR-9)
--
-- Defines public.messaging_backfill_instagram_history(). This migration ONLY
-- defines the function; it does not run it. The operator runs it from the SQL
-- editor right after applying this migration and again after the code deploy
-- (rollout runbook: docs/messaging-pipeline-rollout.md), recording the jsonb
-- summary it returns each time.
--
-- The function, in the caller's transaction:
--   1. seeds channel_accounts from user_secrets (instagram_ig_id), so the new
--      webhook can resolve owners for users who never reconnected (ADR-7);
--   2. creates a 'disconnected' placeholder account ('legacy:<user_id>') for
--      users with parseable legacy DMs but no Instagram account row;
--   3. creates one conversation per (user, IGSID parsed from the title);
--   4. copies each INSTAGRAM_MESSAGE activity into messages, keyed by
--      legacy_activity_id (ADR-9): activities already linked by new code or by
--      an earlier run are never copied again;
--   5. updates counters ADDITIVELY for the rows copied in this run only, so a
--      re-run never overwrites counts changed by live traffic.
--
-- Purely additive on legacy data: activities, leads and user_secrets are only
-- read. Idempotent: a second call copies nothing and changes no counter.
-- Activities whose title is not "Instagram DM from <digits>" or
-- "Instagram DM to <digits>" are left uncopied and counted.
--
-- See also: openspec/changes/messaging-pipeline/design.md (§4 Migration B)

BEGIN;

CREATE OR REPLACE FUNCTION public.messaging_backfill_instagram_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title_pattern constant text := '^Instagram DM (?:from|to) (\d+)$';
  v_accounts_seeded int := 0;
  v_accounts_conflicting int := 0;
  v_placeholders int := 0;
  v_conversations_created int := 0;
  v_conversations_updated int := 0;
  v_already_copied int := 0;
  v_unparseable int := 0;
  v_parseable_pending int := 0;
  v_copied int := 0;
  v_copied_in int := 0;
  v_copied_out int := 0;
  v_copied_unread int := 0;
  v_copied_placeholder int := 0;
  v_summary jsonb;
BEGIN
  -- Two concurrent runs would otherwise race on the same conversations.
  PERFORM pg_advisory_xact_lock(hashtext('public.messaging_backfill_instagram_history'));

  -- 1. channel_accounts from user_secrets (never overwrites an existing row)
  INSERT INTO public.channel_accounts (user_id, channel, external_account_id, page_id, status)
  SELECT us.user_id,
         'instagram',
         btrim(us.instagram_ig_id),
         NULLIF(btrim(us.instagram_page_id), ''),
         'connected'
  FROM public.user_secrets us
  WHERE NULLIF(btrim(us.instagram_ig_id), '') IS NOT NULL
  ON CONFLICT (channel, external_account_id) DO NOTHING;
  GET DIAGNOSTICS v_accounts_seeded = ROW_COUNT;

  -- Credentials whose IG id already belongs to another user's account: not
  -- seeded (the unique key is global), reported for manual review.
  SELECT count(*) INTO v_accounts_conflicting
  FROM public.user_secrets us
  JOIN public.channel_accounts ca
    ON ca.channel = 'instagram'
   AND ca.external_account_id = btrim(us.instagram_ig_id)
  WHERE ca.user_id <> us.user_id;

  -- Activity census (before copying): unparseable titles and already linked rows
  SELECT
    count(*) FILTER (WHERE substring(a.title FROM v_title_pattern) IS NULL),
    count(*) FILTER (
      WHERE substring(a.title FROM v_title_pattern) IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.messages m WHERE m.legacy_activity_id = a.id)
    ),
    count(*) FILTER (
      WHERE substring(a.title FROM v_title_pattern) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.legacy_activity_id = a.id)
    )
  INTO v_unparseable, v_already_copied, v_parseable_pending
  FROM public.activities a
  WHERE a.type = 'INSTAGRAM_MESSAGE';

  -- 2. Placeholder accounts for users with parseable DMs but no Instagram account
  INSERT INTO public.channel_accounts (user_id, channel, external_account_id, status)
  SELECT DISTINCT a.user_id, 'instagram', 'legacy:' || a.user_id::text, 'disconnected'
  FROM public.activities a
  WHERE a.type = 'INSTAGRAM_MESSAGE'
    AND substring(a.title FROM v_title_pattern) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.channel_accounts ca
      WHERE ca.user_id = a.user_id AND ca.channel = 'instagram'
    )
  ON CONFLICT (channel, external_account_id) DO NOTHING;
  GET DIAGNOSTICS v_placeholders = ROW_COUNT;

  -- 3. One conversation per (user, IGSID) that has none yet on any of the
  --    user's Instagram accounts. Target account: the one matching the user's
  --    stored credentials, else a connected one, else the oldest (placeholder).
  WITH pending AS (
    SELECT a.id, a.user_id, a.lead_id, a.created_at,
           substring(a.title FROM v_title_pattern) AS igsid
    FROM public.activities a
    WHERE a.type = 'INSTAGRAM_MESSAGE'
      AND substring(a.title FROM v_title_pattern) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.legacy_activity_id = a.id)
  ),
  target AS (
    SELECT DISTINCT ON (ca.user_id) ca.user_id, ca.id AS account_id
    FROM public.channel_accounts ca
    LEFT JOIN public.user_secrets us ON us.user_id = ca.user_id
    WHERE ca.channel = 'instagram'
    ORDER BY ca.user_id,
             (ca.external_account_id = btrim(us.instagram_ig_id)) DESC NULLS LAST,
             (ca.status = 'connected') DESC,
             ca.created_at, ca.id
  ),
  grouped AS (
    SELECT p.user_id, p.igsid,
           min(p.created_at) AS first_at,
           -- latest lead among this participant's activities, owned by the user
           (array_agg(p.lead_id ORDER BY p.created_at DESC)
              FILTER (WHERE l.id IS NOT NULL))[1] AS activity_lead_id
    FROM pending p
    LEFT JOIN public.leads l ON l.id = p.lead_id AND l.user_id = p.user_id
    GROUP BY p.user_id, p.igsid
  )
  INSERT INTO public.conversations (
    user_id, account_id, channel, external_id, lead_id, unread_count, created_at, updated_at
  )
  SELECT g.user_id, t.account_id, 'instagram', g.igsid,
         COALESCE(
           g.activity_lead_id,
           (SELECT l.id FROM public.leads l
            WHERE l.user_id = g.user_id AND l.instagram_scoped_id = g.igsid
            ORDER BY l.created_at DESC, l.id
            LIMIT 1)
         ),
         0, g.first_at, now()
  FROM grouped g
  JOIN target t ON t.user_id = g.user_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.channel_accounts ca ON ca.id = c.account_id AND ca.channel = 'instagram'
    WHERE c.user_id = g.user_id AND c.external_id = g.igsid
  )
  ON CONFLICT (account_id, external_id) DO NOTHING;
  GET DIAGNOSTICS v_conversations_created = ROW_COUNT;

  -- 4 + 5. Copy messages, then add exactly what was copied to the counters.
  WITH pending AS (
    SELECT a.id, a.user_id, a.description, a.created_at, a.read_at,
           substring(a.title FROM v_title_pattern) AS igsid,
           CASE WHEN a.title LIKE 'Instagram DM from %' THEN 'in' ELSE 'out' END AS direction
    FROM public.activities a
    WHERE a.type = 'INSTAGRAM_MESSAGE'
      AND substring(a.title FROM v_title_pattern) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.legacy_activity_id = a.id)
  ),
  target AS (
    SELECT DISTINCT ON (ca.user_id) ca.user_id, ca.id AS account_id
    FROM public.channel_accounts ca
    LEFT JOIN public.user_secrets us ON us.user_id = ca.user_id
    WHERE ca.channel = 'instagram'
    ORDER BY ca.user_id,
             (ca.external_account_id = btrim(us.instagram_ig_id)) DESC NULLS LAST,
             (ca.status = 'connected') DESC,
             ca.created_at, ca.id
  ),
  -- the user's conversation for this IGSID, preferring the target account
  conv AS (
    SELECT DISTINCT ON (c.user_id, c.external_id)
           c.user_id, c.external_id, c.id AS conversation_id,
           ca.status = 'disconnected' AND ca.external_account_id LIKE 'legacy:%' AS is_placeholder
    FROM public.conversations c
    JOIN public.channel_accounts ca ON ca.id = c.account_id AND ca.channel = 'instagram'
    LEFT JOIN target t ON t.user_id = c.user_id
    ORDER BY c.user_id, c.external_id,
             (c.account_id = t.account_id) DESC NULLS LAST,
             c.created_at, c.id
  ),
  ins AS (
    INSERT INTO public.messages (
      user_id, conversation_id, direction, origin, type, body, external_id,
      status, legacy_activity_id, raw_payload, read_at, created_at, updated_at
    )
    SELECT p.user_id, cv.conversation_id, p.direction, 'human', 'text', p.description,
           NULL::text,
           CASE WHEN p.direction = 'in' THEN 'received' ELSE 'sent' END,
           p.id,
           jsonb_build_object('source', 'legacy_backfill'),
           CASE WHEN p.direction = 'in' THEN p.read_at END,
           p.created_at, p.created_at
    FROM pending p
    JOIN conv cv ON cv.user_id = p.user_id AND cv.external_id = p.igsid
    ON CONFLICT (legacy_activity_id) DO NOTHING
    RETURNING conversation_id, direction, body, read_at, created_at, legacy_activity_id
  ),
  agg AS (
    SELECT i.conversation_id,
           count(*) FILTER (WHERE i.direction = 'in' AND i.read_at IS NULL) AS unread,
           max(i.created_at) FILTER (WHERE i.direction = 'in') AS last_in,
           max(i.created_at) AS last_at,
           (array_agg(i.body ORDER BY i.created_at DESC, i.legacy_activity_id DESC))[1] AS preview
    FROM ins i
    GROUP BY i.conversation_id
  ),
  upd AS (
    UPDATE public.conversations c
    SET unread_count = c.unread_count + agg.unread,
        last_inbound_at = GREATEST(c.last_inbound_at, agg.last_in),
        last_message_at = GREATEST(c.last_message_at, agg.last_at),
        last_message_preview = CASE
          WHEN c.last_message_at IS NULL OR agg.last_at >= c.last_message_at THEN agg.preview
          ELSE c.last_message_preview
        END,
        updated_at = now()
    FROM agg
    WHERE c.id = agg.conversation_id
    RETURNING c.id
  )
  SELECT
    (SELECT count(*) FROM ins),
    (SELECT count(*) FROM ins WHERE direction = 'in'),
    (SELECT count(*) FROM ins WHERE direction = 'out'),
    (SELECT count(*) FROM ins WHERE direction = 'in' AND read_at IS NULL),
    (SELECT count(*) FROM ins i JOIN conv cv ON cv.conversation_id = i.conversation_id
      WHERE cv.is_placeholder),
    (SELECT count(*) FROM upd)
  INTO v_copied, v_copied_in, v_copied_out, v_copied_unread, v_copied_placeholder,
       v_conversations_updated;

  v_summary := jsonb_build_object(
    'accounts_seeded', v_accounts_seeded,
    'accounts_conflicting', v_accounts_conflicting,
    'placeholder_accounts_created', v_placeholders,
    'conversations_created', v_conversations_created,
    'conversations_updated', v_conversations_updated,
    'messages_copied', v_copied,
    'messages_copied_inbound', v_copied_in,
    'messages_copied_outbound', v_copied_out,
    'messages_copied_unread', v_copied_unread,
    'messages_copied_to_placeholder', v_copied_placeholder,
    'already_copied', v_already_copied,
    'skipped', jsonb_build_object(
      'unparseable_title', v_unparseable,
      -- parseable but no conversation could be resolved (e.g. a concurrent
      -- writer's conversation not yet visible); a re-run picks them up
      'no_conversation', v_parseable_pending - v_copied
    )
  );

  RAISE NOTICE 'messaging_backfill_instagram_history: %', v_summary;
  RETURN v_summary;
END;
$$;

COMMENT ON FUNCTION public.messaging_backfill_instagram_history() IS
  'Idempotent, additive copy of legacy INSTAGRAM_MESSAGE activities into channel_accounts/conversations/messages (S9). Run by an operator; see docs/messaging-pipeline-rollout.md.';

REVOKE EXECUTE ON FUNCTION public.messaging_backfill_instagram_history()
  FROM PUBLIC, anon, authenticated;

COMMIT;
