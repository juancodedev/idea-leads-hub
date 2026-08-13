# Activities Status Rollout

Runbook for rolling out the `status` column (`PENDING | IN_PROGRESS | COMPLETED`)
and `read_at` on `public.activities`, while the legacy `completed` boolean
remains the source of truth during the transition.

## Summary

| Step | Migration | Slice | What it does |
| --- | --- | --- | --- |
| 1 | `20260813000001_add_activity_status.sql` | 1 (this change) | Adds nullable `status` + `read_at`, backfills, adds CHECK constraint. No NOT NULL, no trigger. |
| 2 | `20260814000000_activity_status_not_null.sql` | later (writer migrations) | Backfills any stragglers and sets `status` NOT NULL. |
| 3 | `20260815000000_sync_activity_completed_trigger.sql` | later (writer migrations) | Sync trigger keeping `completed = (status = 'COMPLETED')` in both directions. |

## Deploy order

1. Ship the application code (slice 1 modules) behind the rollback-safe path:
   writers continue to set `completed`, readers default `status` to
   `PENDING` when NULL.
2. Apply step 1 migration. It is additive and non-locking for existing rows
   (new nullable columns; backfill UPDATEs).
3. After the step 1 migration is live and the app has been running, apply
   step 2 (NOT NULL) and step 3 (sync trigger) in later slices.

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

## Rollback

- Step 1 is additive; rollback = drop the CHECK constraint and the two
  columns (`status`, `read_at`). No data is destroyed: `completed` and
  `completed_at` are untouched.
- Do NOT roll back by re-running `completed` writes while `status` is
  NOT NULL — that is why the sync trigger ships together with NOT NULL.