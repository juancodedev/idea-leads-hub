## Exploration: activities-status-management

Manage activity status from the `/activities` listing — transition an activity between statuses (e.g., from a created task state to a completed state).

### Current State

#### 1. Page mapping — `/activities`

- **Route**: `src/app/(dashboard)/activities/page.tsx` — async **Server Component** (`export const dynamic = "force-dynamic"`). Resolves the auth user via `supabase.auth.getUser()` (returns `null` render if unauthenticated).
- **Data fetching**: builds a `SupabaseActivityRepository` server-side and calls `repo.search({ userId, query, type, completed, limit: 100 })`. Filters come from URL search params (`type`, `completed`, `q`). Default filter is `completed: false` — the page is titled "Tareas Pendientes".
- **Client component**: `src/app/(dashboard)/activities/ActivitiesList.tsx` (`'use client'`) — renders a search input, a type `<select>`, a "Completadas" checkbox filter, and one `ActivityItem` per row. Filter changes are pushed to the URL via `router.replace('/activities?...', { scroll: false })`.
- **The only existing management action**: a completion `Checkbox` per row in `ActivityItem` → `toggleActivityCompletion(id, completed)` server action (`src/app/(dashboard)/activities/actions.ts`), which calls `repository.complete(id)` or `repository.update({ id, completed: false })`. No optimistic update, no `revalidatePath`, no error toast — the row goes stale after toggling until the page reloads.
- **Other consumers of the same list data**: `src/modules/dashboard/components/UpcomingActivities.tsx` (5 most recent pending, read-only).

#### 2. Domain model — Activity end to end

- **DB schema** (`supabase/migrations/20240508000000_initial_schema.sql`, extended by `20240510000001`, `20240513164500`, `20240715000000`):
  - `public.activities`: `id uuid PK`, `user_id uuid FK auth.users`, `lead_id uuid FK leads`, `idea_id uuid FK ideas`, `type TEXT NOT NULL` with `CHECK` constraint (`'CALL','MEETING','FOLLOW_UP','EMAIL','TASK','NOTE','REMINDER','INVESTIGATION','ACTION','INSTAGRAM_MESSAGE'`), `title TEXT NOT NULL`, `description TEXT`, `due_date timestamptz`, `completed BOOLEAN DEFAULT FALSE`, `completed_at timestamptz`, `attachments JSONB DEFAULT '[]'`, `created_at`, `updated_at` (trigger-maintained).
  - **RLS**: single policy `FOR ALL USING (auth.uid() = user_id)` — fully user-scoped. Realtime publication enabled for the table (`20260723_enable_realtime_activities.sql`).
- **Domain entity**: `src/modules/activities/domain/entities/Activity.ts` — `id, leadId, ideaId, userId, type, title, description?, dueDate?, completed, completedAt?, createdAt, updatedAt, attachments?`. `CreateActivityDTO`, `UpdateActivityDTO` alongside.
- **Repository port**: `src/modules/activities/domain/repositories/ActivityRepository.ts` — `getById, getForLead, getForIdea, getPending, search, create, update, delete, complete`. `complete(id)` is a dedicated verb that sets `completed=true, completed_at=now()`.
- **Adapter**: `src/modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts` (extends `BaseRepository`), mapped via `ActivityMapper.toDomain/toPersistence` (`src/modules/activities/infrastructure/mappers/ActivityMapper.ts`). Typed rows in `src/infrastructure/database/database.types.ts`.
- **Zod schema**: `src/modules/activities/infrastructure/schemas/ActivitySchema.ts` — `title, description?, type, dueDate?, leadId`; drives `ActivityForm` (creation only).
- **REST surface** (all `runtime = 'nodejs'`, wrapped in `apiHandler` + `withAuth`, error mapping in `src/lib/api/api-handler.ts` / `src/infrastructure/repositories/errors.ts`):
  - `GET/POST /api/activities` — list by `leadId`/`ideaId`/`unlinkedId`, create.
  - `GET/PATCH/DELETE /api/activities/[id]` — PATCH accepts `completed` among other fields (uses **legacy** `@/core/application/activities/UpdateActivity`).
  - `PATCH /api/activities/[id]/complete` — dedicated complete (uses module `CompleteActivity` use case).
  - `PATCH /api/activities/[id]/read` — marks **Instagram-message** activities as read by setting `completed=true`.
  - `GET /api/activities/unread`, `GET /api/activities/summary`.
  - Endpoints are manually documented in `src/app/api/docs/openapi.json/route.ts`.

#### 3. Status model — what exists today

- **There is NO `status` column or enum for activities.** The only state is the binary `completed BOOLEAN` + `completed_at` timestamp. The "lifecycle" today is exactly two states: created (`completed=false`) → completed (`completed=true`).
- **Semantic overload**: for `INSTAGRAM_MESSAGE` activities, `completed` means *read* (see `/read` route and `/unread` count); for everything else it means *done*. The `/activities` page and `/dashboard` "pending" list treat `completed` as done. Any richer status model MUST preserve the Instagram read semantics or explicitly decouple them.
- A status transition today touches: entity `completed/completedAt`, mapper, `database.types.ts` row, repository (`complete`/`update`), server action `toggleActivityCompletion`, the API `PATCH [id]` route, and the row-level `Checkbox` in `ActivityItem`.

