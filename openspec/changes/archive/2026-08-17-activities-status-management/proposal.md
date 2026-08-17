# Proposal: Activities Status Management

## Intent

`/activities` rows only flip a binary `completed` flag — no lifecycle. Add an enumerated `ActivityStatus` (PENDING | IN_PROGRESS | COMPLETED) managed inline from the list, mirroring the Ideas module (`IdeaStatus` + DB CHECK, `repo.moveStatus`, `MoveIdeaStatus`, `PATCH .../status`, audit logging).

## Business Rules

- **BR-1** `ActivityStatus = PENDING | IN_PROGRESS | COMPLETED`, DB enum (column + CHECK) on `activities.status`.
- **BR-2** Free transitions: any status → any other. No transition map.
- **BR-3** Read/completed decoupled: `INSTAGRAM_MESSAGE` read moves to its own marker. Status transitions MUST NOT affect read; read MUST NOT affect status/`completed`.
- **BR-4** Migration: backfill `completed=true → COMPLETED`; Instagram read backfilled from `completed`. Keep `completed` column during rollout, dual-writing it (derived: `status=COMPLETED`) so `/read`, `/unread`, dashboard, timelines keep working. Column drop deferred.
- **BR-5** Transitions only for owner (RLS).
- **BR-6** COMPLETED entry sets `completed_at`; leaving clears it.

## Scope

**In**: migration (`status`+`read` columns, enum/CHECK, backfill, keep + dual-write `completed`); domain (`ActivityStatus` enum, entity/DTOs with `status`/`read`, repo `moveStatus` + `read`/`unread`, `MoveActivityStatus` use case); REST (`PATCH /api/activities/[id]/status`, migrate `/read` + `/unread` to read marker, OpenAPI docs); `/activities` UI (per-row status control, status filter, optimistic update + `revalidatePath` + toast); audit log on transitions; tests (TDD).

**Out**: dropping `completed` column (follow-up); detail/edit page; bulk actions; kanban; status history/event sourcing.

## Capabilities

> Contract for sdd-spec. No activities spec exists; REST lives in `api-rest`.

- **New** `activity-status`: status lifecycle — enum, free transitions, read/completed decoupling, repo/use-case/REST surface, row-level UI + filter.
- **Modified** `api-rest`: add `PATCH /api/activities/[id]/status`; `/read` + `/unread` use read marker; `PATCH [id]` drops `completed` write path.

## Approach

Mirror ideas: (1) `ActivityStatus` enum in `src/modules/activities/domain/enums/`; (2) migration adds `status` + `read`, CHECK, backfill, keeps + dual-writes `completed`; (3) repo verbs `moveStatus`/`read`/`unread` + mapper + `database.types.ts`; (4) `MoveActivityStatus` use case (existence check → `moveStatus`); (5) `PATCH /api/activities/[id]/status` + server action `changeActivityStatus` + `createAuditLog` per transition + OpenAPI docs; (6) UI: per-row control in `ActivityItem`, `ActivitiesList` handler + URL-param filter, optimistic update + revert + `revalidatePath`.

## Affected Areas

| Area | Impact |
|------|--------|
| `supabase/migrations/<new>.sql` | New |
| `src/modules/activities/{domain,application/use-cases/MoveActivityStatus.ts}` | New/Mod |
| `src/modules/activities/infrastructure/{repositories,mappers,actions}` | Modified |
| `src/app/api/activities/[id]/status` (new), `/read`, `/unread` | New/Mod |
| `src/app/(dashboard)/activities/*`, `ActivityItem` | Modified |
| Dashboard `getPending` / timelines | Regression |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Instagram read/badge regressions | Med | Read marker + tests |
| Binary-`completed` consumers | Med | Dual-write + keep column |
| Legacy `ActivityItem` residue | Med | Fix in place or migrate to `presentation/` |
| Stale UI after transition | Med | Optimistic + revalidate + toast |
| OpenAPI drift | Low | Update in same change |

## Rollback Plan

Low-risk: `completed` kept + dual-written, so rollback = revert code only (rows already carry both `status` and legacy `completed`). Full revert: stop writing `status`, restore binary sync, drop `status`/`read` in a follow-up migration.

## Dependencies

None external. Manual OpenAPI docs; follow `complete-route.spec.ts` test pattern.

## Success Criteria

- [ ] Rows expose working status control; transitions persist on reload.
- [ ] Free transitions for all types incl. `INSTAGRAM_MESSAGE` without touching read.
- [ ] `/read`, `/unread`, badge use read marker; completing ≠ read and vice versa.
- [ ] Dashboard "pendientes" and timelines unaffected.
- [ ] `pnpm test`, `tsc --noEmit`, lint green.

## Open Questions

- Default filter "Pendientes" = `status ≠ COMPLETED`, replacing `completed` checkbox? (Assumed yes.)
- Read marker shape (`read` + `read_at` vs single flag) — design detail.