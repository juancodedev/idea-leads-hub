# Design: Activities Status Management

## Technical Approach

Mirror the Ideas module end-to-end (enum + DB CHECK + repo `moveStatus` + `MoveIdeaStatus` + `PATCH .../status` + audit). Enumerate `ActivityStatus` (PENDING | IN_PROGRESS | COMPLETED) on a new `activities.status` column with a CHECK, backfill from `completed`, and decouple Instagram read into a nullable `read_at`. During rollout keep `completed` and dual-write it (`completed = (status='COMPLETED')`) in every explicit repo verb, migrating ALL binary-`completed` writers (create, `complete`, toggle, `/read`, ideas-page form) to the status surface FIRST, with a DB trigger shipped LAST as a safety net, so `/read`, `/unread`, the Instagram conversations list, dashboard `getPending`, and timelines keep working; drop is deferred. The read marker (`read_at IS NULL`) is the single source of truth for "unread" across the sidebar badge, the conversations list, and the page's read-selection (BR-3): **completion never implies read and read never implies completion** — a COMPLETED-but-unread `INSTAGRAM_MESSAGE` stays "unread" in the badge and conversations list until `read_at` is set, and a read-but-`PENDING` message stays out of unread counts. Serves free transitions through `MoveActivityStatus`, repo verbs `moveStatus`/`markRead`/`markUnread`/`getUnreadCount`, REST `PATCH /status` + read refactor, and a per-row inline control in `/activities` with optimistic update + revert + `revalidatePath` + toast.

## Architecture Decisions

| Decision | Option | Tradeoff | Decision |
|---|---|---|---|
| Enum location | In `Activity.ts` vs `domain/enums/ActivityStatus.ts` | Separate file matches `ActivityType.ts` convention | `domain/enums/ActivityStatus.ts`, exported from `index.ts` |
| Repo verb name | `changeStatus` vs `moveStatus` | `moveStatus` == Ideas | `moveStatus(id, status)` |
| Read marker | `read_at` + `is_read` bool vs single nullable `read_at` | Null timestamp encodes unread; mirrors `completed_at` | single `read_at timestamptz`; unread = `IS NULL` (single source of truth for badge + conversations list + page selection — BR-3) |
| Read use cases | Fold into `MoveActivityStatus` vs distinct | Read semantically decoupled (BR-3); distinct routes | Distinct `MarkActivityRead` / `MarkActivityUnread`; `moveStatus` never touches `read_at`, read never touches `status`/`completed` |
| Dual-write enforcer | Code-only vs DB trigger | Trigger only catches writes once every path is migrated — deployed early it silently reverts legacy `completed=true` writes lacking `status='COMPLETED'` (BR-4) | Migrate every `completed` writer (create, `complete`, toggle, `/read`) to the status surface with explicit dual-write in verbs; trigger deployed LAST as safety net |
| Legacy `ActivityItem` | Fix-in-place vs migrate to `presentation/` | Legacy renders `description` (bug) & old checkbox; `/activities` is its only user | **Migrate**: extend `presentation/components/ActivityItem.tsx` with additive `onStatusChange`, retire `components/ActivityItem` |
| `complete` | Duplicate logic vs reuse | Reuse guarantees invariant | `CompleteActivity` → `moveStatus(COMPLETED)` |

## Data Flow

