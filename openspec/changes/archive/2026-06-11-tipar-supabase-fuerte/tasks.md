# Tasks: Tipar Supabase Fuerte

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 200–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation — Type Definitions

- [x] 1.1 Create `src/infrastructure/database/database.types.ts` with `Database` interface covering all 11 business tables from migration SQL, structured as `Database.public.Tables.<table>.<Row|Insert|Update>`

## Phase 2: Database Clients

- [x] 2.1 Modify `src/infrastructure/database/client.ts` — import `Database` and pass `<Database>` generic to `createBrowserClient`
- [x] 2.2 Modify `src/infrastructure/database/server.ts` — import `Database` and pass `<Database>` generic to `createServerClient`
- [x] 2.3 Modify `src/infrastructure/database/supabase.ts` — import `Database` and pass `<Database>` generic to `createClient`

## Phase 3: Core Repositories

- [x] 3.1 Modify `src/infrastructure/repositories/SupabaseLeadRepository.ts` — replace `any` in `mapToDomain` params and `dbUpdates` with typed rows
- [x] 3.2 Modify `src/infrastructure/repositories/SupabaseTagRepository.ts` — replace `any` in `mapToDomain` param with typed row
- [x] 3.3 Modify `src/infrastructure/repositories/SupabasePipelineRepository.ts` — replace `any` in `mapPipelineToDomain`, `mapStageToDomain`, and `dbUpdates`
- [x] 3.4 Modify `src/infrastructure/repositories/SupabaseProfileRepository.ts` — replace `any` in `mapToDomain` param
- [x] 3.5 Modify `src/infrastructure/repositories/SupabaseNoteRepository.ts` — replace `any` in `mapToDomain` param

## Phase 4: Module Mappers

- [x] 4.1 Modify `src/modules/ideas/infrastructure/mappers/IdeaMapper.ts` — replace `any` in `toDomain` param, `toPersistence` return, and inline iteration
- [x] 4.2 Modify `src/modules/activities/infrastructure/mappers/ActivityMapper.ts` — replace `any` in `toDomain` param and `persistence` type

## Phase 5: Script & Verification

- [x] 5.1 Add `"supabase:types": "supabase gen types --lang=ts --linked > src/infrastructure/database/database.types.ts"` npm script to `package.json`
- [x] 5.2 Run `npx tsc --noEmit` and `pnpm test` — fix any type errors
