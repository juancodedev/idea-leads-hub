-- SQL behaviour test for messaging_ingest_inbound and messaging_record_echo (S5, S6, S8).
--
-- LOCAL Supabase only (never a linked/remote project). Run through
-- `pnpm test:db` or `bash supabase/tests/run.sh`. Everything happens inside one
-- transaction that is ROLLED BACK; any failed check raises and stops psql with
-- a non-zero exit code.

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

-- Seed: one user, one account, one conversation linked to a lead.
INSERT INTO auth.users (id, email) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'ingest@test.local');
INSERT INTO public.leads (id, user_id, name, company, email, instagram_scoped_id) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'Lead', 'Co', 'lead@test.local', '9001');
INSERT INTO public.channel_accounts (id, user_id, channel, external_account_id) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'instagram', '17841400000009001');
INSERT INTO public.conversations (id, user_id, lead_id, account_id, channel, external_id) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
   'instagram', '9001');

-- Shorthands
CREATE FUNCTION pg_temp.c() RETURNS public.conversations LANGUAGE sql AS $$
  SELECT * FROM public.conversations WHERE id = 'a4000000-0000-0000-0000-000000000001';
$$;
CREATE FUNCTION pg_temp.activities() RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.activities WHERE user_id = 'a1000000-0000-0000-0000-000000000001';
$$;
CREATE FUNCTION pg_temp.echo(p_mid text, p_body text, p_at timestamptz) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.messaging_record_echo('a4000000-0000-0000-0000-000000000001', p_mid, p_body, p_at,
    '{}'::jsonb, '{"title":"Instagram DM to 9001"}'::jsonb);
$$;
CREATE FUNCTION pg_temp.pending(p_id uuid, p_body text, p_at timestamptz, p_status text DEFAULT 'pending')
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.messages (id, user_id, conversation_id, direction, origin, body, status,
                               error_message, hint, created_at)
  VALUES (p_id, 'a1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
          'out', 'human', p_body, p_status,
          CASE WHEN p_status = 'failed' THEN 'boom' END,
          CASE WHEN p_status = 'failed' THEN 'retry later' END, p_at);
$$;

-- ---------------------------------------------------------------------------
-- 1. Duplicate inbound mid: one message, counters once, one legacy activity
-- ---------------------------------------------------------------------------
DO $$
DECLARE r1 jsonb; r2 jsonb;
BEGIN
  r1 := public.messaging_ingest_inbound('a4000000-0000-0000-0000-000000000001', 'mid.in.1', 'text',
          'hola', '{}'::jsonb, '2026-11-01 09:00+00', '{"title":"Instagram DM from 9001"}'::jsonb);
  r2 := public.messaging_ingest_inbound('a4000000-0000-0000-0000-000000000001', 'mid.in.1', 'text',
          'hola', '{}'::jsonb, '2026-11-01 09:00+00', '{"title":"Instagram DM from 9001"}'::jsonb);
  PERFORM pg_temp.check(r1->>'inserted', 'true', 'ingest: first delivery inserted');
  PERFORM pg_temp.check(r2->>'inserted', 'false', 'ingest: same mid again is a no-op');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messages WHERE external_id = 'mid.in.1')::text,
                        '1', 'ingest: one message for the mid');
  PERFORM pg_temp.check((pg_temp.c()).unread_count::text, '1', 'ingest: unread_count +1 once');
  PERFORM pg_temp.check(pg_temp.activities()::text, '1', 'ingest: one legacy activity');
  PERFORM pg_temp.check((SELECT a.title || '|' || a.lead_id || '|' || a.type
                         FROM public.messages m JOIN public.activities a ON a.id = m.legacy_activity_id
                         WHERE m.external_id = 'mid.in.1'),
                        'Instagram DM from 9001|a2000000-0000-0000-0000-000000000001|INSTAGRAM_MESSAGE',
                        'ingest: legacy activity linked with title, lead and type');
  PERFORM pg_temp.check((pg_temp.c()).last_inbound_at::text,
                        ('2026-11-01 09:00+00'::timestamptz)::text, 'ingest: last_inbound_at');
  PERFORM pg_temp.check((SELECT direction || '|' || status FROM public.messages WHERE external_id = 'mid.in.1'),
                        'in|received', 'ingest: direction in, status received');
END $$;

-- ---------------------------------------------------------------------------
-- 2. Echo adopts a pending row within 2 minutes BEFORE the event timestamp.
--    The event is days in the past, so a window measured from processing time
--    (now()) would never adopt it.
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000001', 'adopt me', '2026-11-01 10:00+00');
DO $$
DECLARE r jsonb; v_before bigint := pg_temp.activities();
BEGIN
  r := pg_temp.echo('mid.echo.1', 'adopt me', '2026-11-01 10:01:30+00');
  PERFORM pg_temp.check(r->>'outcome', 'adopted', 'echo: adopted within the event window');
  PERFORM pg_temp.check(r->>'message_id', 'a5000000-0000-0000-0000-000000000001', 'echo: adopted the pending row');
  PERFORM pg_temp.check((SELECT status || '|' || external_id FROM public.messages
                         WHERE id = 'a5000000-0000-0000-0000-000000000001'),
                        'sent|mid.echo.1', 'echo: adopted row is sent with the echo mid');
  PERFORM pg_temp.check((pg_temp.activities() - v_before)::text, '1', 'echo: adoption writes one legacy activity');
  PERFORM pg_temp.check((pg_temp.c()).unread_count::text, '1', 'echo: unread_count unchanged');
  PERFORM pg_temp.check((pg_temp.c()).last_inbound_at::text,
                        ('2026-11-01 09:00+00'::timestamptz)::text, 'echo: last_inbound_at unchanged');
