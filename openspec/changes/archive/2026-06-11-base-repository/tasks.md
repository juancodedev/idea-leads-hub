# Tasks: BaseRepository

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 200–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + all 7 repo refactors | PR 1 | Single PR, base = main |

## Phase 1: Foundation — BaseRepository + errors.ts

- [x] 1.1 Create `src/infrastructure/repositories/errors.ts` — classes `NotFoundError`, `ConflictError`, `UnauthorizedError`, `DatabaseError` extending `Error` with `.name` override and optional `statusCode`
- [x] 1.2 Create `src/infrastructure/repositories/BaseRepository.ts` — concrete class with `constructor(supabase, tableName)`, `requireUser()` returning `string`, `handleError(error)` mapping PG codes (23505 → ConflictError, PGRST116 → NotFoundError, etc.), and CRUD helpers `findAll<T>`, `findById<T>`, `createEntity<T>`, `updateEntity<T>`, `deleteEntity`

## Phase 2: Core repos — Lead, Tag, Pipeline

- [x] 2.1 Refactor `SupabaseLeadRepository.ts` — extend `BaseRepository`, replace auth with `this.requireUser()`, replace error handling with `this.handleError()`, keep join queries (lead_tags, notes) and `updateStatus` using `this.supabase.from(...)` directly
- [x] 2.2 Refactor `SupabaseTagRepository.ts` — extend `BaseRepository`, replace auth/error handling, keep junction table ops (`assignToEntity`, `removeFromEntity`) and existing PG 23505 catch
- [x] 2.3 Refactor `SupabasePipelineRepository.ts` — extend `BaseRepository`, replace auth/error handling, keep nested stage CRUD (`createStage`, `updateStage`, `deleteStage`, `reorderStages`) using `this.supabase.from(...)` directly

## Phase 3: Core repos — Profile, Note

- [x] 3.1 Refactor `SupabaseProfileRepository.ts` — extend `BaseRepository`, replace error handling in `findByUserId`/`upsert`, keep `uploadAvatar` (storage method — not DB)
- [x] 3.2 Refactor `SupabaseNoteRepository.ts` — extend `BaseRepository`, replace auth/error handling, keep dynamic column name in `getForEntity` (passes `entity_type` and `entity_id` based on `entityType` param)

## Phase 4: Module repos — Idea, Activity

- [x] 4.1 Refactor `SupabaseIdeaRepository.ts` — extend `BaseRepository`, replace CRUD boilerplate with `this.findAll`/`this.findById`/`this.createEntity`/`this.updateEntity`/`this.deleteEntity`, retain `IdeaMapper` chain and tag sync logic
- [x] 4.2 Refactor `SupabaseActivityRepository.ts` — extend `BaseRepository`, replace CRUD boilerplate with helpers, retain `ActivityMapper` chain for `toDomain`/`toPersistence`

## Phase 5: Build & test verification

- [x] 5.1 Run `pnpm build` — fix type errors across all refactored repos (imports, `extends` clause, method signatures)
- [x] 5.2 Run `pnpm test` — fix regressions, confirm zero behavior changes (pure refactor — no new tests needed)
