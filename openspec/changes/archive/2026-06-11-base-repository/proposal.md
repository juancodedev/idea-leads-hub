# Proposal: BaseRepository — Shared Repository Base Class

## Intent

Eliminate repeated boilerplate across all 7 Supabase repositories. Every repo duplicates constructor, error handling (all throw generic `Error`), auth injection (4 variants), and query structure. Extract a shared BaseRepository with typed errors, unified auth, and CRUD helpers.

## Scope

### In Scope
- Create `BaseRepository.ts` — concrete class with `findAll`, `findById`, `createEntity`, `updateEntity`, `deleteEntity`, `requireUser()`, `handleError()`
- Create `errors.ts` — `NotFoundError`, `ConflictError`, `UnauthorizedError`, `DatabaseError`
- Refactor all 5 core repos (Lead, Tag, Pipeline, Profile, Note) to extend BaseRepository
- Refactor both module repos (Idea, Activity) to use BaseRepository helpers while keeping their mapper chain
- Migration order: Phase 1 (Lead, Tag, Pipeline) → Phase 2 (Profile, Note) → Phase 3 (Idea, Activity)

### Out of Scope
- Mapper utilities (`camelToSnake`/`snakeToCamel`) — deferred
- Abstract `toDomain` enforcement — subclasses keep their own mapping
- Storage methods (ProfileRepo.uploadAvatar) — stays in subclass

## Capabilities

None — pure refactor, no spec-level behavior changes.

## Approach

Concrete `BaseRepository` (not abstract). Subclasses call helpers for CRUD, handle joins/junction/storage directly via `this.supabase.from(...)`, and keep their own mapping.

```
requireUser()            → unified auth
handleError(error)       → PG error codes → typed errors
findAll<T>(config?)      → generic find
findById<T>(id)          → find by PK
createEntity<T>(data)    → insert with created_by
updateEntity<T>(id,data) → update with updated_at
deleteEntity(id)         → delete by PK
```

## Affected Areas

| Area | Impact |
|------|--------|
| `src/infrastructure/repositories/BaseRepository.ts` | New |
| `src/infrastructure/repositories/errors.ts` | New |
| `src/infrastructure/repositories/SupabaseLeadRepository.ts` | Modified |
| `src/infrastructure/repositories/SupabaseTagRepository.ts` | Modified |
| `src/infrastructure/repositories/SupabasePipelineRepository.ts` | Modified |
| `src/infrastructure/repositories/SupabaseProfileRepository.ts` | Modified |
| `src/infrastructure/repositories/SupabaseNoteRepository.ts` | Modified |
| `src/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository.ts` | Modified |
| `src/modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Over-abstraction breaks on edge cases | Medium | Keep base class minimal — junction, storage, dynamic columns stay in subclasses |
| Module repos resist (untyped client + mappers) | Low | Helpers return raw rows, mappers stay intact |
| No existing tests = no safety net | Medium | Create tests for BaseRepository + LeadRepo |
| Base class changes cascade | Low | Well-defined API, future changes additive |

## Rollback Plan

Each repo refactor independently revertible via `git revert`. Phases are separable — if Phase 3 fails, Phases 1-2 stand alone. Base files can remain post-revert.

## Dependencies

None.

## Success Criteria

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] All 7 repos extend or use BaseRepository
- [ ] Zero `throw new Error` in repos for DB errors
- [ ] All 4 auth variants replaced by single `requireUser()` call