Row control (ActivityItem) → changeActivityStatus action ─→ MoveActivityStatus ─→ repo.moveStatus(id,status)
         │ optimistic + revert(toast)   │ getById-first + createAuditLog      │ (pure — no logging) └ UPDATE activities
         └ revalidatePath('/activities')└ changes.status.{old,new} (CALLER)                           SET status, completed,
                                                                                                       completed_at (CASE)

    PATCH /read ─→ MarkActivityRead ─→ repo.markRead(id) → UPDATE read_at=now()   (status/completed untouched)
    GET /unread ─→ repo.getUnreadCount(userId) → type=INSTAGRAM_MESSAGE AND read_at IS NULL
    GET /api/instagram/conversations ─→ per-conversation unreadCount = count(read_at IS NULL)
                                          (same read marker as badge; no `completed` dependency — BR-3)

    `MoveActivityStatus` stays pure: existence check (NotFound) → `repo.moveStatus` → returns the updated
    activity. It deliberately does NOT log — audit lives at the caller layers (status route,
    `changeActivityStatus`, `toggleActivityCompletion`), which load the current row first to build the
    `changes.status.{old,new}` delta, so a transition is audited exactly once with a single fetch
    (spec: audit via server action and REST route).

    BR-3 single source of truth for "unread" (badge + conversation list + page read-selection):
    `read_at IS NULL` ⇔ unread for INSTAGRAM_MESSAGE. Completion never implies read (moveStatus(COMPLETED)
    leaves `read_at` untouched) and read never implies completion (markRead leaves `status` untouched) —
    a COMPLETED-but-unread Instagram message stays "unread" in the badge and conversation list until read.

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260813_add_activity_status.sql` | Create | `status` col (NULLABLE), backfill `COMPLETED` from `completed=true` (rest `PENDING`), `activities_status_check` CHECK, `read_at` col (NULLABLE), backfill Instagram read — NO `SET NOT NULL` here (deferred to the post-code migration below, see Migration / Rollout) |
| `supabase/migrations/20260814_activity_status_not_null.sql` | Create | `ALTER COLUMN status SET DEFAULT 'PENDING'` + `SET NOT NULL` — runs AFTER every `completed` writer is migrated to the status surface (Rollout step 4), closing the window in which legacy writers could create violating rows |
| `supabase/migrations/20260813_sync_activity_completed_trigger.sql` | Create | Trigger `sync_activity_completed` (`NEW.completed := (NEW.status='COMPLETED')`) — deployed LAST, after every `completed` writer is migrated (see Migration / Rollout), as a safety net only |
| `src/modules/activities/domain/enums/ActivityStatus.ts` | Create | `PENDING\|IN_PROGRESS\|COMPLETED` |
| `src/modules/activities/application/use-cases/MoveActivityStatus.ts` (+`.spec.ts`) | Create | existence check → `moveStatus` |
| `src/modules/activities/application/use-cases/CompleteActivity.ts` (+spec) | Modify | re-point `repository.complete` → `moveStatus(COMPLETED)` (NotFound preserved) — completes dual-write via `moveStatus` |
| `src/app/api/activities/[id]/complete/route.ts` | Modify | delegate to migrated `CompleteActivity`; HTTP surface (200/404) unchanged; update `__tests__/complete-route.spec.ts` |
| `src/modules/activities/application/use-cases/CreateActivity.ts` (+spec) | Modify | pass `status` through to `repo.create` (normalization of legacy `completed:true → status=COMPLETED` lives at the repo/createAction boundary) |
| `src/modules/activities/application/use-cases/MarkActivityRead.ts`, `MarkActivityUnread.ts` (+specs) | Create | set/clear `read_at` |
| `src/app/api/activities/[id]/status/route.ts` (+spec) | Create | PATCH, `z.nativeEnum`; getById-first: load current activity to compute audit `changes.status.{old,new}`, then call use case |
| `src/modules/activities/domain/entities/Activity.ts` | Modify | `status: ActivityStatus`, `readAt?`; `CreateActivityDTO` gains `status?` (legacy `completed` kept during rollout); `UpdateActivityDTO` drops `completed` |
| `src/modules/activities/domain/repositories/ActivityRepository.ts` | Modify | `moveStatus/markRead/markUnread/getUnreadCount`; search `statusIn?: ActivityStatus[]` (mapping below) |
| `src/modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts` | Modify | implement verbs; rework `complete()` → `moveStatus(COMPLETED)`; `create()` normalizes `completed:true → status=COMPLETED` and writes `completed = (status='COMPLETED')`; `update()` stops writing `completed` directly; search `statusIn` filter with default `[PENDING, IN_PROGRESS]` |
| `src/modules/activities/infrastructure/mappers/ActivityMapper.ts` | Modify | map `status`/`read_at`; derive `completed` from `status` on persistence |
| `src/infrastructure/database/database.types.ts` | Modify | `status`, `read_at` in Row/Insert/Update |
| `src/modules/activities/infrastructure/actions/activityActions.ts` | Modify | `changeActivityStatus` + audit (getById-first, `changes.status.{old,new}`); `createActivityAction` passes `status` through (`completed:true` → `COMPLETED`) |
| `src/app/(dashboard)/activities/actions.ts` | Modify | `toggleActivityCompletion` re-pointed: complete → `moveStatus(COMPLETED)`, un-complete → `moveStatus(PENDING)`; status transition server action + `revalidatePath`; getById-first audit delta |
| `src/app/(dashboard)/activities/page.tsx` | Modify | status param filter (`pending\|in_progress\|completed\|all` → `statusIn`, default `[PENDING, IN_PROGRESS]`), title/copy |
| `src/app/(dashboard)/activities/ActivitiesList.tsx` | Modify | status filter UI, `onStatusChange`, optimistic |
| `src/modules/activities/presentation/components/ActivityItem.tsx` | Modify | add `onStatusChange` status selector; timeline toggle path re-pointed to `moveStatus(COMPLETED)` (remove `repository.complete` call) |
| `src/modules/ideas/presentation/components/AddActivityForm.tsx` | Modify | keeps sending `completed: true`; `createActivityAction`/`repo.create` normalize it to `status=COMPLETED` (no raw `completed` INSERT) |
| `src/app/api/activities/[id]/read/route.ts` (+spec) | Modify | repo `markRead`, drop `completed` write |
| `src/app/api/activities/unread/route.ts` (+spec) | Modify | repo `getUnreadCount` on `read_at` |
| `src/app/api/instagram/conversations/route.ts` | Modify | per-conversation `unreadCount` off the read marker: select `read_at`, count `read_at IS NULL` (replaces `!activity.completed`). Keeps the conversation list consistent with the badge once `/read` stops writing `completed` — same single source of truth (BR-3) |
| `src/app/api/activities/route.ts` | Modify | unlinked `unread=true` filter → `.is('read_at', null)` (read marker) only. No `?status=` mapping here: GET branches to `GetActivities` (leadId/ideaId) or the unlinked query — status filtering stays at the `/activities` page layer via `repo.search` (see mapping table)
| `src/app/messages/page.tsx` | Modify | read-selection keys on the read marker: linked filter `!readAt && type==='INSTAGRAM_MESSAGE'` (fetch `read_at`); unlinked reuses `/api/activities?unread=true` which now filters by `read_at IS NULL` |
| `src/app/api/activities/[id]/route.ts` | Modify | drop `completed` from `UpdateActivitySchema` |
| `src/app/api/docs/openapi.json/route.ts` | Modify | add `ActivityStatus` enum + `/status` + `/read` + `/unread`; during rollout KEEP `completed` in the Activity schema marked `deprecated: true`, ADD `status` + `read_at`; remove the `completed` field from OpenAPI in the SAME deferred follow-up as the column drop (Rollout step 7) — no doc/contract mismatch while GET payloads still emit `completed` |
| `src/modules/activities/index.ts` | Modify | export enum |
| `src/modules/activities/components/ActivityItem.tsx` (+`__tests__/`) | Delete | legacy residue after migrate |
| Existing spec mock factories (`src/app/api/activities/__tests__/complete-route.spec.ts`, `__tests__/id-route.spec.ts`, core app specs) | Modify | add new repo verbs to mocks |

## Interfaces / Contracts

```ts
// domain/enums/ActivityStatus.ts
export enum ActivityStatus { PENDING='PENDING', IN_PROGRESS='IN_PROGRESS', COMPLETED='COMPLETED' }

