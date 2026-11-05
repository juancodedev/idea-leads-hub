-- SQL behaviour test for messaging_mark_sent (S7, S8), alone and after an echo
-- adopted the row.
--
-- LOCAL Supabase only (never a linked/remote project). Run through
-- `pnpm test:db` or `bash supabase/tests/run.sh`. Rolled back at the end; any
-- failed check raises and stops psql with a non-zero exit code.

\set ON_ERROR_STOP on
\set QUIET on
\pset pager off
\pset tuples_only on

BEGIN;

CREATE FUNCTION pg_temp.check(p_actual text, p_expected text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  END IF;
  RAISE NOTICE 'ok   %', p_label;
END;
$$;

INSERT INTO auth.users (id, email) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'delivery@test.local');
INSERT INTO public.channel_accounts (id, user_id, channel, external_account_id) VALUES
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'instagram', '17841400000009002');
INSERT INTO public.conversations (id, user_id, account_id, channel, external_id) VALUES
  ('b4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'b3000000-0000-0000-0000-000000000001', 'instagram', '9002');

CREATE FUNCTION pg_temp.pending(p_id uuid, p_body text, p_at timestamptz) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.messages (id, user_id, conversation_id, direction, origin, body, status, created_at)
  VALUES (p_id, 'b1000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001',
          'out', 'human', p_body, 'pending', p_at);
$$;
CREATE FUNCTION pg_temp.acts(p_message uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.activities a
  WHERE a.user_id = 'b1000000-0000-0000-0000-000000000001'
    AND a.description = (SELECT body FROM public.messages WHERE id = p_message);
$$;
CREATE FUNCTION pg_temp.mark_sent(p_message uuid, p_mid text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.messaging_mark_sent(p_message, p_mid, '{"title":"Instagram DM to 9002"}'::jsonb);
$$;

-- ---------------------------------------------------------------------------
-- 1. Plain success: pending -> sent with the Graph mid, one legacy activity,
--    conversation preview updated; a second call writes nothing new.
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('b5000000-0000-0000-0000-000000000001', 'plain send', now() - interval '5 seconds');
DO $$
BEGIN
  PERFORM pg_temp.mark_sent('b5000000-0000-0000-0000-000000000001', 'mid.graph.1');
  PERFORM pg_temp.check((SELECT status || '|' || external_id FROM public.messages
                         WHERE id = 'b5000000-0000-0000-0000-000000000001'),
                        'sent|mid.graph.1', 'mark_sent: pending row becomes sent with the mid');
  PERFORM pg_temp.check(pg_temp.acts('b5000000-0000-0000-0000-000000000001')::text, '1',
                        'mark_sent: one legacy activity');
  PERFORM pg_temp.check((SELECT a.title FROM public.messages m JOIN public.activities a ON a.id = m.legacy_activity_id
                         WHERE m.id = 'b5000000-0000-0000-0000-000000000001'),
                        'Instagram DM to 9002', 'mark_sent: legacy activity linked with the title');
  PERFORM pg_temp.check((SELECT last_message_preview FROM public.conversations
                         WHERE id = 'b4000000-0000-0000-0000-000000000001'),
                        'plain send', 'mark_sent: conversation preview updated');
  PERFORM pg_temp.check((SELECT unread_count FROM public.conversations
                         WHERE id = 'b4000000-0000-0000-0000-000000000001')::text,
                        '0', 'mark_sent: unread_count untouched');

  PERFORM pg_temp.mark_sent('b5000000-0000-0000-0000-000000000001', 'mid.graph.1');
  PERFORM pg_temp.check(pg_temp.acts('b5000000-0000-0000-0000-000000000001')::text, '1',
                        'mark_sent: second call adds no activity');
END $$;

-- ---------------------------------------------------------------------------
-- 2. Echo adopted the row first, then the Graph success arrives:
--    the echo's external_id is kept and no second legacy activity is created.
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('b5000000-0000-0000-0000-000000000002', 'echo first', now() - interval '10 seconds');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.messaging_record_echo('b4000000-0000-0000-0000-000000000001', 'mid.echo.2', 'echo first',
         now(), '{}'::jsonb, '{"title":"Instagram DM to 9002"}'::jsonb);
  PERFORM pg_temp.check(r->>'outcome', 'adopted', 'mark_sent after echo: echo adopted the pending row');
  PERFORM pg_temp.check(pg_temp.acts('b5000000-0000-0000-0000-000000000002')::text, '1',
                        'mark_sent after echo: echo wrote one activity');

  r := pg_temp.mark_sent('b5000000-0000-0000-0000-000000000002', 'mid.graph.2');
  PERFORM pg_temp.check((SELECT status || '|' || external_id FROM public.messages
                         WHERE id = 'b5000000-0000-0000-0000-000000000002'),
                        'sent|mid.echo.2', 'mark_sent after echo: keeps the echo external_id');
  PERFORM pg_temp.check(pg_temp.acts('b5000000-0000-0000-0000-000000000002')::text, '1',
                        'mark_sent after echo: no second legacy activity');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messages
                         WHERE conversation_id = 'b4000000-0000-0000-0000-000000000001'
                           AND body = 'echo first')::text,
                        '1', 'mark_sent after echo: still one message row');
  PERFORM pg_temp.check(r->>'status', 'sent', 'mark_sent after echo: returns sent');
END $$;

-- ---------------------------------------------------------------------------
-- 3. A failed row is not flipped to sent by mark_sent (only pending -> sent)
-- ---------------------------------------------------------------------------
INSERT INTO public.messages (id, user_id, conversation_id, direction, origin, body, status, error_message)
VALUES ('b5000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001',
        'b4000000-0000-0000-0000-000000000001', 'out', 'human', 'already failed', 'failed', 'boom');
DO $$
BEGIN
  PERFORM pg_temp.mark_sent('b5000000-0000-0000-0000-000000000003', 'mid.graph.3');
  PERFORM pg_temp.check((SELECT status || '|' || coalesce(external_id, '-') FROM public.messages
                         WHERE id = 'b5000000-0000-0000-0000-000000000003'),
                        'failed|-', 'mark_sent: failed row is not flipped to sent');
END $$;

\echo 'delivery: ALL CHECKS PASSED'

ROLLBACK;