#### 4. Existing patterns for status/management change in this repo

- **Ideas — the closest analog** (`src/modules/ideas/`): `IdeaStatus` enum (`BACKLOG, RESEARCHING, PLANNED, IN_PROGRESS, COMPLETED, ARCHIVED`) in `domain/enums/IdeaEnums.ts`; DB `ideas.status TEXT` + `CHECK`; repository verb `moveStatus(id, status)`; use case `MoveIdeaStatus` (existence check → `repo.moveStatus`); REST `PATCH /api/ideas/[id]/status` with `z.nativeEnum` validation (`src/app/api/ideas/[id]/status/route.ts`); kanban UI with `dnd-kit` (`IdeasBoard` `handleDragEnd` → `module.moveIdeaStatus.execute(...)`, optimistic Zustand update + revert on error via toast). The module factory (`src/modules/ideas/index.ts`) wires use cases to repositories for client-side callers.
- **Leads**: status is pipeline-stage driven (`updateStatus(id, stageName)`), `PATCH /api/leads/[id]/status` validates against stage names, writes a best-effort `audit_logs` row, and fires a non-blocking Instagram auto-DM on transition (`src/app/api/leads/[id]/status/route.ts`). `LeadWorkspace.handleStageChange` calls `leadRepo.updateStatus` directly from the client with optimistic state + revert.
- **Audit trail convention**: `src/modules/shared/infrastructure/actions/auditActions.ts` — `createAuditLog({ entityType: 'ACTIVITY'|'LEAD'|'IDEA', entityId, parentId, action: 'CREATE'|'UPDATE'|'DELETE', changes: { field: { old, new } } })`. Activity server actions (`src/modules/activities/infrastructure/actions/activityActions.ts`) already audit create/update/delete for activities; the leads status route audits status changes at the API layer. A status transition fits this same pattern.
- **DI conventions**: client components use `useActivityRepository()` from `src/ui/providers/RepositoryProvider.tsx` (presentation `ActivityItem`, `LeadActivitiesSection`); the `/activities` page uses server actions constructing the repository directly; ideas additionally use the module-factory pattern. There is **no Zustand store for activities** (only ideas/leads have one).
- **Known legacy residue**: the `/activities` page imports `@/modules/activities/components/ActivityItem` (legacy folder that renders `activity.description` and the old checkbox style), while the canonical component is `@/modules/activities/presentation/components/ActivityItem` (used by lead/idea timelines, renders `title`, DI-based completion via `repository.complete`). The archived `resolve-domain-duality` change migrated types but the route still points at the legacy component.

#### 5. UI surface — where status management would live

- `/activities` row (`src/modules/activities/components/ActivityItem.tsx`): checkbox toggle only. The row is the natural home for a status control (checkbox → complete/uncomplete; or a select/dropdown for multi-state). `ActivitiesList` already owns the `handleToggle` callback → a `handleStatusChange(id, status)` mirrors it.
- Filtering UX already supports `completed` and `type` — a status filter would extend URL params the same way.
- Per-row actions (edit/delete/status) are not present; no dropdown menu is used on this page today (shadcn `dropdown-menu.tsx` exists in `src/ui/components/` and is used elsewhere).

### Affected Areas

- `src/app/(dashboard)/activities/page.tsx` — filter logic (`completed` → status), title/copy, data fetch.
- `src/app/(dashboard)/activities/ActivitiesList.tsx` — status filter UI + row callback wiring.
- `src/app/(dashboard)/activities/actions.ts` — new/extended server action for status transitions.
- `src/modules/activities/components/ActivityItem.tsx` (or migration to `presentation/components/ActivityItem.tsx`) — status control per row.
- `src/modules/activities/domain/entities/Activity.ts` — new `status` field (or derived getters) + DTOs.
- `src/modules/activities/domain/repositories/ActivityRepository.ts` — new verb e.g. `changeStatus(id, status)`.
- `src/modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts` + `mappers/ActivityMapper.ts` + `schemas/ActivitySchema.ts` — persistence/mapping/validation.
- `src/infrastructure/database/database.types.ts` — row type for the new column.
- `supabase/migrations/<new>.sql` — add `status` column + CHECK + backfill + (optional) trigger.
- `src/app/api/activities/[id]/status/route.ts` (new) + `src/app/api/docs/openapi.json/route.ts` (docs convention) + optional `src/core/application/activities/ChangeActivityStatus.ts`.
- Server action `src/modules/activities/infrastructure/actions/activityActions.ts` — audit logging on transition (convention).
- Consumers of `completed` semantics: `/read` and `/unread` routes (Instagram), `dashboard/page.tsx` `getPending`, `LeadActivitiesSection`/`IdeaActivityFeed` timelines — regression surface.

### Approaches

