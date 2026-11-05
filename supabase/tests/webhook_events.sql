-- SQL behaviour test for messaging_start_attempt and messaging_claim_retry (S4).
-- Single-session semantics; the overlapping-sweep case runs in run.sh with two
-- parallel sessions.
--
-- LOCAL Supabase only (never a linked/remote project). Run through
-- `pnpm test:db` or `bash supabase/tests/run.sh`. Rolled back at the end; any
-- failed check raises and stops psql with a non-zero exit code. now() is fixed
-- for the whole transaction, so "time passing" is simulated by moving
-- last_attempt_at / received_at back.

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

-- Isolate from any other row in the local database (rolled back).
DELETE FROM public.webhook_events;

CREATE FUNCTION pg_temp.ev(p_id text, p_status text, p_attempts int, p_received interval,
                           p_last_attempt interval DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.webhook_events (event_id, provider, status, attempts, payload, received_at, last_attempt_at)
  VALUES (p_id, 'instagram', p_status, p_attempts, jsonb_build_object('id', p_id),
          now() - p_received, now() - p_last_attempt);
$$;

-- ---------------------------------------------------------------------------
-- 1. messaging_start_attempt: only while received; sets the lease
-- ---------------------------------------------------------------------------
SELECT pg_temp.ev('start.received', 'received', 0, interval '1 second');
SELECT pg_temp.ev('start.processed', 'processed', 1, interval '1 second');
SELECT pg_temp.ev('start.failed', 'failed', 3, interval '1 second');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.messaging_start_attempt('start.received');
  PERFORM pg_temp.check(r.attempts::text, '1', 'start_attempt: attempts incremented');
  PERFORM pg_temp.check(r.payload->>'id', 'start.received', 'start_attempt: returns the payload');
  PERFORM pg_temp.check((SELECT (last_attempt_at = now())::text FROM public.webhook_events
                         WHERE event_id = 'start.received'), 'true', 'start_attempt: lease set to now()');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messaging_start_attempt('start.processed'))::text, '0',
                        'start_attempt: processed event returns no row');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messaging_start_attempt('start.failed'))::text, '0',
                        'start_attempt: failed event returns no row');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messaging_start_attempt('start.missing'))::text, '0',
                        'start_attempt: missing event returns no row');
  PERFORM pg_temp.check((SELECT attempts || '|' || coalesce(last_attempt_at::text, '-')
                         FROM public.webhook_events WHERE event_id = 'start.processed'),
                        '1|-', 'start_attempt: processed event untouched');
  -- A fresh attempt also blocks the sweep for 2 minutes
  PERFORM pg_temp.check((SELECT count(*) FROM public.messaging_claim_retry(10)
                         WHERE event_id = 'start.received')::text, '0',
                        'start_attempt: lease keeps the sweep away');
END $$;
DELETE FROM public.webhook_events;

-- ---------------------------------------------------------------------------
-- 2. messaging_claim_retry: limit, oldest first, eligibility rules
-- ---------------------------------------------------------------------------
SELECT pg_temp.ev('e1', 'received', 0, interval '10 minutes');
SELECT pg_temp.ev('e2', 'received', 0, interval '9 minutes');
SELECT pg_temp.ev('e3', 'received', 2, interval '8 minutes');
SELECT pg_temp.ev('e4', 'received', 0, interval '7 minutes', interval '3 minutes'); -- lease expired
SELECT pg_temp.ev('e5', 'received', 0, interval '6 minutes');
SELECT pg_temp.ev('fresh', 'received', 0, interval '1 minute');                     -- too recent
SELECT pg_temp.ev('leased', 'received', 1, interval '20 minutes', interval '1 minute'); -- lease active
SELECT pg_temp.ev('exhausted', 'received', 3, interval '20 minutes');               -- attempts = 3
SELECT pg_temp.ev('done', 'processed', 1, interval '20 minutes');
SELECT pg_temp.ev('skipped', 'ignored', 1, interval '20 minutes');
SELECT pg_temp.ev('dead', 'failed', 3, interval '20 minutes');

DO $$
BEGIN
  PERFORM pg_temp.check((SELECT string_agg(event_id || ':' || attempts, ',' ORDER BY event_id)
                         FROM public.messaging_claim_retry(3)),
                        'e1:1,e2:1,e3:3', 'claim_retry: limit 3 takes the 3 oldest eligible');
  PERFORM pg_temp.check((SELECT count(*) FROM public.webhook_events
                         WHERE event_id IN ('e1', 'e2', 'e3') AND last_attempt_at = now())::text,
                        '3', 'claim_retry: claimed events get the lease');
  -- Second run in the same instant: the lease blocks the first three
  PERFORM pg_temp.check((SELECT string_agg(event_id, ',' ORDER BY event_id)
                         FROM public.messaging_claim_retry(10)),
                        'e4,e5', 'claim_retry: second run gets only unleased eligible events');
  PERFORM pg_temp.check((SELECT count(*) FROM public.messaging_claim_retry(10))::text, '0',
                        'claim_retry: nothing left while leases are active');
  PERFORM pg_temp.check((SELECT string_agg(event_id || ':' || status || ':' || attempts, ',' ORDER BY event_id)
                         FROM public.webhook_events
                         WHERE event_id IN ('fresh', 'leased', 'exhausted', 'done', 'skipped', 'dead')),
                        'dead:failed:3,done:processed:1,exhausted:received:3,fresh:received:0,leased:received:1,skipped:ignored:1',
                        'claim_retry: never touches ineligible or non-received events');
END $$;

-- ---------------------------------------------------------------------------
-- 3. Lease: reclaimable only after 2 minutes; attempts < 3 caps retries
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- 1 min 59 s later: still leased
  UPDATE public.webhook_events SET last_attempt_at = now() - interval '119 seconds' WHERE event_id = 'e1';
  PERFORM pg_temp.check((SELECT count(*) FROM public.messaging_claim_retry(10))::text, '0',
                        'claim_retry: lease still blocks before 2 minutes');
  -- 2 min 1 s later: reclaimable
  UPDATE public.webhook_events SET last_attempt_at = now() - interval '121 seconds' WHERE event_id IN ('e1', 'e3');
  PERFORM pg_temp.check((SELECT string_agg(event_id || ':' || attempts, ',' ORDER BY event_id)
                         FROM public.messaging_claim_retry(10)),
                        'e1:2', 'claim_retry: reclaims after the lease; e3 reached 3 attempts');
END $$;

\echo 'webhook_events: ALL CHECKS PASSED'

ROLLBACK;
