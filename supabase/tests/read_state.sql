-- SQL behaviour test for messaging_set_conversations_read and
-- messaging_sync_legacy_read (S10, S12; sync direction filter from migration
-- 20261105000000).
--
-- LOCAL Supabase only (never a linked/remote project). Run through
-- `pnpm test:db` or `bash supabase/tests/run.sh`. Rolled back at the end; any
-- failed check raises and stops psql with a non-zero exit code.
--
-- messaging_sync_legacy_read runs BEFORE the caller writes activities.read_at
-- (SupabaseActivityRepository.markRead/markUnread), so the helper below does
-- the same: sync, then write read_at.

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
  ('d1000000-0000-0000-0000-000000000001', 'read@test.local');
INSERT INTO public.channel_accounts (id, user_id, channel, external_account_id) VALUES
  ('d3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   'instagram', '17841400000009004');
-- C1: read through the conversation; C2: activity-level sync; C3: untouched bystander
INSERT INTO public.conversations (id, user_id, account_id, channel, external_id, unread_count) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   'd3000000-0000-0000-0000-000000000001', 'instagram', '9401', 2),
  ('d4000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
   'd3000000-0000-0000-0000-000000000001', 'instagram', '9402', 2),
  ('d4000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001',
   'd3000000-0000-0000-0000-000000000001', 'instagram', '9403', 1);

