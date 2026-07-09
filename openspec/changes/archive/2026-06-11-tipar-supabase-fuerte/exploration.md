## Exploration: tipar-supabase-fuerte — Strong Typing for Supabase

### Current State

All 7 Supabase repository files and 2 mappers use `any` for database row types in their `mapToDomain`/`toDomain` methods and `toPersistence` helpers. There is no `database.types.ts` or any generated type definitions in the project.

The Supabase CLI (`supabase` v2.75.0) is installed but **logged into a different org** than the one owning this project (`xsqyftoblnsjkavhldcm`). The project cannot be linked or introspected with current credentials. No `supabase/config.toml` exists (only `migrations/` and a `.temp/` dir with stale state).

The schema exists as **17 SQL migration files** in `supabase/migrations/`. These are the authoritative schema source.

### Affected Areas — All `any` usages

#### Core Repositories (src/infrastructure/repositories/)
1. **`SupabaseLeadRepository.ts`** — `mapToDomain(row: any, entityTags?: any[], notesData?: any[])` (line 112), `dbUpdates: any` (line 58)
2. **`SupabaseTagRepository.ts`** — `mapToDomain(row: any)` (line 91), `row: any` inline (line 88)
3. **`SupabasePipelineRepository.ts`** — `mapPipelineToDomain(row: any, stagesRow?: any[])` (line 137), `mapStageToDomain(row: any)` (line 148), `dbUpdates: any` (line 102)
4. **`SupabaseProfileRepository.ts`** — `mapToDomain(row: any)` (line 60)
5. **`SupabaseNoteRepository.ts`** — `mapToDomain(row: any)` (line 61)

#### Module Repositories (src/modules/)
6. **`modules/ideas/infrastructure/repositories/SupabaseIdeaRepository.ts`** — delegates to `IdeaMapper.toDomain(data)` (type `any` inferred from query result)
7. **`modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts`** — delegates to `ActivityMapper.toDomain(data)` (same)

#### Mappers
8. **`modules/ideas/infrastructure/mappers/IdeaMapper.ts`** — `toDomain(row: any)` (line 5), `toPersistence(...): any` (line 28), `it: any` inline (line 18)
9. **`modules/activities/infrastructure/mappers/ActivityMapper.ts`** — `toDomain(row: any)` (line 5), `persistence: any` (line 24)

#### Database Clients (not `any` but will benefit from typed clients)
10. **`infrastructure/database/client.ts`** — `createBrowserClient(url, key)` returns untyped `SupabaseClient`
11. **`infrastructure/database/server.ts`** — same, `createServerClient(...)` returns untyped `SupabaseClient`

### Tables in Schema (from migrations)

| Table | Key Columns |
|-------|------------|
| `profiles` | id, full_name, avatar_url, company_name, job_title, phone, bio, website, updated_at |
| `leads` | id, user_id, name, company, email, phone, status, source, notes, pipeline_id, stage_id, created_at, updated_at |
| `ideas` | id, created_by, title, description, status, priority, potential_revenue, lead_id, archived_at, attachments(jsonb), created_at, updated_at |
| `activities` | id, user_id, lead_id, idea_id, type, title, description, due_date, completed, completed_at, attachments(jsonb), created_at, updated_at |
| `tags` | id, user_id, name, color, created_at |
| `lead_tags` | lead_id, tag_id, user_id |
| `idea_tags` | idea_id, tag_id, user_id |
| `pipelines` | id, user_id, name, description, created_at |
| `pipeline_stages` | id, pipeline_id, user_id, name, position, color, is_closed, is_won, created_at |
| `notes` | id, user_id, lead_id, idea_id, content, created_at, updated_at |
| `audit_logs` | id, entity_type, entity_id, parent_id, action, changes(jsonb), user_id, created_at |

### Approaches

#### 1. **`supabase gen types` CLI (ideal — but currently blocked)**

Generate `database.types.ts` from the remote project or local DB.

- **Pros**: One command, authoritative, includes PostgREST relationships, auto-generated, can be scripted in CI
- **Cons**: **Currently blocked** — CLI logged into different org, no service role key in `.env`, no DB password for `--db-url`, no local supabase instance. Must resolve auth first.
- **Unblocking effort**: Medium — either login to correct Supabase account, get service role key, or set up local Supabase with Docker + migrations
- **Effort**: Low (once unblocked) + Low (apply types to repos)

