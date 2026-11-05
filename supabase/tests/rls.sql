-- RLS test for the messaging tables (S1): as `authenticated` with another
-- user's auth.uid(), a tenant cannot read or write someone else's
-- channel_accounts, conversations or messages, and nobody but the service role
-- can read or write webhook_events.
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

-- Runs p_sql and returns 'ok' or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

-- Runs p_sql and returns the number of rows it affected ('error:<state>' on error).
CREATE FUNCTION pg_temp.rows(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'error:' || SQLSTATE;
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.check(text, text, text), pg_temp.try(text), pg_temp.rows(text)
  TO authenticated, anon;

-- Seed as the owner: owner O (the victim) and tenant T (the reader)
INSERT INTO auth.users (id, email) VALUES
  ('e1000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('e1000000-0000-0000-0000-00000000000b', 'tenant@test.local');
INSERT INTO public.leads (id, user_id, name, company, email) VALUES
  ('e2000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000a', 'O lead', 'Co', 'ol@test.local'),
  ('e2000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000b', 'T lead', 'Co', 'tl@test.local');
INSERT INTO public.channel_accounts (id, user_id, channel, external_account_id) VALUES
  ('e3000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000a', 'instagram', '17841400000009a'),
  ('e3000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000b', 'instagram', '17841400000009b');
INSERT INTO public.conversations (id, user_id, lead_id, account_id, channel, external_id, unread_count) VALUES
  ('e4000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000a',
   'e2000000-0000-0000-0000-00000000000a', 'e3000000-0000-0000-0000-00000000000a', 'instagram', '95a', 3),
  ('e4000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000b',
   'e2000000-0000-0000-0000-00000000000b', 'e3000000-0000-0000-0000-00000000000b', 'instagram', '95b', 1);
INSERT INTO public.messages (id, user_id, conversation_id, direction, body, external_id) VALUES
  ('e5000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000a',
   'e4000000-0000-0000-0000-00000000000a', 'in', 'secret of O', 'mid.rls.a'),
  ('e5000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000b',
   'e4000000-0000-0000-0000-00000000000b', 'in', 'hello T', 'mid.rls.b');
INSERT INTO public.webhook_events (event_id, provider, payload) VALUES
  ('rls.event', 'instagram', '{"secret":true}');

-- ---------------------------------------------------------------------------
-- Act as tenant T
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
\o /dev/null
SELECT set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
\o

DO $$
BEGIN
  PERFORM pg_temp.check(auth.uid()::text, 'e1000000-0000-0000-0000-00000000000b', 'rls: acting as tenant T');

  -- Reads
  PERFORM pg_temp.check((SELECT string_agg(external_id, ',') FROM public.conversations), '95b',
                        'rls: T sees only its own conversations');
  PERFORM pg_temp.check((SELECT string_agg(body, ',') FROM public.messages), 'hello T',
                        'rls: T sees only its own messages');
  PERFORM pg_temp.check((SELECT string_agg(external_account_id, ',') FROM public.channel_accounts), '17841400000009b',
                        'rls: T sees only its own channel accounts');

  -- Writes on O's rows affect nothing
  PERFORM pg_temp.check(pg_temp.rows($q$UPDATE public.conversations SET unread_count = 0
                                       WHERE id = 'e4000000-0000-0000-0000-00000000000a'$q$), '0',
                        'rls: T cannot update O''s conversation');
  PERFORM pg_temp.check(pg_temp.rows($q$UPDATE public.messages SET body = 'x'
                                       WHERE id = 'e5000000-0000-0000-0000-00000000000a'$q$), '0',
                        'rls: T cannot update O''s message');
  PERFORM pg_temp.check(pg_temp.rows($q$DELETE FROM public.messages
                                       WHERE id = 'e5000000-0000-0000-0000-00000000000a'$q$), '0',
                        'rls: T cannot delete O''s message');
  PERFORM pg_temp.check(pg_temp.rows($q$DELETE FROM public.conversations
                                       WHERE id = 'e4000000-0000-0000-0000-00000000000a'$q$), '0',
                        'rls: T cannot delete O''s conversation');

  -- Inserts referencing O's rows are rejected
  PERFORM pg_temp.check(pg_temp.try($q$INSERT INTO public.messages (user_id, conversation_id, direction, body)
                                      VALUES ('e1000000-0000-0000-0000-00000000000b',
                                              'e4000000-0000-0000-0000-00000000000a', 'out', 'inject')$q$),
                        '42501', 'rls: T cannot insert a message into O''s conversation');
  PERFORM pg_temp.check(pg_temp.try($q$INSERT INTO public.messages (user_id, conversation_id, direction, body)
                                      VALUES ('e1000000-0000-0000-0000-00000000000a',
                                              'e4000000-0000-0000-0000-00000000000a', 'out', 'inject')$q$),
                        '42501', 'rls: T cannot insert a message as O');
  PERFORM pg_temp.check(pg_temp.try($q$INSERT INTO public.conversations (user_id, account_id, external_id)
                                      VALUES ('e1000000-0000-0000-0000-00000000000b',
                                              'e3000000-0000-0000-0000-00000000000a', 'evil')$q$),
                        '42501', 'rls: T cannot create a conversation on O''s account');
  PERFORM pg_temp.check(pg_temp.try($q$INSERT INTO public.conversations (user_id, account_id, lead_id, external_id)
                                      VALUES ('e1000000-0000-0000-0000-00000000000b',
                                              'e3000000-0000-0000-0000-00000000000b',
                                              'e2000000-0000-0000-0000-00000000000a', 'evil')$q$),
                        '42501', 'rls: T cannot link a conversation to O''s lead');
  PERFORM pg_temp.check(pg_temp.try($q$UPDATE public.conversations SET lead_id = 'e2000000-0000-0000-0000-00000000000a'
                                      WHERE id = 'e4000000-0000-0000-0000-00000000000b'$q$),
                        '42501', 'rls: T cannot re-link its conversation to O''s lead');

  -- SECURITY INVOKER functions cannot reach O's rows either
  PERFORM public.messaging_set_conversations_read(ARRAY['e4000000-0000-0000-0000-00000000000a'::uuid]);
  PERFORM pg_temp.check(pg_temp.try($q$SELECT public.messaging_ingest_inbound(
                                        'e4000000-0000-0000-0000-00000000000a', 'mid.rls.inject', 'text', 'x',
                                        '{}'::jsonb, now(), '{}'::jsonb)$q$),
                        '42501', 'rls: ingest into O''s conversation is rejected by RLS');

  -- webhook_events: no policy -> nothing readable or writable
  PERFORM pg_temp.check(coalesce((SELECT count(*) FROM public.webhook_events)::text, 'error'), '0',
                        'rls: T reads no webhook_events');
  PERFORM pg_temp.check(pg_temp.try($q$INSERT INTO public.webhook_events (event_id, provider, payload)
                                      VALUES ('evil', 'instagram', '{}')$q$),
                        '42501', 'rls: T cannot insert webhook_events');
  PERFORM pg_temp.check(pg_temp.rows($q$UPDATE public.webhook_events SET status = 'processed'$q$), '0',
                        'rls: T cannot update webhook_events');
END $$;

-- anon sees nothing at all
SET LOCAL ROLE anon;
\o /dev/null
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
\o
DO $$
BEGIN
  PERFORM pg_temp.check(pg_temp.try('SELECT 1 FROM public.webhook_events LIMIT 1')
                        || '/' || coalesce((SELECT count(*) FROM public.conversations)::text, '-')
                        || '/' || coalesce((SELECT count(*) FROM public.messages)::text, '-'),
                        'ok/0/0', 'rls: anon sees no conversations, messages or webhook_events rows');
  PERFORM pg_temp.check(coalesce((SELECT count(*) FROM public.webhook_events)::text, 'error'), '0',
                        'rls: anon reads no webhook_events');
END $$;

-- ---------------------------------------------------------------------------
-- Back to the owner: O's rows are intact
-- ---------------------------------------------------------------------------
RESET ROLE;
DO $$
BEGIN
  PERFORM pg_temp.check((SELECT unread_count || '|' || coalesce(lead_id::text, '-') FROM public.conversations
                         WHERE id = 'e4000000-0000-0000-0000-00000000000a'),
                        '3|e2000000-0000-0000-0000-00000000000a', 'rls: O''s conversation unchanged');
  PERFORM pg_temp.check((SELECT body FROM public.messages WHERE id = 'e5000000-0000-0000-0000-00000000000a'),
                        'secret of O', 'rls: O''s message unchanged');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messages WHERE body = 'inject' OR external_id = 'mid.rls.inject')::text,
                        '0', 'rls: no injected message');
  PERFORM pg_temp.check((SELECT string_agg(event_id || ':' || status, ',') FROM public.webhook_events
                         WHERE event_id IN ('rls.event', 'evil')),
                        'rls.event:received', 'rls: webhook_events unchanged');
  PERFORM pg_temp.check((SELECT lead_id::text FROM public.conversations WHERE id = 'e4000000-0000-0000-0000-00000000000b'),
                        'e2000000-0000-0000-0000-00000000000b', 'rls: T''s conversation still linked to its own lead');
END $$;

\echo 'rls: ALL CHECKS PASSED'

ROLLBACK;
