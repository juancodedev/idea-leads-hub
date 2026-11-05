#!/usr/bin/env bash
# Real-database tests for the messaging pipeline SQL (T10). LOCAL ONLY.
#
#   1. Runs every supabase/tests/*.sql file with psql. Each file runs in one
#      transaction that it rolls back; the first failing file stops the run.
#   2. Runs concurrency probes: two psql sessions in parallel against COMMITTED
#      seed data (pg_sleep forces the overlap). In-transaction tests cannot
#      prove these. Seed rows use ids unique to this run and are deleted at the
#      end, also on failure.
#
# Usage: bash supabase/tests/run.sh   (expects `supabase start` + a fresh
# `supabase db reset --local`; see supabase/tests/README.md)

set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$DB_URL" in
  *@127.0.0.1:*|*@localhost:*) ;;
  *) echo "run.sh: refusing a non-local DB_URL ($DB_URL)" >&2; exit 2 ;;
esac

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/messaging-db-tests.XXXXXX")"

q() { psql "$DB_URL" -X -q -tA -v ON_ERROR_STOP=1 "$@"; }

fail() { echo "FAIL $*" >&2; exit 1; }
ok() { echo "ok   $*"; }
expect() { # expect <actual> <expected> <label>
  if [[ "$1" != "$2" ]]; then fail "$3: expected '$2', got '$1'"; fi
  ok "$3"
}

