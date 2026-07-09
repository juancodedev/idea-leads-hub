# Exploration: BaseRepository

## Current State

### Repositories Analyzed (7 total)

**Core infrastructure repos** (`src/infrastructure/repositories/`):
| File | Lines | Operations | Complexities |
|------|-------|-----------|--------------|
| `SupabaseLeadRepository.ts` | 158 | CRUD + `updateStatus` | Joins (lead_tags, notes), manual snake_case mapping in update |
| `SupabaseTagRepository.ts` | 104 | RUD + junction table ops | Catches PG code 23505 (unique violation) silently |
| `SupabasePipelineRepository.ts` | 172 | CRUD + nested stage CRUD + `reorderStages` | Join (stages), manual snake_case mapping in update |
| `SupabaseProfileRepository.ts` | 76 | Read, upsert + `uploadAvatar` | Storage (not DB) in `uploadAvatar` |
| `SupabaseNoteRepository.ts` | 75 | RUD + `getForEntity` | Dynamic column name based on entityType |

**Module repos** (`src/modules/*/infrastructure/repositories/`):
| File | Lines | Operations | Complexities |
|------|-------|-----------|--------------|
| `SupabaseIdeaRepository.ts` | 169 | CRUD + archive/restore/moveStatus + tag sync | Uses IdeaMapper (toDomain/toPersistence), nested tag sync on create/update |
| `SupabaseActivityRepository.ts` | 114 | CRUD + getForLead/getForIdea/getPending + complete | Uses ActivityMapper (toDomain/toPersistence) |

### Boilerplate Pattern (the exact repetition)

**1. Constructor — identical across all 7:**
```
constructor(private readonly supabase: SupabaseClient<Database>) {}
```
Two variants: typed (`SupabaseClient<Database>`) in core repos, untyped (`SupabaseClient`) in module repos.

**2. Error handling — identical and broken across all 7:**
```typescript
if (error) throw new Error(error.message);
```
Zero differentiation between 404, 401, 409, 500. Callers cannot distinguish "not found" from "server error" from "conflict". **No custom error classes exist anywhere in the codebase.**

**3. Auth injection — 4 inconsistent variants:**
- `getUser()` with `userError || !userData.user` check (LeadRepo, IdeaRepo, ActivityRepo)
- `getUser()` with only `!userData.user` check (TagRepo, PipelineRepo, NoteRepo)
- No auth injection at all — uses passed `id` (ProfileRepo)
- Error messages vary: `'Usuario no autenticado'` vs `'No autenticado'`

**4. Snake_case ↔ camelCase mapping — 3 approaches, zero code reuse:**
- **LeadRepo/PipelineStageRepo**: Manual `Record<string, unknown>` object building in `update()` — error-prone per-field logic
- **IdeaRepo/ActivityRepo**: Dedicated `IdeaMapper`/`ActivityMapper` with `toDomain()`/`toPersistence()` — cleaner, but per-module, no shared utility
- **TagRepo/ProfileRepo/NoteRepo**: Direct field mapping in private `mapToDomain()` — 5 duplicated implementations of the same pattern

**5. Typing gap:**
- Core repos use `SupabaseClient<Database>` — properly typed
- Module repos use bare `SupabaseClient` — lose type safety on queries
- Core repos define inline `type XRow = Database['public']['Tables']['x']['Row']` at the top of each file
- IdeaMapper/ActivityMapper import `database.types.ts` via `@/` path alias

### Key Finding: Two Groups Evolved Independently

The core repos and module repos were built at different times with different conventions. The module repos already have the better pattern (dedicated mappers), while the core repos inline everything.

## Affected Areas

| File | Impact |
|------|--------|
| `src/infrastructure/repositories/SupabaseLeadRepository.ts` | Primary consumer — heavy refactor to extend BaseRepository |
| `src/infrastructure/repositories/SupabaseTagRepository.ts` | Consumer — refactor, has special PG error handling |
| `src/infrastructure/repositories/SupabasePipelineRepository.ts` | Consumer — refactor, has two entity types (pipeline + stage) |
| `src/infrastructure/repositories/SupabaseProfileRepository.ts` | Consumer — refactor, has storage method (not DB) |
| `src/infrastructure/repositories/SupabaseNoteRepository.ts` | Consumer — refactor, dynamic column name |
| `src/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository.ts` | Consumer — refactor, uses IdeaMapper |
| `src/modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts` | Consumer — refactor, uses ActivityMapper |
| `src/infrastructure/repositories/BaseRepository.ts` | NEW — abstract base class |
| `src/infrastructure/repositories/errors.ts` | NEW — typed error classes |
| `src/infrastructure/repositories/mapper-utils.ts` | NEW — camelCase/snake_case utilities |
| `src/infrastructure/database/database.types.ts` | Already correct — provides `Database` type |

## Approaches

### 1. **BaseRepository class** — Abstract class with CRUD helpers and typed errors

Create `BaseRepository<TDomain, TRow>` with:
- Protected `supabase`, `tableName`, `requireUser()`
- Protected query helpers: `findAll()`, `findById()`, `create()`, `update()`, `delete()`, `execute()`
- `handleQueryError()` → maps Postgres error codes to typed errors (NotFoundError, ConflictError, UnauthorizedError, DatabaseError)
- Abstract `toDomain(row: TRow): TDomain` (subclass defines mapping)
- Optional `toPersistence(domain: Partial<TDomain>): Record<string, unknown>` for repos that need it

Subclass example:
```typescript
class SupabaseTagRepository extends BaseRepository<Tag, TagRow> implements TagRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'tags');
  }
  protected toDomain(row: TagRow): Tag { /* mapping */ }
  async getAll() { return this.findAll({ order: 'name' }); }
  async create(dto: CreateTagDTO) { return this.create(dto, { userId: true }); }
  // Junction methods still need their own implementation
}
```

