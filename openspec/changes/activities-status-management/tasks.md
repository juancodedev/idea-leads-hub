# Tasks: Activities Status Management

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1400–1800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 (feature-branch-chain) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units (recommended: feature-branch-chain; PR 1 base = feature/tracker branch)

| Unit | Scope | Base | ~Lines |
|------|-------|------|--------|
| 1 | Migrations + domain + use cases (Phases 1–3) | tracker | 420 |
| 2 | Adapters + mapper + types + actions (Phase 4) | PR 1 | 340 |
| 3 | REST routes + read consumers + OpenAPI (Phase 5) | PR 2 | 580 |
| 4 | UI + legacy removal + verification (Phases 6–7) | PR 3 | 460 |

Highest risk first: 1.1 backfill, 4.1 dual-write, 5.3/5.4 read decoupling, 5.2 `/complete` audit.
Paths base `src/modules/activities/` unless stated; API routes under `src/app/api/activities/`.

## Phase 1: Data / Migration (CF-1 rollout)

- [ ] 1.1 Create `supabase/migrations/20260813000001_add_activity_status.sql` (14-digit CF-1): ADD nullable `status TEXT` + `read_at TIMESTAMPTZ`; backfill `status` from `completed`; Instagram `read_at = COALESCE(completed_at, created_at, now())`; CHECK 3 values; NO `SET NOT NULL`.
- [ ] 1.2 Create `supabase/migrations/20260814000000_activity_status_not_null.sql`: `SET DEFAULT 'PENDING'` + `SET NOT NULL` — apply ONLY after all writers migrated (step 4).
- [ ] 1.3 Create `supabase/migrations/20260815000000_sync_activity_completed_trigger.sql`: BEFORE INSERT/UPDATE `completed=(status='COMPLETED')`; push LAST (safety net), gated until 1.4.
- [ ] 1.4 Runbook: post-deploy invariant `completed IS DISTINCT FROM (status='COMPLETED')` count=0; remediate before trigger push.

## Phase 2: Domain

- [ ] 2.1 RED→GREEN: `domain/enums/ActivityStatus.ts` (PENDING|IN_PROGRESS|COMPLETED) + spec; export via `index.ts`.
- [ ] 2.2 RED→GREEN: `domain/entities/Activity.ts`: `status`, `readAt?`; CreateDTO `status?` (keep `completed`); UpdateDTO drops `completed`.
- [ ] 2.3 RED→GREEN: `domain/repositories/ActivityRepository.ts`: `moveStatus/markRead/markUnread/getUnreadCount`; search `completed?`→`statusIn?`.

## Phase 3: Application

- [ ] 3.1 RED→GREEN: `application/use-cases/MoveActivityStatus.ts`: getById → `moveStatus`; NotFound; pure (no audit — callers log).
- [ ] 3.2 RED→GREEN: `application/use-cases/CompleteActivity.ts` → `moveStatus(COMPLETED)`; update spec.
- [ ] 3.3 RED→GREEN: `application/use-cases/CreateActivity.ts`: pass `status`; `completed:true→COMPLETED` at repo/action boundary.
- [ ] 3.4 RED→GREEN: `MarkActivityRead/Unread.ts`: set/clear `read_at` only; never status/completed (BR-3).

## Phase 4: Infrastructure

- [ ] 4.1 RED→GREEN: `infrastructure/repositories/SupabaseActivityRepository.ts`: `moveStatus` atomic (status, dual-write `completed`, `completed_at` CASE BR-6); `complete()` rework; `create()` normalize+dual-write; `update()` stops `completed`; `markRead/markUnread/getUnreadCount` (`read_at IS NULL`); search `statusIn` default `[PENDING,IN_PROGRESS]`.
- [ ] 4.2 RED→GREEN: `infrastructure/mappers/ActivityMapper.ts`: map `status`/`read_at`; derive `completed`.
- [ ] 4.3 `src/infrastructure/database/database.types.ts`: `status`, `read_at` in Row/Insert/Update.
- [ ] 4.4 RED→GREEN: `infrastructure/actions/activityActions.ts`: `changeActivityStatus` (getById-first + `createAuditLog` `{old,new}`); `createActivityAction` passes `status`.
- [ ] 4.5 Update spec mocks (`__tests__/complete-route.spec.ts`, `id-route.spec.ts`, `route.spec.ts`, core specs) with new verbs.

## Phase 5: REST + OpenAPI (CF-2)

- [ ] 5.1 RED→GREEN: `[id]/status/route.ts`: PATCH `z.nativeEnum` (400), 404, getById-first audit delta, 200; spec per complete-route pattern.
- [ ] 5.2 RED→GREEN: `[id]/complete/route.ts`: delegate; ADD audit `changes.status.{old,new}` (currently none — CF-2); update spec.
- [ ] 5.3 RED→GREEN: `[id]/read/route.ts`: `markRead`, drop `completed` write; spec: status/completed untouched (BR-3).
- [ ] 5.4 RED→GREEN: `unread/route.ts`: `getUnreadCount` on `read_at IS NULL`; spec.
- [ ] 5.5 `route.ts` (list): unlinked `unread=true` filter → `.is('read_at', null)`; no `?status=` mapping.
- [ ] 5.6 `[id]/route.ts`: drop `completed` from UpdateActivitySchema (field ignored scenario).
- [ ] 5.7 `src/app/api/instagram/conversations/route.ts`: unreadCount on read marker (replaces `!activity.completed`).
- [ ] 5.8 `src/app/messages/page.tsx`: selection on `!readAt && INSTAGRAM_MESSAGE`, fetch `read_at`.
- [ ] 5.9 `src/app/api/docs/openapi.json/route.ts`: `ActivityStatus` enum + `/status`,`/read`,`/unread`; `completed` marked deprecated (removal deferred).

## Phase 6: UI

- [ ] 6.1 RED→GREEN: `presentation/components/ActivityItem.tsx`: `onStatusChange` selector; timeline toggle → `moveStatus(COMPLETED)`, drop `repository.complete`.
- [ ] 6.2 RED→GREEN: `(dashboard)/activities/actions.ts`: toggle → `moveStatus(COMPLETED/PENDING)` + getById-first audit delta; transition action + `revalidatePath`.
- [ ] 6.3 RED→GREEN: `(dashboard)/activities/ActivitiesList.tsx`: status filter replaces "Completadas"; optimistic + revert-toast; `status` URL param.
- [ ] 6.4 `(dashboard)/activities/page.tsx`: `status` param → `statusIn` (default `[PENDING,IN_PROGRESS]`); title/copy.
- [ ] 6.5 `src/modules/ideas/presentation/components/AddActivityForm.tsx`: `completed:true` normalized; no raw `completed` INSERT.

## Phase 7: Cleanup / Verification

- [ ] 7.1 Delete legacy `components/ActivityItem.tsx` + spec after page migrates (design: retire legacy).
- [ ] 7.2 Regression: dashboard `getPending`, timelines, badge (`useUnreadCount`) green under dual-write + read marker.
- [ ] 7.3 `pnpm test`, `tsc --noEmit`, `next lint` green; note deferred follow-up: column drop + trigger removal + OpenAPI `completed` removal (ONE later change).