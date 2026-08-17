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

- [x] 1.1 Create `supabase/migrations/20260813000001_add_activity_status.sql` (14-digit CF-1): ADD nullable `status TEXT` + `read_at TIMESTAMPTZ`; backfill `status` from `completed`; Instagram `read_at = COALESCE(completed_at, created_at, now())`; CHECK 3 values; NO `SET NOT NULL`.
- [x] 1.2 Create `supabase/migrations/20260814000000_activity_status_not_null.sql`: `SET DEFAULT 'PENDING'` + `SET NOT NULL` — apply ONLY after all writers migrated (step 4) — DONE: final rollout migration; defensive/idempotent: straggler backfill (`status IS NULL` → CASE WHEN completed) + `SET DEFAULT 'PENDING'` + `SET NOT NULL` on `public.activities`; gating comments; spec `20260814000000_activity_status_not_null.spec.ts` 7/7 green (commit pending this slice).
- [x] 1.3 Create `supabase/migrations/20260815000000_sync_activity_completed_trigger.sql`: BEFORE INSERT/UPDATE `completed=(status='COMPLETED')`; push LAST (safety net), gated until 1.4 — DONE: `fn_sync_activity_completed()` + `tr_sync_activity_completed` (DROP IF EXISTS + CREATE, idempotent, CREATE OR REPLACE per leads convention); comment wording uses "sync hook"/"sync function"; only touches `completed`, never `read_at` (BR-3); spec `20260815000000_sync_activity_completed_trigger.spec.ts` 6/6 green (commit pending this slice).
- [x] 1.4 Runbook: post-deploy invariant `completed IS DISTINCT FROM (status='COMPLETED')` count=0; remediate before trigger push.

## Phase 2: Domain

- [x] 2.1 RED→GREEN: `domain/enums/ActivityStatus.ts` (PENDING|IN_PROGRESS|COMPLETED) + spec; export via `index.ts`.
- [x] 2.2 RED→GREEN: `domain/entities/Activity.ts`: `status`, `readAt?`; CreateDTO `status?` (keep `completed`); UpdateDTO drops `completed`.
- [x] 2.3 RED→GREEN: `domain/repositories/ActivityRepository.ts`: `moveStatus/markRead/markUnread/getUnreadCount`; search `completed?`→`statusIn?`.

## Phase 3: Application

- [x] 3.1 RED→GREEN: `application/use-cases/MoveActivityStatus.ts`: getById → `moveStatus`; NotFound; pure (no audit — callers log).
- [x] 3.2 RED→GREEN: `application/use-cases/CompleteActivity.ts` → `moveStatus(COMPLETED)`; update spec.
- [x] 3.3 RED→GREEN: `application/use-cases/CreateActivity.ts`: pass `status`; `completed:true→COMPLETED` at repo/action boundary.
- [x] 3.4 RED→GREEN: `MarkActivityRead/Unread.ts`: set/clear `read_at` only; never status/completed (BR-3).

## Phase 4: Infrastructure

- [x] 4.1 RED→GREEN: `infrastructure/repositories/SupabaseActivityRepository.ts`: `moveStatus` atomic (status, dual-write `completed`, `completed_at` CASE BR-6); `complete()` rework; `create()` normalize+dual-write; `update()` stops `completed`; `markRead/markUnread/getUnreadCount` (`read_at IS NULL`); search `statusIn` default `[PENDING,IN_PROGRESS]` — DONE: implementation spec added (`SupabaseActivityRepository.spec.ts`, 12 tests — SUGGESTION-01 corrected from 13; verified by dedicated jest run); BR-3 type guard on markRead/markUnread (`.eq('type', INSTAGRAM_MESSAGE)`) implemented; search default treats `status IS NULL` as PENDING via `.or(...)`.
- [x] 4.2 RED→GREEN: `infrastructure/mappers/ActivityMapper.ts`: map `status`/`read_at`; derive `completed` — DONE: implementation spec added (`ActivityMapper.spec.ts`, 8 tests) covering NULL-status fallback and dual-write derivation.
- [x] 4.3 `src/infrastructure/database/database.types.ts`: `status`, `read_at` in Row/Insert/Update — DONE (absorbed in slice 1; `status`/`read_at` present in all three shapes).
- [x] 4.4 RED→GREEN: `infrastructure/actions/activityActions.ts`: `changeActivityStatus` (getById-first + `createAuditLog` `{old,new}`); `createActivityAction` passes `status` — DONE: spec added (`activityActions.spec.ts`, 3 tests: getById-first delegation + audit delta, missing-id no-audit error, status passthrough); commit fc7a74a.
- [x] 4.5 Update spec mocks (`__tests__/complete-route.spec.ts`, `id-route.spec.ts`, `route.spec.ts`, core specs) with new verbs — DONE: complete-route/id-route mocks updated in slice 1; `route.spec.ts` mock now includes `moveStatus/markRead/markUnread/getUnreadCount`; id-route gained the PATCH silent-strip contract test.

## Phase 5: REST + OpenAPI (CF-2)

