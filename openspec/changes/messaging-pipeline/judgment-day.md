# Judgment Day — messaging-pipeline design

- **Date**: 2026-11-03
- **Target** (sha1): design.md `1e187b19`, proposal.md `2b6f25f1`, specs/messaging-pipeline `95ec89f6`,
  specs/api-rest `12cf9dc2`, specs/activity-status `793509bf`
- **Round**: 1 · **Judges**: A, B (blind, parallel, read-only)
- **Skill resolution**: none — both judges reported they did not load the injected Supabase skill paths
  (orchestration gap; RLS/Postgres checks came from their own reading)
- **Verdict**: APPROVED — no CRITICAL/HIGH finding from either judge; no fix round run.

## Ledger

| ID | Finding | Judges | Severity | Status |
|----|---------|--------|----------|--------|
| JD-1 | Message insert and `messaging_touch_conversation` are not atomic; a crash between them leaves `unread_count`/`last_message_*` permanently stale because the retry dedups on `mid` and only repairs the legacy activity | A + B | WARNING | confirmed (info) |
| JD-2 | Migration B cannot be "re-run" through the migration runner (rollout step 4); a manual re-run would also recompute counters while the webhook increments them | B | WARNING | suspect |
| JD-3 | Conversation `findOrCreate` does not handle the `UNIQUE(account_id, external_id)` race (23505) | A | WARNING | suspect |
| JD-4 | ADR-4 always hashes the body, while the spec says "provider id when present"; diagram uses `eventId(rawBody)` vs port `eventId(payload, rawBody)` | A | WARNING | suspect |
| JD-5 | Sweep of 25 events × ~6–10 Supabase calls may exceed Workers subrequest/CPU limits; `attempts` update is read-modify-write | A | WARNING | suspect |
| JD-6 | Existing activity-level mark read/unread (`MarkActivityRead/Unread`, `/api/activities` unread filter) no longer affect the badge; read state can diverge | A | WARNING | suspect |
| JD-7 | Echo adopting a pending/failed row: no legacy activity written, stale `error_message`/`hint` kept after a timeout-then-delivered case | B | WARNING | suspect |
| JD-8 | Echo adoption window "2 min" has no reference time; a sweep retry (>2 min) would duplicate the outbound row — measure against the event timestamp | B | WARNING | suspect |
| JD-9 | `lead:<id>` key with several conversations: GET/read/DELETE/link semantics undefined; DELETE must collect legacy activity ids before the cascade | B | WARNING | suspect |
| JD-10 | RLS `user_id = auth.uid()` does not check ownership of referenced `conversation_id`/`account_id`/`lead_id` on insert | B | WARNING | suspect |
| JD-11 | Migration B skips activities of users without a `channel_accounts` row and does not report them | B | WARNING | suspect |
| JD-12 | Legacy-link crash window (activity written, link not set → duplicate on B re-run/repair); `webhook_events` payload retention; send without `channel_accounts` row | A | SUGGESTION | info |
| JD-13 | Sweep self-fetch base URL unspecified; `useUnreadCount` on UPDATE only requires conversations to be created with `unread_count=0` then touched | B | SUGGESTION | info |

Per the Judgment Day rules, WARNING/SUGGESTION rows are informational and were not auto-fixed.

## Author revision (2026-11-03, user-requested)

The user asked to incorporate all 13 rows into the design before tasks. Every row was addressed in
`design.md` (resolution table in §9) and the affected specs were aligned:
`specs/messaging-pipeline` (RLS ownership, retention, atomic ingest, concurrent create, echo window
and failed-row adoption, delivery vs echo, re-invokable additive backfill, placeholder accounts, sweep
batch and atomic claim), `specs/activity-status` (activity read/unread sync), `specs/api-rest`
(key → set of conversations). This revision was not re-judged.