1. **REST PATCH endpoint + domain use case (`MoveActivityStatus`) + repository verb — status column** (ideas-aligned)
   Migrate activities from binary `completed` to an enumerated status (`PENDING | IN_PROGRESS | COMPLETED`, DB `status TEXT` + CHECK, backfill `completed=true → COMPLETED`); domain enum + entity field; repo `changeStatus`; use case with existence check; REST `PATCH /api/activities/[id]/status` (zod nativeEnum) + server action for the page; audit log on transition; UI dropdown/checkbox per row wired like `IdeasBoard`/lead stage change.
   - Pros: consistent with `IdeaStatus`/leads precedent (enum + CHECK + moveStatus + status route); gives a real lifecycle the user asked for; additive to the domain; type-safe end to end; audit fits existing pattern; cleanly decouples Instagram "read" semantics if desired.
   - Cons: DB migration + backfill; touches every `completed` reference (mapper, types, filters, timelines, dashboard, Instagram read/unread); largest blast radius; needs careful handling of legacy Insight "read" semantics.
   - Effort: **High** (but mostly mechanical).

2. **Direct repository update on the existing `completed` flag** (minimal/keep-schema)
   Keep the binary model; treat "status transition" as completing/un-completing via a server action (extend `toggleActivityCompletion` with optimistic state + `revalidatePath`, add a status filter `Pendientes/Completadas` already partially present). No DB change; no new enum.
   - Pros: fastest; zero migration; zero regression risk on Instagram read semantics; satisfies the literal "created task → completed" case already partially exists.
   - Cons: does NOT deliver a true multi-state lifecycle (pending → in_progress → completed); status remains a boolean; overloaded "read" semantics stay; likely underdelivers the user's stated goal.
   - Effort: **Low**.

3. **Event-sourced state machine** (status_changes table / event stream + transition rules)
   Keep current columns and append a `activity_status_changes` history table; transition = insert event + derive current state; strict allowed-transition map in a domain service.
   - Pros: full audit/history; explicit transition rules; reversible.
   - Cons: no precedent in this codebase (ideas/leads mutate and log best-effort); over-engineered for a single-user CRM; adds query complexity; contradict existing conventions.
   - Effort: **High**.

### Recommendation

**Approach 1** — an enumerated `ActivityStatus` (`PENDING | IN_PROGRESS | COMPLETED`, matching the existing `IdeaStatus` pattern) persisted as a `status TEXT` column with a CHECK constraint (or a Postgres enum), exposed through a repository verb + use case + `PATCH /api/activities/[id]/status`, audited via `createAuditLog`, and surfaced on the `/activities` rows with a per-row status control plus a status filter. It follows the strongest in-repo precedent (ideas), delivers real transitions, and keeps the domain type-safe. Scope guardrails for the proposal: (a) decide explicitly how Instagram "read" interacts with status (recommend: keep `completed` semantics for INSTAGRAM_MESSAGE via the `/read` route, or move read-state to its own flag — must be a stated decision); (b) first implementation can ship with the two-state lifecycle the user described (PENDING → COMPLETED) and expose IN_PROGRESS later, minimizing migration risk; (c) keep `/activities` as a server page — extend the existing server action rather than introducing a client store.

### Risks

- **Migration**: new `status` column + CHECK/backfill from `completed`; safe with `ADD COLUMN ... DEFAULT` + `UPDATE` + `NOT NULL` phases; keep `completed` column in place during rollout to avoid breaking `/read`, `/unread`, `dashboard`, and timelines — or migrate them in the same change.
- **Instagram overload**: completing/reading semantics shared with `completed` today; unread badge counts `completed=false AND type=INSTAGRAM_MESSAGE`. Any decoupling changes badge behavior — needs an explicit decision and tests.
- **Legacy residue**: `/activities` page uses the legacy `modules/activities/components/ActivityItem` (renders `description`, not `title`); status UI should either fix it in place or migrate the page to `presentation/components/ActivityItem`.
- **Stale UI**: current toggle has no revalidate/optimistic update — the change should add both or the status UX will feel broken.
- **API docs convention**: new endpoints must be registered in `openapi.json/route.ts` (manual, by convention).
- **Test surface**: strict TDD — new repo verb, use case, route (mock `withAuth`/repo, following `complete-route.spec.ts` pattern), and component tests follow existing specs.

### Open Questions

- Does the user want a true multi-state lifecycle (`PENDING → IN_PROGRESS → COMPLETED`) or is "mark as completed / reopen" sufficient? (Recommend multi-state enum with two-state UI initially.)
- Should completing an activity remain available for Instagram messages, or should read-state move to its own column?
- Where should the transition live: server action only, REST route only, or both (ideas expose both — UI uses the use case directly, REST exists for API consumers)?
- Should transitions write an audit log (`createAuditLog`), matching activities' create/update/delete and the leads status route?

### Ready for Proposal

Yes. The exploration is complete and scope is well understood (see summary above and the 7 requested sections). The orchestrator should proceed to `sdd-propose` with Approach 1 (enumerated status + repository verb + status route + row-level UI) and confirm the two open questions above with the user.