# Messaging Pipeline Rollout

Runbook for rolling out the messaging pipeline (`channel_accounts`,
`conversations`, `messages`, `webhook_events`) and copying the Instagram DM
history from `public.activities` into it, while every stored or sent message
keeps writing its legacy `INSTAGRAM_MESSAGE` activity during the transition
(S8), so reverting the code loses no message.

Design: `openspec/changes/messaging-pipeline/design.md` (§4 data model, §5
rollout, ADR-7 channel accounts, ADR-9 `legacy_activity_id`).

## Summary

| Step | What | Status | Notes |
| --- | --- | --- | --- |
| 1 | Migration A `20261103000000_messaging_tables.sql` | **Applied in production on 2026-11-04** | Additive: four tables, RLS, ADR-10 functions, realtime publication. Migration history was repaired first (13 hand-applied versions marked `applied`). |
| 2 | Migration B `20261103000001_backfill_instagram_messages.sql` | Pending | Only **defines** `public.messaging_backfill_instagram_history()`; it copies nothing by itself. |
| 3 | Run the backfill (first run) | Pending | Seeds `channel_accounts` from `user_secrets` and copies the DM history. Record the summary. |
| 4 | Verify | Pending | Queries below; every user with Instagram credentials must have a `channel_accounts` row. |
| 5 | Deploy `feature/messaging-pipeline` | Pending, **gated on step 4** | Run the backfill + query 4.1 again right before the deploy. The new webhook resolves owners from `channel_accounts` only. |
| 6 | Run the backfill again (catch-up) | Pending | Copies activities the old code wrote between steps 3 and 5. Record the summary. |
| 7 | Meta `messages` webhook field (carries echoes), `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Done 2026-11-05 | See README. |
| 8 | Cron slice (retry sweep schedule) | In the branch (T9), separate commit | `worker.ts` entry + `[triggers] crons = ["*/5 * * * *"]`; needs `CRON_SECRET`. Reverts independently. |

## Why this order

The new webhook (`POST /api/webhook/instagram`) resolves the owner of an
inbound DM from `channel_accounts` (`external_account_id` or `page_id`), not
from `user_secrets`. In production `channel_accounts` only has rows for users
who reconnected Instagram after the `storeToken` sync shipped. Deploying the
code before the backfill seeds the other users would end their inbound DMs as
`ignored` (unknown account) in `webhook_events`. The legacy activity would not
be written either, so those messages would be missing from both models.

The backfill is a re-callable function rather than a one-shot migration
because a numbered migration runs only once, and the catch-up run after the
deploy (step 6) must copy what the old code wrote in the meantime.

## Step 2 — Apply migration B

Never run a linked command without checking what it will apply.

```bash
supabase migration list            # remote must show 20261103000000 applied
supabase db push --dry-run         # must list ONLY 20261103000001
supabase db push
```

Post-check (SQL editor):

```sql
-- Expected: one row, prosecdef = true, proconfig = {search_path=public}
SELECT p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.oid = 'public.messaging_backfill_instagram_history()'::regprocedure;
-- Expected: anon_can_execute = false, authenticated_can_execute = false
```

## Step 3 — Run the backfill

From the Supabase SQL editor (runs as `postgres`; `EXECUTE` is revoked from
`anon` and `authenticated`, so the API cannot call it):

```sql
SELECT public.messaging_backfill_instagram_history();
```

It runs in one transaction, takes a transaction advisory lock (two concurrent
runs never double count), and returns a jsonb summary. **Paste the summary
into the PR / release notes.**

| Field | Meaning |
| --- | --- |
| `accounts_seeded` | `channel_accounts` rows created from `user_secrets.instagram_ig_id` (`page_id` from `instagram_page_id`, `status = 'connected'`). Existing rows are never overwritten. |
| `accounts_conflicting` | `user_secrets` rows whose IG id already belongs to **another** user's account. Not seeded (the key is global). Must be reviewed by hand, see below. |
| `placeholder_accounts_created` | `disconnected` accounts `legacy:<user_id>` for users with parseable DMs but no Instagram account, so their history is still copied. |
| `conversations_created` | One per (user, IGSID parsed from the title). |
| `conversations_updated` | Conversations whose counters received rows in this run. |
| `messages_copied` (+ `_inbound`, `_outbound`, `_unread`, `_to_placeholder`) | Messages inserted in this run. `external_id = NULL`, `status` `received` (in) or `sent` (out), `created_at` preserved, `raw_payload = {"source":"legacy_backfill"}`. |
| `already_copied` | Parseable activities that already had a message (`messages.legacy_activity_id`): copied by an earlier run or written by the new code. Never copied again. |
| `skipped.unparseable_title` | `INSTAGRAM_MESSAGE` activities whose title is neither `Instagram DM from <digits>` nor `Instagram DM to <digits>`. Left uncopied and unchanged. |
| `skipped.no_conversation` | Parseable activities for which no conversation could be resolved in this run. Expected `0`; a re-run picks them up. |

Counters are updated **additively** for the rows copied in the run only:
`unread_count + (copied inbound with read_at IS NULL)`, `last_inbound_at` /
`last_message_at` = `GREATEST(current, copied max)`, preview from the newest
copied row only when it is not older than the current `last_message_at`.
Legacy tables (`activities`, `leads`, `user_secrets`) are only read.

Inspect conflicting credentials (`accounts_conflicting > 0`):

```sql
SELECT us.user_id AS credentials_user, ca.user_id AS account_owner,
       ca.external_account_id, ca.status
