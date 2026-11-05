-- SQL behaviour test for public.messaging_backfill_instagram_history() (S9).
--
-- LOCAL Supabase only (never a linked/remote project):
--   supabase start && supabase db reset
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -f supabase/tests/backfill_instagram_history.sql
--
-- Seeds realistic legacy data, runs the backfill, checks rows and counters,
-- re-runs it (must be a no-op), simulates live traffic (new-code ingest + an
-- old-code activity), runs the catch-up, and re-runs once more. Everything
-- happens inside one transaction that is ROLLED BACK, so the script can be
-- re-run against the same database. Any failed check raises and stops psql
-- with a non-zero exit code.

\set ON_ERROR_STOP on
\set QUIET on
\pset pager off

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

-- Conversation lookup by (user, IGSID)
CREATE FUNCTION pg_temp.conv(p_user uuid, p_igsid text)
RETURNS public.conversations LANGUAGE sql AS $$
  SELECT * FROM public.conversations WHERE user_id = p_user AND external_id = p_igsid;
$$;

-- Fingerprints of legacy tables (must never change through the backfill)
CREATE FUNCTION pg_temp.fp(p_table text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE format('SELECT md5(coalesce(string_agg(t::text, %L ORDER BY t::text), %L)) FROM public.%I t',
                 '|', '', p_table) INTO v;
  RETURN v;
END;
$$;

-- Conversation counters snapshot
CREATE FUNCTION pg_temp.conv_fp() RETURNS text LANGUAGE sql AS $$
  SELECT md5(coalesce(string_agg(
    concat_ws(',', id, account_id, lead_id, unread_count, last_inbound_at, last_message_at,
              last_message_preview), '|' ORDER BY id), ''))
  FROM public.conversations;
$$;

-- ---------------------------------------------------------------------------
-- Seed
--   U1 credentials, leads with/without instagram_scoped_id, in/out, read/unread,
--      orphan activities (no lead), unparseable titles, a non-DM activity
--   U2 user_secrets row without ig id + activities  -> placeholder account
--   U3 no user_secrets row at all + activities      -> placeholder account
--   U4 credentials, no activities                   -> account seeded only
--   U5 reconnected (channel_accounts already present) + one message already
--      ingested by new code (legacy_activity_id) + one older old-code activity
--   U6 credentials whose ig id belongs to U5        -> conflicting, not seeded
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('11111111-0000-0000-0000-000000000001', 'u1@test.local'),
  ('11111111-0000-0000-0000-000000000002', 'u2@test.local'),
  ('11111111-0000-0000-0000-000000000003', 'u3@test.local'),
  ('11111111-0000-0000-0000-000000000004', 'u4@test.local'),
  ('11111111-0000-0000-0000-000000000005', 'u5@test.local'),
  ('11111111-0000-0000-0000-000000000006', 'u6@test.local');

INSERT INTO public.user_secrets (user_id, instagram_token, instagram_ig_id, instagram_page_id) VALUES
  ('11111111-0000-0000-0000-000000000001', 'tok1', '17841400000000001', '100000000000001'),
  ('11111111-0000-0000-0000-000000000002', NULL, NULL, NULL),
  ('11111111-0000-0000-0000-000000000004', 'tok4', '17841400000000004', NULL),
  ('11111111-0000-0000-0000-000000000005', 'tok5', '17841400000000005', '100000000000005'),
  ('11111111-0000-0000-0000-000000000006', 'tok6', '17841400000000005', NULL);

INSERT INTO public.channel_accounts (id, user_id, channel, external_account_id, page_id, status) VALUES
  ('55555555-0000-0000-0000-0000000000a5', '11111111-0000-0000-0000-000000000005',
   'instagram', '17841400000000005', '100000000000005', 'connected');

INSERT INTO public.leads (id, user_id, name, company, email, instagram_scoped_id) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Lead 1001', 'Co', 'l1@test.local', '1001'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Lead no igsid', 'Co', 'l2@test.local', NULL),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'Lead U2', 'Co', 'l3@test.local', NULL),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Lead 1003', 'Co', 'l4@test.local', '1003');