#### 2. **Manual types from migrations (always available, no deps)**

Hand-write `database.types.ts` with `Database` interface by reading the migration SQL.

- **Pros**: Zero external dependencies, no auth issues, full control, immediately doable
- **Cons**: Manual effort, must keep in sync with migrations, error-prone for complex schemas, no PostgREST relationship introspection
- **Effort**: Medium (type definition) + Low (apply to repos)
- **Maintenance**: Each new migration needs manual type update

#### 3. **Hybrid — Write types now, automate generation later**

Write types manually from migrations now. Add npm script for `supabase gen types` as future automation when auth is fixed.

- **Pros**: Immediate type safety, future automation path exists
- **Cons**: Two-step process, initial manual work may be partially redone
- **Effort**: Medium now + Low later
- **Best compromise**: No immediate blocker, clean upgrade path

#### 4. **Per-table inline types instead of global `Database` type**

Define `LeadRow`, `IdeaRow`, etc. as local interfaces near each repository.

- **Pros**: No global file, per-table granularity, easy to reason about
- **Cons**: Duplication, no shared source of truth, no relationship types, harder to maintain across repos
- **Effort**: Medium
- **Not recommended**: Violates DRY, no cross-table type relationships

### Recommendation

**Option 3 — Hybrid**: Write a manual `src/infrastructure/database/database.types.ts` now using the migration files as source of truth. This is immediately doable and unblocked.

**Why not wait for Option 1?** The CLI auth issue could take time to resolve (need to find the right Supabase account, get service role key, or set up local Docker). In the meantime, the `any` types are a code quality debt that grows with every new repository method.

**Migration to Option 1 later**: When the CLI access is resolved, add an npm script (`supabase:types`) that regenerates `database.types.ts`. The structure of a `supabase gen types` output is well-known — `Database['public']['Tables']['leads']['Row']` — so if we structure the manual types to match the same `Database` interface shape, migration to auto-generated is a drop-in replacement.

### Detailed Type Structure (recommended)

```typescript
// src/infrastructure/database/database.types.ts
export interface Database {
  public: {
    Tables: {
      leads: { Row: LeadRow; Insert: LeadInsert; Update: LeadUpdate };
      ideas: { Row: IdeaRow; Insert: IdeaInsert; Update: IdeaUpdate };
      // ... etc
    };
    Enums: {};
  };
}
```

Then in repositories:
```typescript
// Before: .from('leads') → any
// After:
import { Database } from '@/infrastructure/database/database.types';
type Db = Database['public']['Tables']['leads']['Row'];
```

And in database clients:
```typescript
import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(url, key);
}
```

### Database Client Impact

Both `client.ts` and `server.ts` use unparameterized `createBrowserClient` / `createServerClient`. Passing the `Database` generic parameter makes all `.from()` calls return typed rows automatically — this cascades type safety through every repository without changing mutation logic.

### Risks

1. **Schema drift** — Manual types may fall out of sync with actual DB schema if migrations are added but types aren't updated
2. **Relationship types** — PostgREST joins (`.select('*, lead_tags(tags(*))')`) return nested shapes that the generic `Database` type doesn't fully describe without additional effort (or `supabase gen types` which handles these)
3. **CLI auth still unsolved** — If/when someone needs to regenerate, the unblocking effort remains
4. **Mapper pattern** — Mappers still need to handle the typed row → domain entity transformation, which is a separate concern from DB typing
5. **Enum types** — `ideas.status` and `activities.type` are constrained with CHECK constraints, not native PG enums. The `Database` type should define these as string unions or manually.

### Ready for Proposal

**Yes** — ready for proposal. The hybrid approach (manual `database.types.ts` from migrations + typed Supabase clients + future automation path) is well-understood, unblocked, and follows the existing Clean Architecture pattern. The main work items are:

1. Write `src/infrastructure/database/database.types.ts` (from 17 migration files)
2. Type-generic the database clients (pass `<Database>` to `createBrowserClient` / `createServerClient`)
3. Update all 5 core repositories to use typed rows instead of `any`
4. Update the 2 module mappers to use typed rows instead of `any`
5. Add npm script for future `supabase gen types` (after auth is resolved)