-- Activity ids: d6..0X; message ids: d5..0X (same suffix)
CREATE FUNCTION pg_temp.msg(p_n int, p_conv int, p_direction text, p_read boolean, p_linked boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_act uuid := ('d6000000-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid;
  v_msg uuid := ('d5000000-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid;
  v_conv uuid := ('d4000000-0000-0000-0000-00000000000' || p_conv)::uuid;
BEGIN
  INSERT INTO public.activities (id, user_id, type, title, description, read_at)
  VALUES (v_act, 'd1000000-0000-0000-0000-000000000001', 'INSTAGRAM_MESSAGE',
          CASE p_direction WHEN 'in' THEN 'Instagram DM from x' ELSE 'Instagram DM to x' END,
          'm' || p_n, CASE WHEN p_read THEN now() - interval '1 day' END);
  INSERT INTO public.messages (id, user_id, conversation_id, direction, origin, body, status, legacy_activity_id)
  VALUES (v_msg, 'd1000000-0000-0000-0000-000000000001', v_conv, p_direction, 'human', 'm' || p_n,
          CASE p_direction WHEN 'in' THEN 'received' ELSE 'sent' END,
          CASE WHEN p_linked THEN v_act END);
END;
$$;
CREATE FUNCTION pg_temp.act(p_n int) RETURNS uuid LANGUAGE sql AS $$
  SELECT ('d6000000-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid;
$$;
CREATE FUNCTION pg_temp.unread(p_conv int) RETURNS text LANGUAGE sql AS $$
  SELECT unread_count::text FROM public.conversations
  WHERE id = ('d4000000-0000-0000-0000-00000000000' || p_conv)::uuid;
$$;
CREATE FUNCTION pg_temp.read_at(p_n int) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT read_at FROM public.activities WHERE id = pg_temp.act(p_n);
$$;
-- Repository order: sync the counter, then write read_at
CREATE FUNCTION pg_temp.mark(p_n int, p_read boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.messaging_sync_legacy_read(pg_temp.act(p_n), p_read);
  UPDATE public.activities SET read_at = CASE WHEN p_read THEN now() END WHERE id = pg_temp.act(p_n);
END;
$$;

-- C1: two unread inbound, one read inbound, one unread outbound
SELECT pg_temp.msg(1, 1, 'in', false);
SELECT pg_temp.msg(2, 1, 'in', false);
SELECT pg_temp.msg(3, 1, 'in', true);
SELECT pg_temp.msg(4, 1, 'out', false);
-- C2: two unread inbound, an outbound read, an outbound unread, an unlinked inbound
SELECT pg_temp.msg(11, 2, 'in', false);
SELECT pg_temp.msg(12, 2, 'in', false);
SELECT pg_temp.msg(13, 2, 'out', true);
SELECT pg_temp.msg(14, 2, 'out', false);
SELECT pg_temp.msg(15, 2, 'in', false, false);
-- C3: one unread inbound
SELECT pg_temp.msg(21, 3, 'in', false);

-- ---------------------------------------------------------------------------
-- 1. messaging_set_conversations_read: zero counters + read_at on linked
--    inbound legacy activities; other conversations untouched
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_old timestamptz := pg_temp.read_at(3);
BEGIN
  PERFORM public.messaging_set_conversations_read(ARRAY['d4000000-0000-0000-0000-000000000001'::uuid]);
  PERFORM pg_temp.check(pg_temp.unread(1), '0', 'set_read: unread_count = 0');
  PERFORM pg_temp.check((pg_temp.read_at(1) IS NOT NULL AND pg_temp.read_at(2) IS NOT NULL)::text, 'true',
                        'set_read: both unread inbound legacy activities get read_at');
  PERFORM pg_temp.check((pg_temp.read_at(3) = v_old)::text, 'true', 'set_read: already-read activity keeps its read_at');
  PERFORM pg_temp.check((pg_temp.read_at(4) IS NULL)::text, 'true', 'set_read: outbound legacy activity untouched');
  PERFORM pg_temp.check(pg_temp.unread(3), '1', 'set_read: other conversation untouched');
  PERFORM pg_temp.check((pg_temp.read_at(21) IS NULL)::text, 'true', 'set_read: other conversation activity untouched');
  -- Idempotent
  PERFORM public.messaging_set_conversations_read(ARRAY['d4000000-0000-0000-0000-000000000001'::uuid]);
  PERFORM pg_temp.check(pg_temp.unread(1), '0', 'set_read: second call keeps 0');
END $$;

-- ---------------------------------------------------------------------------
-- 2. messaging_sync_legacy_read: change once, floor at 0
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- the sync function itself never writes activities.read_at
  PERFORM public.messaging_sync_legacy_read(pg_temp.act(11), true);
  PERFORM pg_temp.check((pg_temp.read_at(11) IS NULL)::text, 'true', 'sync: does not write activities');
  UPDATE public.conversations SET unread_count = 2 WHERE id = 'd4000000-0000-0000-0000-000000000002';

  PERFORM pg_temp.mark(11, true);
  PERFORM pg_temp.check(pg_temp.unread(2), '1', 'sync: read decrements once');
  PERFORM pg_temp.mark(11, true);
  PERFORM pg_temp.check(pg_temp.unread(2), '1', 'sync: read again does not decrement');
  PERFORM pg_temp.mark(11, false);
  PERFORM pg_temp.check(pg_temp.unread(2), '2', 'sync: unread increments once');
  PERFORM pg_temp.mark(11, false);
  PERFORM pg_temp.check(pg_temp.unread(2), '2', 'sync: unread again does not increment');

  -- floor at 0
  UPDATE public.conversations SET unread_count = 0 WHERE id = 'd4000000-0000-0000-0000-000000000002';
  PERFORM pg_temp.mark(12, true);
  PERFORM pg_temp.check(pg_temp.unread(2), '0', 'sync: decrement floors at 0');
  UPDATE public.conversations SET unread_count = 2 WHERE id = 'd4000000-0000-0000-0000-000000000002';

  -- unlinked activity: no conversation changes anywhere
  PERFORM pg_temp.mark(15, true);
  PERFORM pg_temp.check(pg_temp.unread(2) || ',' || pg_temp.unread(1) || ',' || pg_temp.unread(3), '2,0,1',
                        'sync: unlinked activity changes no counter');

  -- outbound activities never move the inbound counter (migration 20261105000000)
  PERFORM pg_temp.mark(13, false);
  PERFORM pg_temp.check(pg_temp.unread(2), '2', 'sync: marking an outbound activity unread keeps the counter');
  PERFORM pg_temp.mark(14, true);
  PERFORM pg_temp.check(pg_temp.unread(2), '2', 'sync: marking an outbound activity read keeps the counter');

  -- unknown activity id: no error, nothing changes
  PERFORM public.messaging_sync_legacy_read('d6000000-0000-0000-0000-0000000000ff', true);
  PERFORM pg_temp.check(pg_temp.unread(2), '2', 'sync: unknown activity is a no-op');
END $$;

\echo 'read_state: ALL CHECKS PASSED'

ROLLBACK;
