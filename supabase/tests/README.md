# Messaging SQL tests (local only)

Real-database tests for the messaging pipeline SQL functions and RLS. They run
against the **local** Supabase stack in Docker, never a linked or remote
project. The Jest static specs in `supabase/migrations/__tests__` are not part
of this suite; they run with `pnpm test`.

## Prerequisites

- Docker running (the Supabase CLI starts the local stack in containers).
- Supabase CLI (`supabase --version`) and `psql` on the `PATH`.
- Node and pnpm, only to use the `pnpm test:db` shortcut.

## Run

```bash
pnpm test:db
```

This runs `supabase start`, `supabase db reset --local` (wipes the local
database and applies every migration) and `bash supabase/tests/run.sh`. It stops
at the first failure. Stop the stack afterwards with `supabase stop --no-backup`.

To rerun the tests without a reset (after a first reset):

```bash
bash supabase/tests/run.sh
```

`run.sh` only accepts a `DB_URL` on `127.0.0.1` or `localhost`
(default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).

## What runs

1. Every `*.sql` file in this folder, with psql. Each file runs in one
   transaction that it rolls back and prints `ALL CHECKS PASSED`; a failed
   check raises `FAIL <check>: expected ..., got ...`.

   | File | Covers |
   |------|--------|
   | `ingest_and_echo.sql` | duplicate inbound mid, echo adopt/insert/duplicate, 2-minute window from the event timestamp, failed-row adoption |
   | `delivery.sql` | `messaging_mark_sent`, alone and after an echo adopted the row |
   | `webhook_events.sql` | `messaging_start_attempt`, `messaging_claim_retry` limit, order, lease and attempts cap |
   | `read_state.sql` | `messaging_set_conversations_read`, `messaging_sync_legacy_read` (inbound only, once, floor at 0) |
   | `rls.sql` | tenant isolation on conversations/messages/channel_accounts; `webhook_events` closed to `authenticated` and `anon` |
   | `backfill_instagram_history.sql` | history backfill, re-run and catch-up |

2. Concurrency probes: two psql sessions in parallel on committed seed data,
   with `pg_sleep` to force the overlap (concurrent ingest of one mid, echo
   redelivery and two echoes vs one pending row, two overlapping sweeps,
   `messaging_mark_sent` vs echo in both orders). Seed rows use ids unique to the
   run and are deleted at the end, also on failure. The sweep probe needs a
   database with no other retryable `webhook_events`, so run it after a reset.