// ActivityRepository additions
moveStatus(id: string, status: ActivityStatus): Promise<Activity>;
markRead(id: string): Promise<Activity>;   // sets read_at=now() only
markUnread(id: string): Promise<Activity>; // clears read_at only
getUnreadCount(userId: string): Promise<number>; // INSTAGRAM_MESSAGE + read_at IS NULL
// search: completed?: boolean  →  statusIn?: ActivityStatus[]
```

```ts
// Search contract — statusIn replaces the binary `completed?: boolean` filter.
// Adapter behavior: `statusIn` omitted → default [PENDING, IN_PROGRESS],
// preserving today's "pending list" default (previously `.eq('completed', false)`).
// Where it applies: the /activities PAGE layer only (page.tsx server-side → repo.search).
// No API route consumes `?status=` — GET /api/activities branches to GetActivities/
// getForLead/getForIdea and the unlinked query, none of which filter by status.

// Mapping (page layer → repo params → Supabase filter):
//   no param           → statusIn: [PENDING, IN_PROGRESS]              → .in('status', ['PENDING','IN_PROGRESS'])
//   ?status=pending    → statusIn: [PENDING]                           → .in('status', ['PENDING'])
//   ?status=in_progress→ statusIn: [IN_PROGRESS]                       → .in('status', ['IN_PROGRESS'])
//   ?status=completed  → statusIn: [COMPLETED]                         → .in('status', ['COMPLETED'])
//   ?status=all        → statusIn: [PENDING, IN_PROGRESS, COMPLETED]   → .in('status', [all three])
```

```sql
-- repo.moveStatus (atomic; BR-4 + BR-6)
UPDATE activities
   SET status = $status,
       completed = ($status = 'COMPLETED'),
       completed_at = CASE WHEN $status='COMPLETED' THEN COALESCE(completed_at, now()) ELSE NULL END
 WHERE id = $id RETURNING *;