| Pros | Cons |
|------|------|
| Eliminates ~70% boilerplate per repo | Inheritance is rigid — junction ops, storage ops, dynamic columns fight the base class |
| Single source for error handling and auth | Repos with joins need special handling (custom queries, not generic helpers) |
| Strong typing with Database generic | Module repos already have mappers — forcing `toDomain` adds friction |
| Testable in isolation | Changing the base class affects all subclasses |
| New repos are trivial to create | Higher upfront design cost to get the abstraction right |

**Effort: Medium** (2-3 days for design + migration)

### 2. **Composable utilities** — Extract standalone functions, keep per-repo classes

Create utility functions:
- `requireUser(supabase: SupabaseClient<Database>): User` — consistent auth
- `handleQueryError(error: PostgrestError): never` — throws typed errors
- `camelToSnake(obj: Record<string, unknown>): Record<string, unknown>`
- `snakeToCamel(obj: Record<string, unknown>): Record<string, unknown>`

Each repo keeps its class but calls utilities:
```typescript
async getAll(): Promise<Tag[]> {
  const { data, error } = await this.supabase.from('tags').select('*');
  handleQueryError(error);
  return (data ?? []).map(snakeToCamel);
}
```

| Pros | Cons |
|------|------|
| Flexible — no inheritance constraints | Doesn't eliminate the constructor or query structure |
| Easy incremental adoption (import where needed) | No shared `findAll`/`findById`/`create` helpers |
| Each function independently testable | Less opinionated — new repos can still diverge |
| Works well with existing mapper pattern | Less DRY than approach 1 — still repeats `from('table')` in every method |

**Effort: Low** (1 day for utilities, gradual adoption)

### 3. **Leave as-is**

| Pros | Cons |
|------|------|
| Zero risk | Error handling is broken for every method in every repo |
| No migration cost | Auth injection duplicated and inconsistent across 7 files |
| | Mapping logic duplicated ~15 times (mapToDomain × 5 + manual updates × 2) |
| | Every new repo copies the same boilerplate |
| | Module vs core divergence gets worse over time |

**Effort: Zero** (but accumulating debt)

## Recommendation

**Approach 1 (BaseRepository class)** — but with a pragmatic boundary.

The base class should NOT enforce `toDomain` as abstract. Instead:

```typescript
abstract class BaseRepository {
  constructor(
    protected readonly supabase: SupabaseClient<Database>,
    protected readonly tableName: string
  ) {}

  // Auth
  protected async requireUser(): Promise<User> { ... }

  // Error handling
  protected handleError(error: PostgrestError): never { ... }

  // CRUD helpers (return raw DB rows — subclass maps how it wants)
  protected async findAll<R>(config?: QueryConfig): Promise<R[]> { ... }
  protected async findById<R>(id: string): Promise<R | null> { ... }
  protected async createEntity<R>(data: Record<string, unknown>): Promise<R> { ... }
  protected async updateEntity<R>(id: string, data: Record<string, unknown>): Promise<R> { ... }
  protected async deleteEntity(id: string): Promise<void> { ... }
}
```

This way:
- **Core repos** keep their `mapToDomain` private methods (or migrate to mappers later)
- **Module repos** use the helpers but still delegate to IdeaMapper/ActivityMapper for the mapping
- **Junction operations** (TagRepo's `assignToEntity`) bypass helpers and use `this.supabase.from(...)` directly — no fighting the abstraction
- **ProfileRepo's `uploadAvatar`** stays as-is, no contortion

### Migration order

1. **Phase 1 (core)**: Create `BaseRepository`, `errors.ts`, `mapper-utils.ts`. Migrate LeadRepo, TagRepo, PipelineRepo. These have the most diversity and validate the abstraction.
2. **Phase 2 (core)**: Migrate ProfileRepo and NoteRepo (simpler, faster).
3. **Phase 3 (modules)**: Migrate IdeaRepo and ActivityRepo. These use mappers so the migration is mostly about replacing query boilerplate with helpers.

## Risks

| Risk | Mitigation |
|------|-----------|
| **Over-abstraction** — base class tries to do too much and breaks on edge cases (junction tables, storage, dynamic columns) | Keep base class minimal — only auth, error handling, and CRUD helpers. Everything non-standard stays in subclass. |
| **Module repos resist** — they already have their own mapper pattern and untyped `SupabaseClient` | The base class accepts `SupabaseClient<Database>` but helpers return raw data, preserving their mapper chain. They get typed errors without forcing a full refactor. |
| **Testing gap** — no existing repo tests means the migration has no safety net | Create tests for the base class + one representative repo (LeadRepo) as part of the migration. |
| **Join queries** — `findById` with joins needs different select patterns | Keep `findAll<R>` generic — it returns whatever the query returns. Joins are handled by the subclass building a custom query with `this.supabase.from(...)`. |
| **`as never` casts** — currently used in every insert/update to bypass type checking | New helpers should accept `Record<string, unknown>` and avoid the `as never` pattern entirely. |

## Ready for Proposal

**Yes.** The exploration is concrete enough to move to proposal. Key questions for the proposal phase:

1. How much of the CRUD boilerplate should `BaseRepository` encapsulate vs leave to subclasses?
2. Should the base class enforce `toDomain` as abstract, or be a concrete helper-only class?
3. Should we migrate all 7 repos in one change, or slice into smaller changes?
4. Should the mapper-utils (`camelToSnake`, `snakeToCamel`) be their own utility or live in BaseRepository?