FROM public.user_secrets us
JOIN public.channel_accounts ca
  ON ca.channel = 'instagram' AND ca.external_account_id = btrim(us.instagram_ig_id)
WHERE ca.user_id <> us.user_id;
```

Inspect unparseable titles (`skipped.unparseable_title > 0`):

```sql
SELECT title, count(*)
FROM public.activities
WHERE type = 'INSTAGRAM_MESSAGE'
  AND substring(title FROM '^Instagram DM (?:from|to) (\d+)$') IS NULL
GROUP BY title
ORDER BY count(*) DESC;
```

Known shapes: `Instagram DM from <IGSID>` (old webhook and new ingest/echo),
`Instagram DM to <IGSID>` (send routes and new delivery). The very first lead
send route (2026-07-15) could title a send `Instagram DM to <instagram_handle>`
when the lead had no scoped id; such rows, if any, are counted here and stay
uncopied.

## Step 4 — Verify before deploying

All three queries must pass before step 5.

```sql
-- 4.1 Every user with Instagram credentials has an Instagram account row.
-- Expected: zero rows (or only the users listed by the conflicting query).
SELECT us.user_id, us.instagram_ig_id
FROM public.user_secrets us
WHERE NULLIF(btrim(us.instagram_ig_id), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.channel_accounts ca
    WHERE ca.user_id = us.user_id AND ca.channel = 'instagram' AND ca.status = 'connected'
  );

-- 4.2 Per user: parseable legacy activities vs messages linked to them.
-- Expected: parseable = linked for every user.
SELECT a.user_id,
       count(*)                                         AS parseable_activities,
       count(m.id)                                      AS linked_messages,
       count(*) FILTER (WHERE a.title LIKE 'Instagram DM from %') AS inbound,
       count(*) FILTER (WHERE a.title LIKE 'Instagram DM to %')   AS outbound
FROM public.activities a
LEFT JOIN public.messages m ON m.legacy_activity_id = a.id
WHERE a.type = 'INSTAGRAM_MESSAGE'
  AND substring(a.title FROM '^Instagram DM (?:from|to) (\d+)$') IS NOT NULL
GROUP BY a.user_id
ORDER BY a.user_id;

-- 4.3 Per user: unread badge parity (new sum vs legacy count).
-- Expected: equal right after the backfill, unless live traffic arrived
-- between the two reads.
SELECT u.user_id,
       (SELECT coalesce(sum(c.unread_count), 0) FROM public.conversations c
        WHERE c.user_id = u.user_id)                           AS unread_new,
       (SELECT count(*) FROM public.activities a
        WHERE a.user_id = u.user_id AND a.type = 'INSTAGRAM_MESSAGE'
          AND a.title LIKE 'Instagram DM from %' AND a.read_at IS NULL
          AND substring(a.title FROM '^Instagram DM (?:from|to) (\d+)$') IS NOT NULL) AS unread_legacy
FROM (SELECT DISTINCT user_id FROM public.activities WHERE type = 'INSTAGRAM_MESSAGE') u
ORDER BY u.user_id;
```

Accounts per user (for the record):

```sql
SELECT user_id, external_account_id, page_id, status, created_at
FROM public.channel_accounts
WHERE channel = 'instagram'
ORDER BY user_id, created_at;
```

## Step 5 — Deploy the branch

Only after step 4 passes. **Immediately before triggering the deploy**, run the
backfill once more and re-run query 4.1. A user who connects Instagram with the
old code after step 3 has a `user_secrets` row but no `channel_accounts` row
until this run; without it, their inbound DMs between the deploy and step 6
would end `ignored`, and ignored events are never retried. Keep the gap between
this run and the deploy as short as possible. Legacy activities keep being written for every
stored inbound message and every sent outbound message (same transaction as
the message, linked through `legacy_activity_id`).

## Step 6 — Catch-up run

Right after the deploy is live:

```sql
SELECT public.messaging_backfill_instagram_history();
```

Expected: `messages_copied` equals the DMs the old code stored between step 3
and the deploy; `accounts_seeded` / `conversations_created` usually `0`.
Activities written by the new code are counted in `already_copied`, never
copied twice. Counters only grow by what this run copies, so counts changed by
live traffic are kept. Record the summary and re-run the step 4 queries.

A further run at any time is a no-op (`messages_copied = 0`).

## Step 7 — Meta and secrets

- Keep the Meta app subscribed to the `messages` webhook field. With Instagram
  Login there is no separate `message_echoes` field: messages the account sends
  from the Instagram app arrive under `messages` with `is_echo: true`, which the
  channel parser turns into echo events (S6).
- Set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` as Worker secrets
  (`npx wrangler secret put ...`, see README).