INSERT INTO public.activities (id, user_id, lead_id, type, title, description, created_at, read_at) VALUES
  -- U1 / 1001: 1 unread in, 1 read orphan in, 1 out
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   'INSTAGRAM_MESSAGE', 'Instagram DM from 1001', 'hola 1', '2026-10-01 10:00+00', NULL),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM from 1001', 'hola 2', '2026-10-02 10:00+00', '2026-10-02 11:00+00'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   'INSTAGRAM_MESSAGE', 'Instagram DM to 1001', 'respuesta 1001', '2026-10-03 10:00+00', NULL),
  -- U1 / 1002: 2 unread in (one orphan), 1 read in, newest is out
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002',
   'INSTAGRAM_MESSAGE', 'Instagram DM from 1002', 'a', '2026-10-04 10:00+00', NULL),
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM from 1002', 'b', '2026-10-05 10:00+00', NULL),
  ('33333333-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM from 1002', 'c', '2026-10-06 10:00+00', '2026-10-06 12:00+00'),
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM to 1002', 'ultima 1002', '2026-10-07 10:00+00', NULL),
  -- U1 / unparseable titles and a non-DM activity with a DM-like title
  ('33333333-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM', 'sin id', '2026-10-08 10:00+00', NULL),
  ('33333333-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM to @someone', 'handle', '2026-10-08 11:00+00', NULL),
  ('33333333-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000001', NULL,
   'NOTE', 'Instagram DM from 1004', 'nota', '2026-10-08 12:00+00', NULL),
  -- U1 / 1003: orphan activity, lead found through instagram_scoped_id
  ('33333333-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000001', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM from 1003', 'hola 1003', '2026-10-09 10:00+00', NULL),
  -- U2 (no ig id) / 2001
  ('33333333-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003',
   'INSTAGRAM_MESSAGE', 'Instagram DM from 2001', 'u2 in', '2026-10-10 10:00+00', NULL),
  ('33333333-0000-0000-0000-000000000021', '11111111-0000-0000-0000-000000000002', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM to 2001', 'u2 out', '2026-10-11 10:00+00', NULL),
  -- U3 (no user_secrets) / 3001
  ('33333333-0000-0000-0000-000000000030', '11111111-0000-0000-0000-000000000003', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM from 3001', 'u3 in', '2026-10-12 10:00+00', '2026-10-12 11:00+00'),
  -- U5: an old-code activity (older than the live message)
  ('33333333-0000-0000-0000-000000000051', '11111111-0000-0000-0000-000000000005', NULL,
   'INSTAGRAM_MESSAGE', 'Instagram DM from 5001', 'u5 old', '2026-10-13 10:00+00', NULL);

-- U5: one inbound message already ingested by new code (activity + link in one go)
INSERT INTO public.conversations (id, user_id, account_id, channel, external_id, unread_count)
VALUES ('44444444-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000005',
        '55555555-0000-0000-0000-0000000000a5', 'instagram', '5001', 0);
SELECT public.messaging_ingest_inbound(
  '44444444-0000-0000-0000-000000000005', 'mid.live.5001', 'text', 'u5 live',
  '{}'::jsonb, '2026-10-20 10:00+00', '{"title":"Instagram DM from 5001"}'::jsonb) \gset live_
\echo 'live ingest (U5):' :live_messaging_ingest_inbound

SELECT pg_temp.fp('activities') AS act_fp0, pg_temp.fp('leads') AS leads_fp0,
       pg_temp.fp('user_secrets') AS secrets_fp0 \gset

-- ---------------------------------------------------------------------------
-- Security settings
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(p.prosecdef::text, 'true', 'function is SECURITY DEFINER'),
       pg_temp.check(array_to_string(p.proconfig, ','), 'search_path=public', 'search_path = public'),
       pg_temp.check(has_function_privilege('anon', p.oid, 'EXECUTE')::text, 'false', 'anon cannot execute'),
       pg_temp.check(has_function_privilege('authenticated', p.oid, 'EXECUTE')::text, 'false', 'authenticated cannot execute')
FROM pg_proc p
WHERE p.oid = 'public.messaging_backfill_instagram_history()'::regprocedure \gset ignored_

-- ---------------------------------------------------------------------------
-- Run 1
-- ---------------------------------------------------------------------------
SELECT public.messaging_backfill_instagram_history() AS r1 \gset
\echo 'run 1:' :r1

SELECT pg_temp.check((:'r1'::jsonb)->>'accounts_seeded', '2', 'run1 accounts_seeded (U1, U4)'),
       pg_temp.check((:'r1'::jsonb)->>'accounts_conflicting', '1', 'run1 accounts_conflicting (U6)'),
       pg_temp.check((:'r1'::jsonb)->>'placeholder_accounts_created', '2', 'run1 placeholders (U2, U3)'),
       pg_temp.check((:'r1'::jsonb)->>'conversations_created', '5', 'run1 conversations_created'),
       pg_temp.check((:'r1'::jsonb)->>'conversations_updated', '6', 'run1 conversations_updated'),
       pg_temp.check((:'r1'::jsonb)->>'messages_copied', '12', 'run1 messages_copied'),
       pg_temp.check((:'r1'::jsonb)->>'messages_copied_inbound', '9', 'run1 inbound copied'),
       pg_temp.check((:'r1'::jsonb)->>'messages_copied_outbound', '3', 'run1 outbound copied'),
       pg_temp.check((:'r1'::jsonb)->>'messages_copied_unread', '6', 'run1 unread copied'),
       pg_temp.check((:'r1'::jsonb)->>'messages_copied_to_placeholder', '3', 'run1 copied to placeholders'),
       pg_temp.check((:'r1'::jsonb)->>'already_copied', '1', 'run1 already_copied (new-code row)'),
       pg_temp.check((:'r1'::jsonb)->'skipped'->>'unparseable_title', '2', 'run1 unparseable titles'),
       pg_temp.check((:'r1'::jsonb)->'skipped'->>'no_conversation', '0', 'run1 no_conversation') \gset ignored_

-- Accounts
SELECT pg_temp.check(count(*)::text, '1', 'U1 connected account seeded from user_secrets')
FROM public.channel_accounts
WHERE user_id = '11111111-0000-0000-0000-000000000001' AND channel = 'instagram'
  AND external_account_id = '17841400000000001' AND page_id = '100000000000001'
  AND status = 'connected' \gset ignored_
SELECT pg_temp.check(count(*)::text, '1', 'U4 account seeded without page id')
FROM public.channel_accounts
WHERE user_id = '11111111-0000-0000-0000-000000000004' AND page_id IS NULL AND status = 'connected' \gset ignored_
SELECT pg_temp.check(string_agg(external_account_id || ':' || status, ','), 'legacy:11111111-0000-0000-0000-000000000002:disconnected', 'U2 placeholder account')
FROM public.channel_accounts WHERE user_id = '11111111-0000-0000-0000-000000000002' \gset ignored_
SELECT pg_temp.check(string_agg(external_account_id || ':' || status, ','), 'legacy:11111111-0000-0000-0000-000000000003:disconnected', 'U3 placeholder account')
FROM public.channel_accounts WHERE user_id = '11111111-0000-0000-0000-000000000003' \gset ignored_
SELECT pg_temp.check(count(*)::text, '1', 'U5 keeps its single account')
FROM public.channel_accounts WHERE user_id = '11111111-0000-0000-0000-000000000005' \gset ignored_
SELECT pg_temp.check(count(*)::text, '0', 'U6 (conflicting ig id) gets no account')
FROM public.channel_accounts WHERE user_id = '11111111-0000-0000-0000-000000000006' \gset ignored_

-- Counts preserved: one message per parseable activity, linked to its IGSID conversation
SELECT pg_temp.check(count(*)::text, '0', 'every parseable activity has exactly one message in its IGSID conversation')
FROM public.activities a
WHERE a.type = 'INSTAGRAM_MESSAGE'
  AND a.title ~ '^Instagram DM (from|to) \d+$'
  AND (SELECT count(*) FROM public.messages m
       JOIN public.conversations c ON c.id = m.conversation_id
       WHERE m.legacy_activity_id = a.id
         AND c.user_id = a.user_id
         AND c.external_id = substring(a.title FROM '(\d+)$')) <> 1 \gset ignored_
SELECT pg_temp.check(count(*)::text, '0', 'unparseable and non-DM activities not copied')
FROM public.messages m
WHERE m.legacy_activity_id IN ('33333333-0000-0000-0000-000000000008',
                               '33333333-0000-0000-0000-000000000009',
                               '33333333-0000-0000-0000-000000000010') \gset ignored_
SELECT pg_temp.check(count(*)::text, '1', 'new-code activity not copied again')
FROM public.messages WHERE legacy_activity_id IN (
  SELECT id FROM public.activities WHERE title = 'Instagram DM from 5001' AND description = 'u5 live') \gset ignored_
SELECT pg_temp.check(count(*)::text, '13', 'total messages (12 copied + 1 live)')
FROM public.messages \gset ignored_

-- Copied message shape
SELECT pg_temp.check(concat_ws(',', direction, status, coalesce(external_id, 'null'), body, created_at = '2026-10-03 10:00+00', user_id),
                     'out,sent,null,respuesta 1001,t,11111111-0000-0000-0000-000000000001', 'outbound copy shape')
FROM public.messages WHERE legacy_activity_id = '33333333-0000-0000-0000-000000000003' \gset ignored_
SELECT pg_temp.check(concat_ws(',', direction, status, coalesce(external_id, 'null'), body, created_at = '2026-10-02 10:00+00', read_at IS NOT NULL),
                     'in,received,null,hola 2,t,t', 'inbound read copy shape')
FROM public.messages WHERE legacy_activity_id = '33333333-0000-0000-0000-000000000002' \gset ignored_

-- Conversations and counters
SELECT pg_temp.check(concat_ws(',', c.unread_count, c.lead_id, c.last_inbound_at = '2026-10-02 10:00+00',
                               c.last_message_at = '2026-10-03 10:00+00', c.last_message_preview, ca.external_account_id),
                     '1,22222222-0000-0000-0000-000000000001,t,t,respuesta 1001,17841400000000001', 'U1/1001 counters + lead')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000001', '1001') c
JOIN public.channel_accounts ca ON ca.id = c.account_id \gset ignored_
SELECT pg_temp.check(concat_ws(',', c.unread_count, c.lead_id, c.last_inbound_at = '2026-10-06 10:00+00',
                               c.last_message_at = '2026-10-07 10:00+00', c.last_message_preview),
                     '2,22222222-0000-0000-0000-000000000002,t,t,ultima 1002', 'U1/1002 unread preserved (2 unread, 1 read)')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000001', '1002') c \gset ignored_
SELECT pg_temp.check(concat_ws(',', c.unread_count, c.lead_id),
                     '1,22222222-0000-0000-0000-000000000004', 'U1/1003 lead linked through instagram_scoped_id')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000001', '1003') c \gset ignored_
SELECT pg_temp.check(concat_ws(',', c.unread_count, c.lead_id, c.last_inbound_at = '2026-10-10 10:00+00',
                               c.last_message_preview, ca.status),
                     '1,22222222-0000-0000-0000-000000000003,t,u2 out,disconnected', 'U2/2001 under placeholder')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000002', '2001') c
JOIN public.channel_accounts ca ON ca.id = c.account_id \gset ignored_
SELECT pg_temp.check(concat_ws(',', c.unread_count, coalesce(c.lead_id::text, 'null'), c.last_message_preview),
                     '0,null,u3 in', 'U3/3001 read inbound -> unread 0')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000003', '3001') c \gset ignored_
SELECT pg_temp.check(concat_ws(',', c.id, c.unread_count, c.last_inbound_at = '2026-10-20 10:00+00',
                               c.last_message_at = '2026-10-20 10:00+00', c.last_message_preview),
                     '44444444-0000-0000-0000-000000000005,2,t,t,u5 live', 'U5/5001 live counters kept, old unread added')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000005', '5001') c \gset ignored_
SELECT pg_temp.check(count(*)::text, '6', 'one conversation per (user, IGSID)')
FROM public.conversations \gset ignored_

-- Legacy tables untouched
SELECT pg_temp.check(pg_temp.fp('activities'), :'act_fp0', 'activities unchanged by run 1'),
       pg_temp.check(pg_temp.fp('leads'), :'leads_fp0', 'leads unchanged by run 1'),
       pg_temp.check(pg_temp.fp('user_secrets'), :'secrets_fp0', 'user_secrets unchanged by run 1') \gset ignored_

-- ---------------------------------------------------------------------------
-- Run 2: no-op
-- ---------------------------------------------------------------------------
SELECT pg_temp.conv_fp() AS conv_fp1, (SELECT count(*) FROM public.messages) AS msgs1,
       (SELECT count(*) FROM public.channel_accounts) AS accts1 \gset
SELECT public.messaging_backfill_instagram_history() AS r2 \gset
\echo 'run 2:' :r2

SELECT pg_temp.check((:'r2'::jsonb)->>'accounts_seeded', '0', 'run2 accounts_seeded'),
       pg_temp.check((:'r2'::jsonb)->>'placeholder_accounts_created', '0', 'run2 placeholders'),
       pg_temp.check((:'r2'::jsonb)->>'conversations_created', '0', 'run2 conversations_created'),
       pg_temp.check((:'r2'::jsonb)->>'conversations_updated', '0', 'run2 conversations_updated'),
       pg_temp.check((:'r2'::jsonb)->>'messages_copied', '0', 'run2 messages_copied'),
       pg_temp.check((:'r2'::jsonb)->>'already_copied', '13', 'run2 already_copied'),
       pg_temp.check((:'r2'::jsonb)->'skipped'->>'unparseable_title', '2', 'run2 unparseable titles'),
       pg_temp.check(pg_temp.conv_fp(), :'conv_fp1', 'run2 conversations and counters unchanged'),
       pg_temp.check((SELECT count(*) FROM public.messages)::text, :'msgs1', 'run2 no new messages'),
       pg_temp.check((SELECT count(*) FROM public.channel_accounts)::text, :'accts1', 'run2 no new accounts'),
       pg_temp.check(pg_temp.fp('activities'), :'act_fp0', 'activities unchanged by run 2') \gset ignored_

-- ---------------------------------------------------------------------------
-- Live traffic after the first backfill, then the catch-up run
--   new code ingests a message for U1/1001 (unread + 1, linked activity)
--   old code (still deployed) writes an older, unread activity for 1001
-- ---------------------------------------------------------------------------
SELECT public.messaging_ingest_inbound(
  (pg_temp.conv('11111111-0000-0000-0000-000000000001', '1001')).id, 'mid.live.1001', 'text', 'live 1001',
  '{}'::jsonb, '2026-10-30 12:00+00', '{"title":"Instagram DM from 1001"}'::jsonb) \gset live_
INSERT INTO public.activities (id, user_id, lead_id, type, title, description, created_at)
VALUES ('33333333-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000001', NULL,
        'INSTAGRAM_MESSAGE', 'Instagram DM from 1001', 'old code late', '2026-10-30 11:00+00');

SELECT pg_temp.check(concat_ws(',', unread_count, last_message_preview), '2,live 1001', 'live ingest incremented 1001')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000001', '1001') \gset ignored_
SELECT pg_temp.fp('activities') AS act_fp2, pg_temp.fp('leads') AS leads_fp2 \gset

SELECT public.messaging_backfill_instagram_history() AS r3 \gset
\echo 'run 3 (catch-up):' :r3

SELECT pg_temp.check((:'r3'::jsonb)->>'messages_copied', '1', 'run3 copies only the old-code activity'),
       pg_temp.check((:'r3'::jsonb)->>'conversations_created', '0', 'run3 conversations_created'),
       pg_temp.check((:'r3'::jsonb)->>'conversations_updated', '1', 'run3 conversations_updated'),
       pg_temp.check((:'r3'::jsonb)->>'already_copied', '14', 'run3 already_copied (incl. new-code row)') \gset ignored_
SELECT pg_temp.check(concat_ws(',', unread_count, last_inbound_at = '2026-10-30 12:00+00',
                               last_message_at = '2026-10-30 12:00+00', last_message_preview),
                     '3,t,t,live 1001', 'run3 unread only grows by copied rows, live preview kept')
FROM pg_temp.conv('11111111-0000-0000-0000-000000000001', '1001') \gset ignored_
SELECT pg_temp.check(count(*)::text, '1', 'live 1001 message present exactly once')
FROM public.messages WHERE body = 'live 1001' \gset ignored_
SELECT pg_temp.check(pg_temp.fp('activities'), :'act_fp2', 'activities unchanged by run 3') \gset ignored_

-- ---------------------------------------------------------------------------
-- Run 4: no-op again
-- ---------------------------------------------------------------------------
SELECT pg_temp.conv_fp() AS conv_fp3, (SELECT count(*) FROM public.messages) AS msgs3 \gset
SELECT public.messaging_backfill_instagram_history() AS r4 \gset
\echo 'run 4:' :r4
SELECT pg_temp.check((:'r4'::jsonb)->>'messages_copied', '0', 'run4 messages_copied'),
       pg_temp.check((:'r4'::jsonb)->>'conversations_created', '0', 'run4 conversations_created'),
       pg_temp.check(pg_temp.conv_fp(), :'conv_fp3', 'run4 counters unchanged'),
       pg_temp.check((SELECT count(*) FROM public.messages)::text, :'msgs3', 'run4 no new messages'),
       pg_temp.check(pg_temp.fp('leads'), :'leads_fp2', 'leads unchanged by runs 3-4'),
       pg_temp.check(pg_temp.fp('user_secrets'), :'secrets_fp0', 'user_secrets unchanged at the end') \gset ignored_

\echo 'backfill_instagram_history: ALL CHECKS PASSED'

ROLLBACK;