- [x] 5.1 RED→GREEN: `[id]/status/route.ts`: PATCH `z.nativeEnum` (400), 404, getById-first audit delta, 200; spec per complete-route pattern — DONE: `status-route.spec.ts` (4 tests: transition + audit delta, invalid enum 400, 404, no-audit-on-error); commits 6ad1830.
- [x] 5.2 RED→GREEN: `[id]/complete/route.ts`: delegate; ADD audit `changes.status.{old,new}` (currently none — CF-2); update spec — DONE: complete-route spec asserts the delta + no-audit on 404; commit 2e5fdc6.
- [x] 5.3 RED→GREEN: `[id]/read/route.ts`: `markRead`, drop `completed` write; spec: status/completed untouched (BR-3) — DONE: `read-route.spec.ts` (2 tests: markRead only, 404); commit f56a7c0.
- [x] 5.4 RED→GREEN: `unread/route.ts`: `getUnreadCount` on `read_at IS NULL`; spec — DONE: `unread-route.spec.ts` (2 tests: count via repo verb, zero); commit f56a7c0.
- [x] 5.5 `route.ts` (list): unlinked `unread=true` filter → `.is('read_at', null)`; no `?status=` mapping — DONE: route.spec added unlinked-branch test asserting `is('read_at', null)` and absence of `eq('completed', false)`; selects `read_at`; commit c1735a5.
- [x] 5.6 `[id]/route.ts`: drop `completed` from UpdateActivitySchema (field ignored scenario) — DONE (absorbed in slice 1; contract test + silent-strip note added in api-rest spec).
- [x] 5.7 `src/app/api/instagram/conversations/route.ts`: unreadCount on read marker (replaces `!activity.completed`) — DONE: `conversations-route.spec.ts` (2 tests: unreadCount by read_at IS NULL; completed-but-unread stays unread); selects `read_at`; commit c7d7953.
- [x] 5.8 `src/app/messages/page.tsx`: selection on `!readAt && INSTAGRAM_MESSAGE`, fetch `read_at` — DONE: linked mark-as-read filters `!readAt && type==='INSTAGRAM_MESSAGE'`; unlinked reuses `/api/activities?unread=true` (read_at IS NULL); commit c7d7953.
- [x] 5.9 `src/app/api/docs/openapi.json/route.ts`: `ActivityStatus` enum + `/status`,`/read`,`/unread`; `completed` marked deprecated (removal deferred) — DONE: `openapi-route.spec.ts` asserts enum + paths + status/readAt on Activity + `completed.deprecated`; `UpdateActivityRequest` drops `completed`; commit 22188df.

## Phase 6: UI

- [x] 6.1 RED→GREEN: `presentation/components/ActivityItem.tsx`: `onStatusChange` selector; timeline toggle → `moveStatus(COMPLETED)`, drop `repository.complete` — DONE: selector renders only when `onStatusChange` provided; checkbox completes via `moveStatus(COMPLETED)`; spec `presentation/components/__tests__/ActivityItem.spec.tsx` 5/5 green (commit e9aec72, after checkbox root props fix 40bdf1e).
- [x] 6.2 RED→GREEN: `(dashboard)/activities/actions.ts`: toggle → `moveStatus(COMPLETED/PENDING)` + getById-first audit delta; transition action + `revalidatePath` — DONE (toggle re-pointed in slice 1; spec `actions.spec.ts` added covering complete AND un-complete paths + unauthenticated rejection). The getById-first audit delta + transition action remain part of the later UI slice (6.4+).
- [x] 6.3 RED→GREEN: `(dashboard)/activities/ActivitiesList.tsx`: status filter replaces "Completadas"; optimistic + revert-toast; `status` URL param — DONE: status `<select aria-label="Filtrar por estado">` (Pendientes/Pendiente/En progreso/Completadas/Todas) writes `status` param preserving others; optimistic `handleStatusChange` → `changeActivityStatus(id, status)` with revert + `toast.error` on `{ error }` or throw; `useEffect` re-syncs from server after revalidation; actions.ts re-exports infra `changeActivityStatus`; spec 6/6 green (commit 1cef3c6).
- [x] 6.4 `(dashboard)/activities/page.tsx`: `status` param → `statusIn` (default `[PENDING,IN_PROGRESS]`); title/copy — DONE: pure `statusFilter.ts resolveStatusIn` (spec 3/3 green) maps param → statusIn; `completed` alias removed from `ActivitySearchParams`, `SupabaseActivityRepository.search` (only `statusIn`/default pending branch remain), domain contract spec + repo spec legacy-alias tests; h1 copy "pendientes"→generic `actividad/actividades` + CardTitle "Tareas Pendientes"→"Actividades" (commit 739c0b5).
- [x] 6.5 `src/modules/ideas/presentation/components/AddActivityForm.tsx`: `completed:true` normalized; no raw `completed` INSERT — DONE: create branch sends `status: ActivityStatus.COMPLETED` (no `completed` key — spec asserts both); edit branch unchanged; spec `__tests__/AddActivityForm.spec.tsx` 2/2 green (commit 1e0a305).

## Phase 7: Cleanup / Verification

- [x] 7.1 Delete legacy `components/ActivityItem.tsx` + spec after page migrates (design: retire legacy) — DONE: no importers remained after 6.4; both files removed (commit 3a73608, 102 deletions).
- [x] 7.2 Regression: dashboard `getPending`, timelines, badge (`useUnreadCount`) green under dual-write + read marker — DONE: full suite green with legacy component gone (76 suites / 416 tests; includes PipelineBoard getPending, timeline ActivityItem, ActivityBadge/useUnreadCount specs, dashboard pages).
- [x] 7.3 `pnpm test`, `tsc --noEmit`, `next lint` green; note deferred follow-up: column drop + trigger removal + OpenAPI `completed` removal (ONE later change) — DONE: `pnpm test -- --ci` 76 suites / 416 tests, `tsc --noEmit` exit 0, `next lint` exit 0 (SUGGESTION-02: actual full-repo lint shows only pre-existing warnings — `leads/components/LeadPopup.tsx`, `TagSelector.tsx`, `IdeaDeleteDialog.tsx`, `InstagramIntegration.tsx`, and 2× `messages/page.tsx` L198/L352; all verified present before this change, none introduced here). DEFERRED follow-up (ONE later change): DB column drop + trigger removal + OpenAPI `completed` removal.