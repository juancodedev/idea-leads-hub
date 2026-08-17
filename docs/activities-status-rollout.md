# Activities Status Rollout

Runbook for rolling out the `status` column (`PENDING | IN_PROGRESS | COMPLETED`)
and `read_at` on `public.activities`, while the legacy `completed` boolean
remains dual-written during the transition.

## Summary

| Step | Migration | Slice | What it does |
| --- | --- | --- | --- |
| 1 | `20260813000001_add_activity_status.sql` | 1 (this change) | Adds nullable `status` + `read_at`, backfills, adds CHECK constraint (two-phase NOT VALID + VALIDATE). No NOT NULL, no trigger. Must be applied BEFORE the slice-1 code deploy. |
| 2 | `20260814000000_activity_status_not_null.sql` | 4 (this change, rollout step 4) | Backfills any stragglers with NULL `status`, sets `status` DEFAULT `'PENDING'` and `status` NOT NULL. Final rollout migration — apply ONLY after every writer is migrated (step 4) and the invariant check below returns zero rows. |
| 3 | `20260815000000_sync_activity_completed_trigger.sql` | 4 (this change, rollout step 5) | Sync hook keeping `completed = (status = 'COMPLETED')` on every write (BEFORE INSERT/UPDATE safety net). Push LAST, gated until the invariant check passes. |

## Deploy order

1. **Apply the step 1 data-prep migration FIRST.** It is additive and
   non-locking for existing rows (new nullable columns; backfill UPDATEs;
   CHECK constraint added NOT VALID then VALIDATEd). The currently deployed
   code keeps working against it unchanged:
   - legacy writers keep setting `completed` (the new columns are nullable,
     nothing rejects a write that lacks `status`);
   - readers treat `status = NULL` as `PENDING` everywhere — the mapper
     falls back to the legacy `completed` flag
     (`status ?? (completed ? 'COMPLETED' : 'PENDING')`), the repository
     `search` default filters
     `status.in.(PENDING,IN_PROGRESS) OR status.is.null`, and `getPending`
     still filters on the `completed` boolean. No behavior change.
2. **Then ship the application code (slice 1 modules).** Writers migrate to
   the status surface: create/`complete`/toggle/`moveStatus` write
   `status` and dual-write `completed = (status = 'COMPLETED')`; `markRead`
   /`markUnread` write only `read_at`; `PATCH /activities/[id]` drops
   `completed`. From this point every writer supplies `status`, so no new
   row can violate `completed = (status = 'COMPLETED')`.
3. After step 1 is live, the app deployed with the status surface (slices
   1–3), and the invariant check below returns zero rows, apply step 2
   (`NOT NULL DEFAULT 'PENDING'`) and step 3 (sync hook) as the final
   rollout migrations (slice 4) — only now is every legacy `completed`
   writer migrated, closing the window in which a create/complete/`/read`
   between steps 1 and 2 could produce a violating row.

Why migration-first? The step 1 migration is nullable and backfilled, so
old code reads it safely; deploying the code before the columns exist would
crash every status/read query on the old schema.

## Backfill vs BR-3

The step 1 migration backfills Instagram `read_at` from
`COALESCE(completed_at, created_at, now())` for rows with
`completed = true`. That backfill is a **ONE-TIME HISTORICAL MAPPING** of the
legacy "completed ⇒ read" coupling (the old `/read` endpoint marked read by
completing the activity). It is deliberately NOT a rule: going forward,
completion never implies read and read never implies completion (BR-3) —
`moveStatus(COMPLETED)` leaves `read_at` untouched and `markRead` leaves
`status`/`completed` untouched. Do not re-run the backfill and do not add a
trigger that keeps `read_at` coupled to `completed`.

## Post-deploy invariant check

The dual-write guarantee to verify after each deploy is that the legacy flag
and the new status never diverge:

```sql
-- Expected: zero rows.
SELECT count(*)
FROM public.activities
WHERE completed IS DISTINCT FROM (status = 'COMPLETED');
```

Any row returned means the sync path is broken — investigate before
proceeding with step 2 / step 3.

This check intentionally says nothing about `read_at`: legacy backfilled rows
carry a read timestamp derived from a *historical* completed flag, and BR-3
explicitly decouples the two going forward. `status`/`completed` may be
`COMPLETED` while `read_at` is NULL (completed-but-unread), and vice versa.
Do not add a check like `read_at = completed_at` or
`(read_at IS NULL) = (NOT completed)` — it would flag legitimate backfilled
rows and the intentional decoupling.

## Unread duality resolved (P5 shipped)

The P5 slice (REST + OpenAPI) rewired every unread consumer to the read
marker, resolving the temporary duality:

- `GET /api/activities/unread` now counts
  `type = 'INSTAGRAM_MESSAGE' AND read_at IS NULL` via the `getUnreadCount`
  verb (was `completed = false`);
- the Instagram conversations list computes per-conversation `unreadCount`
  from `read_at IS NULL`;
- the messages page read-selection keys on `!readAt && type='INSTAGRAM_MESSAGE'`
  (linked) and `/api/activities?unread=true` (unlinked), which filters the
  read marker;
- the unlinked list filter (`unread=true`) uses `.is('read_at', null)`.

`read_at IS NULL` is now the single source of truth for "unread" everywhere
(BR-3). No consumer depends on the binary `completed` flag for read state;
`completed` remains dual-written only as the legacy status flag. Do not
re-introduce a `completed = false` read-count anywhere.

## Rollback

- **Order matters: code rollback FIRST, then column drop.** Never drop
  `status`/`read_at` while code that writes them is still live.
- Step 1 migrate in this slice: revert the application code only. The
  columns stay (nullable, additive); reverted legacy code writes `completed`
  and readers fall back to the `completed` flag — identical behavior to
  before this change. No data is destroyed: `completed` and `completed_at`
  are untouched by the rollback.
- The deferred follow-up change performs the column drop + trigger removal +
  OpenAPI `completed` removal — in that change, the drop is the LAST step,
  after the code that wrote the columns has been rolled back/reverted.
- Do NOT roll back by re-running `completed` writes while `status` is
  NOT NULL — that is why the sync trigger ships together with NOT NULL.