```

```ts
// route ChangeStatusSchema
const ChangeStatusSchema = z.object({ status: z.nativeEnum(ActivityStatus, {
  errorMap: () => ({ message: 'Invalid status value' }) }) });
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `moveStatus` free transitions + dual-write (`completed` == status) + `completed_at` stamp/clear | repo mock; assert returned `status`/`completed`; invariant across `moveStatus`/`complete`/`markRead` |
| Unit | `MoveActivityStatus` NotFound; `MarkActivityRead/Unread` leave status/`completed` untouched (BR-3) | mock repo |
| Unit | Mapper `status`/`read_at` round-trip | existing mapper pattern |
| Integration | Read/completed decoupling: transition ≠ read; read ≠ complete | route specs (`complete-route.spec.ts` mock pattern) |
| Integration | New `PATCH /status` 200/400/404; `/read` sets `read_at` only; `/unread` counts `read_at IS NULL` | mock `withAuth` + repo |

## Migration / Rollout

**Data (no behavior change — legacy `completed` consumers unaffected):**

1. `ADD COLUMN status TEXT` (nullable) and `ADD COLUMN read_at TIMESTAMPTZ` (nullable). Do NOT set `NOT NULL` yet — nothing rejects a write missing `status` at this point.
2. Backfill from `completed`: `status = CASE WHEN completed THEN 'COMPLETED' ELSE 'PENDING' END`; `read_at = COALESCE(completed_at, created_at, now())` where `type='INSTAGRAM_MESSAGE' AND completed=true`. Add `activities_status_check` CHECK.

**Code — migrate EVERY binary-`completed` writer to the status surface BEFORE `SET NOT NULL DEFAULT` and BEFORE the trigger:**

3. Deploy code that migrates ALL writers (create, `complete`, toggle, `/read`, ideas-page form, `PATCH [id]`): they now write `status`/`read_at` correctly and dual-write `completed = (status='COMPLETED')` where still needed. `/unread`, the GET unlinked `unread=true` filter, and the conversations list switch to `read_at IS NULL`; `messages/page.tsx` read-selection keys on the read marker; `PATCH [id]` drops `completed`. From this point every writer supplies `status`, so no new row can violate `completed = (status='COMPLETED')`.
4. THEN `ALTER COLUMN status SET NOT NULL DEFAULT 'PENDING'` — safe only now: every legacy `completed=true` writer is migrated, closing the window in which a create/complete/`/read` between steps 1 and 3 would produce a violating row.
5. Trigger `sync_activity_completed` BEFORE INSERT/UPDATE: `NEW.completed := (NEW.status='COMPLETED')` — shipped LAST, as a safety net only; with every writer migrated in step 3 it never flips a write. Optional alternative: skip the trigger and rely on the explicit verb invariant + step 6 assertion.
6. Post-rollout invariant assertion: `SELECT count(*) FROM activities WHERE completed IS DISTINCT FROM (status='COMPLETED')` must return 0. If it does not, REMEDIATE first — repair the violating rows (re-check each row's intent, then e.g. `UPDATE activities SET completed = (status='COMPLETED')` or fix `status`) BEFORE proceeding to the deferred drop.

7. Keep `completed`; column drop + trigger removal + OpenAPI `completed` field removal (see File Changes) = ONE deferred follow-up. Rollback: revert code; dual-write already populated.

**BR-3/BR-4 guarantee during rollout** (every step keeps these working): `/read`, `/unread`, the sidebar badge (`useUnreadCount` polls the migrated `/unread` route — no direct `completed` dependency; its Realtime INSERT increment is type-scoped only), the Instagram conversations list (per-conversation `unreadCount` computed on `read_at IS NULL` from step 3 on — same read marker as the badge, BR-3), dashboard `getPending` & timelines (filter on `completed`, kept synced by steps 3–5), and ideas-page creation (`completed:true` normalized to `COMPLETED`). Read state stays independent of status in every consumer: completing never clears `read_at`, and reading never touches `status`/`completed`.

## Open Questions

- [ ] Confirm default filter `status != COMPLETED` replaces the "Completadas" checkbox (spec assumes yes).
- [ ] Add `markUnread` REST endpoint now, or repo verb only (spec table lists PATCH `/read` + GET `/unread` only)?