# ---------------------------------------------------------------------------
# 1. SQL files
# ---------------------------------------------------------------------------
for f in "$DIR"/*.sql; do
  name="$(basename "$f")"
  if ! out="$(psql "$DB_URL" -X -q -f "$f" 2>&1)"; then
    echo "$out" | grep -v 'NOTICE:  ok' | grep -v '^ *$' | tail -15 >&2
    fail "$name"
  fi
  checks="$(echo "$out" | grep -c 'NOTICE:  ok' || true)"
  echo "$out" | grep -q 'ALL CHECKS PASSED' || fail "$name: no ALL CHECKS PASSED line"
  echo "PASS $name ($checks checks)"
done

# ---------------------------------------------------------------------------
# 2. Concurrency probes (committed data, cleaned up on exit)
# ---------------------------------------------------------------------------
RUN="$(date +%s)$$"
USER_ID="$(q -c "select gen_random_uuid()")"
ACCOUNT_ID="$(q -c "select gen_random_uuid()")"
CONV_ID="$(q -c "select gen_random_uuid()")"
EV="t10.$RUN"

cleanup() {
  q <<SQL || echo "run.sh: cleanup failed, remove rows of user $USER_ID / events $EV.* by hand" >&2
DELETE FROM public.webhook_events WHERE event_id LIKE '$EV.%';
DELETE FROM public.messages WHERE user_id = '$USER_ID';
DELETE FROM public.conversations WHERE user_id = '$USER_ID';
DELETE FROM public.channel_accounts WHERE user_id = '$USER_ID';
DELETE FROM public.activities WHERE user_id = '$USER_ID';
DELETE FROM public.audit_logs WHERE user_id = '$USER_ID';
DELETE FROM auth.users WHERE id = '$USER_ID';
SQL
  left="$(q -c "select (select count(*) from public.messages where user_id = '$USER_ID')
                     + (select count(*) from public.activities where user_id = '$USER_ID')
                     + (select count(*) from public.webhook_events where event_id like '$EV.%')
                     + (select count(*) from auth.users where id = '$USER_ID')" 2>/dev/null || echo '?')"
  if [[ "$left" == "0" ]]; then echo "cleanup: probe seed rows removed"; rm -rf "$WORK"
  else echo "cleanup: $left probe rows left; session logs kept in $WORK" >&2; fi
}
trap cleanup EXIT

q <<SQL
INSERT INTO auth.users (id, email) VALUES ('$USER_ID', 'probe-$RUN@test.local');
INSERT INTO public.channel_accounts (id, user_id, channel, external_account_id)
  VALUES ('$ACCOUNT_ID', '$USER_ID', 'instagram', 'probe-$RUN');
INSERT INTO public.conversations (id, user_id, account_id, channel, external_id)
  VALUES ('$CONV_ID', '$USER_ID', '$ACCOUNT_ID', 'instagram', 'probe-$RUN');
SQL

# parallel <label>: runs $WORK/<label>.a.sql and, 0.3 s later, $WORK/<label>.b.sql
# in two sessions; outputs in .out/.err, exit codes in .rc
parallel() {
  local label="$1"
  ( rc=0; psql "$DB_URL" -X -q -tA -v ON_ERROR_STOP=1 -f "$WORK/$label.a.sql" \
      >"$WORK/$label.a.out" 2>"$WORK/$label.a.err" || rc=$?; echo "$rc" >"$WORK/$label.a.rc" ) &
  local pa=$!
  sleep 0.3
  ( rc=0; psql "$DB_URL" -X -q -tA -v ON_ERROR_STOP=1 -f "$WORK/$label.b.sql" \
      >"$WORK/$label.b.out" 2>"$WORK/$label.b.err" || rc=$?; echo "$rc" >"$WORK/$label.b.rc" ) &
  local pb=$!
  wait "$pa" "$pb" || true
}

# Holds a transaction open for 1.5 s after <statement>, so the other session
# overlaps it; prints the statement result and the ms the session waited.
held() { cat <<SQL
BEGIN;
$1;
SELECT 'waited_ms=' || (extract(epoch FROM clock_timestamp() - now()) * 1000)::int;
SELECT pg_sleep(1.5);
COMMIT;
SQL
}
ingest() { echo "SELECT public.messaging_ingest_inbound('$CONV_ID', '$1', 'text', '$2', '{}'::jsonb, now(), '{\"title\":\"Instagram DM from probe\"}'::jsonb)->>'inserted'"; }
echo_ev() { echo "SELECT public.messaging_record_echo('$CONV_ID', '$1', '$2', now(), '{}'::jsonb, '{\"title\":\"Instagram DM to probe\"}'::jsonb)->>'outcome'"; }
pending() { q -c "INSERT INTO public.messages (user_id, conversation_id, direction, origin, body, status, created_at)
                  VALUES ('$USER_ID', '$CONV_ID', 'out', 'human', '$1', 'pending', now() - interval '5 seconds')
                  RETURNING id"; }
acts() { q -c "select count(*) from public.activities where user_id = '$USER_ID' and description = '$1'"; }
outcome() { # first line of a session's output, or its SQLSTATE when it failed
  if [[ "$(cat "$WORK/$1.rc")" == "0" ]]; then head -1 "$WORK/$1.out"
  else grep -o 'duplicate key\|ERROR: .*' "$WORK/$1.err" | head -1; fi
}
waited() { grep -o 'waited_ms=[0-9]*' "$WORK/$1.out" | cut -d= -f2; }

echo "-- concurrency probes (run $RUN)"

# P1. Two concurrent inbound ingests of the same mid
held "$(ingest "$EV.mid.in" "probe inbound")" >"$WORK/p1.a.sql"
held "$(ingest "$EV.mid.in" "probe inbound")" >"$WORK/p1.b.sql"
parallel p1
expect "$(cat "$WORK/p1.a.rc")/$(cat "$WORK/p1.b.rc")" "0/0" "P1 ingest: both sessions succeed"
expect "$(outcome p1.a),$(outcome p1.b)" "true,false" "P1 ingest: exactly one session inserts"
[[ "$(waited p1.b)" -ge 500 ]] || fail "P1 ingest: second session did not overlap (waited $(waited p1.b) ms)"
ok "P1 ingest: second session blocked $(waited p1.b) ms on the first"
expect "$(q -c "select count(*) from public.messages where external_id = '$EV.mid.in'")" "1" "P1 ingest: one message"
expect "$(q -c "select unread_count from public.conversations where id = '$CONV_ID'")" "1" "P1 ingest: unread_count +1 once"
expect "$(acts "probe inbound")" "1" "P1 ingest: one legacy activity"

# P2a. Two concurrent deliveries of the same echo vs one pending row
P2A="$(pending "probe echo same mid")"
held "$(echo_ev "$EV.mid.echo.a" "probe echo same mid")" >"$WORK/p2a.a.sql"
held "$(echo_ev "$EV.mid.echo.a" "probe echo same mid")" >"$WORK/p2a.b.sql"
parallel p2a
expect "$(outcome p2a.a)" "adopted" "P2a echo redelivery: first session adopts the pending row"
echo "info P2a echo redelivery: second session -> $(outcome p2a.b) (rc $(cat "$WORK/p2a.b.rc"))"
expect "$(q -c "select count(*) from public.messages where external_id = '$EV.mid.echo.a'")" "1" "P2a echo redelivery: one message for the mid"
expect "$(q -c "select status || '|' || external_id from public.messages where id = '$P2A'")" "sent|$EV.mid.echo.a" "P2a echo redelivery: the pending row is the adopted one"
expect "$(acts "probe echo same mid")" "1" "P2a echo redelivery: one legacy activity"

# P2b. Two concurrent echoes with different mids, same body, vs one pending row
P2B="$(pending "probe echo two mids")"
held "$(echo_ev "$EV.mid.echo.b1" "probe echo two mids")" >"$WORK/p2b.a.sql"
held "$(echo_ev "$EV.mid.echo.b2" "probe echo two mids")" >"$WORK/p2b.b.sql"
parallel p2b
expect "$(cat "$WORK/p2b.a.rc")/$(cat "$WORK/p2b.b.rc")" "0/0" "P2b two echoes: both sessions succeed"
expect "$(outcome p2b.a),$(outcome p2b.b)" "adopted,inserted" "P2b two echoes: exactly one adoption"
expect "$(q -c "select count(*) from public.messages where body = 'probe echo two mids' and user_id = '$USER_ID'")" "2" "P2b two echoes: adopted row + one inserted row"
expect "$(q -c "select external_id from public.messages where id = '$P2B'")" "$EV.mid.echo.b1" "P2b two echoes: pending row adopted by the first echo"
expect "$(acts "probe echo two mids")" "2" "P2b two echoes: one legacy activity per sent message"

# P3. Two overlapping sweeps: messaging_claim_retry(5) x2 over 7 eligible events
foreign="$(q -c "select count(*) from public.webhook_events where status = 'received' and attempts < 3 and event_id not like '$EV.%'")"
[[ "$foreign" == "0" ]] || fail "P3 claim_retry: $foreign foreign received events in the database; reset it first (supabase db reset --local)"
q -c "INSERT INTO public.webhook_events (event_id, provider, payload, received_at)
      SELECT '$EV.ev.' || g, 'instagram', '{}'::jsonb, now() - interval '10 minutes' + g * interval '1 second'
      FROM generate_series(1, 7) g"
held "SELECT event_id FROM public.messaging_claim_retry(5)" >"$WORK/p3.a.sql"
held "SELECT event_id FROM public.messaging_claim_retry(5)" >"$WORK/p3.b.sql"
parallel p3
expect "$(cat "$WORK/p3.a.rc")/$(cat "$WORK/p3.b.rc")" "0/0" "P3 claim_retry: both sweeps succeed"
grep "^$EV.ev." "$WORK/p3.a.out" | sort >"$WORK/p3.a.ids"
grep "^$EV.ev." "$WORK/p3.b.out" | sort >"$WORK/p3.b.ids"
expect "$(wc -l <"$WORK/p3.a.ids" | tr -d ' ')+$(wc -l <"$WORK/p3.b.ids" | tr -d ' ')" "5+2" "P3 claim_retry: first sweep 5 (limit), second 2"
expect "$(comm -12 "$WORK/p3.a.ids" "$WORK/p3.b.ids" | wc -l | tr -d ' ')" "0" "P3 claim_retry: claimed sets are disjoint"
[[ "$(waited p3.b)" -lt 500 ]] || fail "P3 claim_retry: second sweep waited $(waited p3.b) ms instead of skipping locked rows"
ok "P3 claim_retry: second sweep skipped the locked rows without waiting ($(waited p3.b) ms)"
expect "$(q -c "select string_agg(distinct attempts::text, ',') || '/' || count(*) from public.webhook_events where event_id like '$EV.ev.%' and last_attempt_at is not null")" "1/7" "P3 claim_retry: each event claimed exactly once"
expect "$(q -c "select count(*) from public.messaging_claim_retry(5) where event_id like '$EV.%'")" "0" "P3 claim_retry: third sweep blocked by the lease"
expect "$(sort -u "$WORK/p3.a.ids" "$WORK/p3.b.ids" | wc -l | tr -d ' ')" "7" "P3 claim_retry: union of both sweeps is all 7 events"

# P4a. Graph success (mark_sent) holds the row, echo with the same mid arrives
P4A="$(pending "probe marksent first")"
held "SELECT public.messaging_mark_sent('$P4A', '$EV.mid.send.a', '{\"title\":\"Instagram DM to probe\"}'::jsonb)->>'status'" >"$WORK/p4a.a.sql"
held "$(echo_ev "$EV.mid.send.a" "probe marksent first")" >"$WORK/p4a.b.sql"
parallel p4a
expect "$(outcome p4a.a)" "sent" "P4a mark_sent then echo: mark_sent succeeds"
echo "info P4a mark_sent then echo: echo session -> $(outcome p4a.b) (rc $(cat "$WORK/p4a.b.rc"))"
expect "$(q -c "select count(*) from public.messages where external_id = '$EV.mid.send.a'")" "1" "P4a mark_sent then echo: one message"
expect "$(acts "probe marksent first")" "1" "P4a mark_sent then echo: one legacy activity"

# P4b. Echo adopts and holds the row, then the Graph success (mark_sent) arrives
P4B="$(pending "probe echo first")"
held "$(echo_ev "$EV.mid.send.b" "probe echo first")" >"$WORK/p4b.a.sql"
held "SELECT public.messaging_mark_sent('$P4B', '$EV.mid.send.b', '{\"title\":\"Instagram DM to probe\"}'::jsonb)->>'status'" >"$WORK/p4b.b.sql"
parallel p4b
expect "$(cat "$WORK/p4b.a.rc")/$(cat "$WORK/p4b.b.rc")" "0/0" "P4b echo then mark_sent: both sessions succeed"
expect "$(outcome p4b.a)" "adopted" "P4b echo then mark_sent: echo adopts"
expect "$(q -c "select status || '|' || external_id from public.messages where id = '$P4B'")" "sent|$EV.mid.send.b" "P4b echo then mark_sent: row sent with the echo mid"
expect "$(acts "probe echo first")" "1" "P4b echo then mark_sent: one legacy activity"

echo "PASS concurrency probes"
echo "ALL DB TESTS PASSED"
