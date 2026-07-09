# Proposal: Tipar Supabase Fuerte

## Intent

Eliminate all `any` usages for Supabase DB row types across repositories, mappers, and database clients by introducing a shared typed `Database` interface. Pure refactor — zero behavioral changes.

## Scope

### In Scope
- Write `src/infrastructure/database/database.types.ts` from 17 migration files (shape: `Database.public.Tables`)
- Pass `<Database>` generic to all 3 database clients (`client.ts`, `server.ts`, `supabase.ts`)
- Replace `any` row types in 5 core repositories + 2 module mappers
- Add `supabase:types` npm script for future `supabase gen types` automation

### Out of Scope
- PostgREST relationship types for joins (deferred — `supabase gen types` handles these)
- Enum types for CHECK constraints (string unions in types, not native PG enums)
- Mapper domain entity refactors (type changes stop at DB row boundary)
- Resolving Supabase CLI auth to unblock auto-generation

## Capabilities

### New Capabilities
None — pure refactor, no new spec-level behavior.

### Modified Capabilities
None — requirements don't change, only implementation types tighten.

## Approach

**Hybrid manual typing** — write `database.types.ts` by hand from migration files, structured as the `Database` interface that `supabase gen types` would produce. This makes future auto-generation a drop-in replacement.

All `.from('table')` calls become typed once the client carries `SupabaseClient<Database>`. Repositories receive typed row params; mappers accept typed rows and return domain entities. No `any` remains for DB types.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/infrastructure/database/database.types.ts` | **New** | Manual types for all 11 tables from migration SQL |
| `src/infrastructure/database/client.ts` | Modified | Pass `<Database>` to `createBrowserClient` |
| `src/infrastructure/database/server.ts` | Modified | Pass `<Database>` to `createServerClient` |
| `src/infrastructure/database/supabase.ts` | Modified | Pass `<Database>` to `createClient` |
| `src/infrastructure/repositories/SupabaseLeadRepository.ts` | Modified | Typed `mapToDomain`, `dbUpdates` |
| `src/infrastructure/repositories/SupabaseTagRepository.ts` | Modified | Typed `mapToDomain` |
| `src/infrastructure/repositories/SupabasePipelineRepository.ts` | Modified | Typed `mapPipelineToDomain`, `dbUpdates` |
| `src/infrastructure/repositories/SupabaseProfileRepository.ts` | Modified | Typed `mapToDomain` |
| `src/infrastructure/repositories/SupabaseNoteRepository.ts` | Modified | Typed `mapToDomain` |
| `src/modules/ideas/infrastructure/mappers/IdeaMapper.ts` | Modified | Typed `toDomain`, `toPersistence` |
| `src/modules/activities/infrastructure/mappers/ActivityMapper.ts` | Modified | Typed `toDomain`, `toPersistence` |
| `package.json` | Modified | Add `supabase:types` npm script |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Schema drift — types out of sync with new migrations | Medium | `supabase:types` npm script for quick regen once CLI auth is fixed; manual update discipline |
| Incomplete type coverage for nullable/optional columns | Low | Review all 17 migrations for `NOT NULL`, defaults, and nullable columns |
| Module repos import path resolution to `@/infrastructure/...` | Low | Verify tsconfig paths — existing code already uses `@/` convention |

## Rollback Plan

Each file change is independently revertible via `git checkout <file>`. The `database.types.ts` file can be deleted with no runtime impact (reverts to untyped `any`). If build breaks, the entire change reverts by reverting the single commit or PR.

## Dependencies

- TypeScript compiler (`tsc` / `next build`) validates all type changes
- `@supabase/supabase-js` and `@supabase/ssr` already in `package.json` — no new deps

## Success Criteria

- [ ] `npm run build` passes with no type errors
- [ ] `npm test` passes with no regressions
- [ ] Zero `any` usages for DB row types across all repositories and mappers
- [ ] All 3 database clients pass `SupabaseClient<Database>` generic
- [ ] `npm run supabase:types` script exists (placeholder until CLI auth is resolved)