## Monitoring

```sql
-- Status mix of the last 24 h
SELECT status, count(*), max(attempts) AS max_attempts
FROM public.webhook_events
WHERE received_at > now() - interval '24 hours'
GROUP BY status;

-- ignored rate (unknown account or nothing applicable)
SELECT round(100.0 * count(*) FILTER (WHERE status = 'ignored') / NULLIF(count(*), 0), 1)
         AS ignored_pct
FROM public.webhook_events
WHERE received_at > now() - interval '24 hours';

-- Stuck or failed events (expected: none older than a few minutes)
SELECT event_id, status, attempts, received_at, last_attempt_at
FROM public.webhook_events
WHERE status = 'failed'
   OR (status = 'received' AND received_at < now() - interval '10 minutes')
ORDER BY received_at DESC
LIMIT 50;
```

- A rising `ignored` rate right after the deploy usually means an account is
  missing from `channel_accounts`: re-run query 4.1, then inspect the
  recipient id in the ignored payloads
  (`payload->'entry'->0->'messaging'->0->'recipient'->>'id'`).
- `received` events older than 2 minutes with `attempts < 3` are retried by
  the sweep (`GET /api/webhook/instagram/sweep`), which the Worker Cron trigger
  calls every 5 minutes through `worker.ts`. Cron runs appear in Workers Logs;
  a missing `CRON_SECRET` logs "Scheduled sweep skipped". To retry by hand,
  call it with `Authorization: Bearer <CRON_SECRET>`.
- `failed` events ran out of attempts (3). Inspect the logs before replaying.
- Processed and ignored events are purged after 30 days.

## Rollback

**Code rollback is lossless.** Every message the new code stored or sent also
wrote its legacy activity in the same transaction, so the reverted routes read
a complete `activities` timeline. Read state matches because marking a
conversation read also sets `read_at` on its legacy activities.

1. Revert the application deploy (and the Cron slice, which reverts
   independently by restoring `main = ".open-next/worker.js"`).
2. **Keep the new tables.** Nothing in the reverted code reads or writes them;
   they simply stop receiving rows. Migrations A and B stay applied.
3. Before deploying the pipeline again:
   - run `SELECT public.messaging_backfill_instagram_history();` to copy the
     activities the old code wrote during the rollback window (idempotent);
   - reads done through the old code during the window changed `read_at` on
     activities but not `unread_count`, which the additive backfill never
     overwrites. If query 4.3 shows a difference, reconcile it once, in a
     quiet moment (this overwrites `unread_count` from the legacy read state):

     ```sql
     UPDATE public.conversations c
     SET unread_count = sub.unread, updated_at = now()
     FROM (
       SELECT m.conversation_id, count(*) FILTER (WHERE a.read_at IS NULL) AS unread
       FROM public.messages m
       JOIN public.activities a ON a.id = m.legacy_activity_id
       WHERE m.direction = 'in'
       GROUP BY m.conversation_id
     ) sub
     WHERE c.id = sub.conversation_id AND c.unread_count <> sub.unread;
     ```
4. **Full revert** (only if the pipeline is abandoned, after the code is
   reverted): a new migration that drops the backfill and ADR-10 functions and
   the four tables (`messages`, `conversations`, `webhook_events`,
   `channel_accounts`) and removes `conversations`/`messages` from the
   `supabase_realtime` publication. No history is lost: the legacy activities
   were never modified by the backfill.

## Known limitations

- A user copied under a `legacy:<user_id>` placeholder who reconnects later
  gets a real account through `storeToken`; their old history stays under the
  placeholder conversation, and new messages from the same participant open a
  conversation under the real account. Merging is out of scope.
- `channel_accounts.external_account_id` is unique across users: credentials
  sharing an IG id with another user are not seeded (`accounts_conflicting`).
- `service_role` keeps `EXECUTE` on the backfill, so anyone holding the
  service-role key can call it through `/rest/v1/rpc`. It is idempotent and
  admin-only, but treat that key accordingly.
- Accounts are seeded from `user_secrets.instagram_ig_id` only. A row with an
  `instagram_page_id` but no IG id (the old webhook also matched by page id)
  gets no account; `storeToken` always writes both, so this should not occur.
  Query 4.1 lists users with credentials but no account.
- Titles with a handle (`Instagram DM to <handle>`), stray whitespace or a
  different casing are not copied; they are counted as unparseable and the
  inspect query in step 3 lists them.