END $$;

-- ---------------------------------------------------------------------------
-- 3. Outside the window (3 minutes before the event) -> insert, row untouched
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000002', 'too old', '2026-11-01 11:00+00');
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.echo('mid.echo.2', 'too old', '2026-11-01 11:03+00');
  PERFORM pg_temp.check(r->>'outcome', 'inserted', 'echo: outside the window inserts');
  PERFORM pg_temp.check((SELECT status || '|' || coalesce(external_id, '-') FROM public.messages
                         WHERE id = 'a5000000-0000-0000-0000-000000000002'),
                        'pending|-', 'echo: out-of-window pending row untouched');
  PERFORM pg_temp.check((SELECT direction || '|' || origin || '|' || status || '|' || created_at::text
                         FROM public.messages WHERE external_id = 'mid.echo.2'),
                        'out|human|sent|' || ('2026-11-01 11:03+00'::timestamptz)::text,
                        'echo: inserted row is out/human/sent at the event time');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messages m JOIN public.activities a
                           ON a.id = m.legacy_activity_id WHERE m.external_id = 'mid.echo.2')::text,
                        '1', 'echo: inserted row has one legacy activity');
END $$;

-- ---------------------------------------------------------------------------
-- 4. Different body inside the window -> insert, pending row untouched
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000003', 'body A', '2026-11-01 12:00+00');
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.echo('mid.echo.3', 'body B', '2026-11-01 12:00:30+00');
  PERFORM pg_temp.check(r->>'outcome', 'inserted', 'echo: different body inserts');
  PERFORM pg_temp.check((SELECT status FROM public.messages WHERE id = 'a5000000-0000-0000-0000-000000000003'),
                        'pending', 'echo: different-body pending row untouched');
END $$;

-- ---------------------------------------------------------------------------
-- 5. Duplicate echo mid -> no-op (no new message, no new activity)
-- ---------------------------------------------------------------------------
DO $$
DECLARE r jsonb; v_msgs bigint; v_acts bigint := pg_temp.activities();
BEGIN
  SELECT count(*) INTO v_msgs FROM public.messages;
  r := pg_temp.echo('mid.echo.1', 'adopt me', '2026-11-01 10:01:30+00');
  PERFORM pg_temp.check(r->>'outcome', 'duplicate', 'echo: duplicate mid');
  PERFORM pg_temp.check(r->>'message_id', 'a5000000-0000-0000-0000-000000000001', 'echo: duplicate returns the existing id');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messages)::text, v_msgs::text, 'echo: duplicate adds no message');
  PERFORM pg_temp.check(pg_temp.activities()::text, v_acts::text, 'echo: duplicate adds no activity');
  -- An echo carrying an inbound mid is also a duplicate
  r := pg_temp.echo('mid.in.1', 'hola', '2026-11-01 09:00+00');
  PERFORM pg_temp.check(r->>'outcome', 'duplicate', 'echo: mid of an inbound message is a duplicate');
END $$;

-- ---------------------------------------------------------------------------
-- 6. Adoption of a failed row clears error_message and hint
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000004', 'failed one', '2026-11-01 13:00+00', 'failed');
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.echo('mid.echo.4', 'failed one', '2026-11-01 13:00:10+00');
  PERFORM pg_temp.check(r->>'outcome', 'adopted', 'echo: failed row adopted');
  PERFORM pg_temp.check((SELECT status || '|' || coalesce(error_message, '-') || '|' || coalesce(hint, '-')
                         FROM public.messages WHERE id = 'a5000000-0000-0000-0000-000000000004'),
                        'sent|-|-', 'echo: adopted failed row has error and hint cleared');
END $$;

-- ---------------------------------------------------------------------------
-- 7. Most recent candidate wins; a row created after the event is not adopted
-- ---------------------------------------------------------------------------
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000005', 'same', '2026-11-01 14:00:00+00');
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000006', 'same', '2026-11-01 14:00:40+00');
SELECT pg_temp.pending('a5000000-0000-0000-0000-000000000007', 'same', '2026-11-01 14:02:00+00');
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.echo('mid.echo.5', 'same', '2026-11-01 14:01:00+00');
  PERFORM pg_temp.check(r->>'message_id', 'a5000000-0000-0000-0000-000000000006',
                        'echo: adopts the most recent candidate before the event');
  PERFORM pg_temp.check((SELECT string_agg(status, ',' ORDER BY created_at) FROM public.messages
                         WHERE id IN ('a5000000-0000-0000-0000-000000000005',
                                      'a5000000-0000-0000-0000-000000000007')),
                        'pending,pending', 'echo: older and later rows stay pending');
END $$;

-- Every sent message has exactly one legacy activity; unread_count never moved
DO $$
BEGIN
  PERFORM pg_temp.check((SELECT count(*) FROM public.messages m
                         WHERE m.status = 'sent'
                           AND (SELECT count(*) FROM public.activities a WHERE a.id = m.legacy_activity_id) <> 1)::text,
                        '0', 'echo: every sent message has exactly one legacy activity');
  PERFORM pg_temp.check((pg_temp.c()).unread_count::text, '1', 'echo: unread_count still 1 after all echoes');
END $$;

\echo 'ingest_and_echo: ALL CHECKS PASSED'

ROLLBACK;
