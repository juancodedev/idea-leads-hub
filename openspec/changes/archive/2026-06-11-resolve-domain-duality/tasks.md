# Tasks: Resolve Domain Duality

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–150 (net: ~700 deleted, ~30 added) |
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
| 1 | Delete dead Idea files + core Activity files + migrate remaining 2 files | PR 1 | Single atomic PR, well under 400 lines |

## Phase 1: Delete Dead Idea Domain (safe — zero imports)

- [x] 1.1 Delete `src/modules/ideas/components/IdeaForm.tsx` — dead component, uses old core types
- [x] 1.2 Delete `src/modules/ideas/components/IdeasList.tsx` — dead component, uses old core types
- [x] 1.3 Delete `src/core/domain/schemas/IdeaSchema.ts` — old Zod schema, only imported by deleted IdeaForm
- [x] 1.4 Delete `src/core/domain/Idea.ts` — old domain type, only imported by deleted files + old infra repo
- [x] 1.5 Delete `src/core/ports/IdeaRepository.ts` — old port, only implemented by old infra repo
- [x] 1.6 Delete `src/infrastructure/repositories/SupabaseIdeaRepository.ts` — old infra repo, zero imports remain

## Phase 2: Migrate Activity (2 files change + delete 5 core files)

- [x] 2.1 Delete `src/core/domain/Activity.ts` — old domain type, only imported by old infra repo + old ActivityItem
- [x] 2.2 Delete `src/core/ports/ActivityRepository.ts` — old port, only implemented by old infra repo
- [x] 2.3 Delete `src/core/application/activities/CreateActivity.ts` — old use case, zero imports
- [x] 2.4 Delete `src/core/application/activities/GetPendingActivities.ts` — old use case, zero imports
- [x] 2.5 Delete `src/core/application/activities/ToggleActivityCompletion.ts` — old use case, zero imports
- [x] 2.6 Delete `src/core/application/activities/__tests__/ToggleActivityCompletion.test.ts` — tests old code being deleted; module already has `CompleteActivity` use case with its own tests
- [x] 2.7 Delete `src/infrastructure/repositories/SupabaseActivityRepository.ts` — old infra repo, page will switch to module repo
- [x] 2.8 Migrate `src/modules/activities/components/ActivityItem.tsx` — switch import from `@/core/domain/Activity` to `../../domain/entities/Activity`; update `iconMap` to use enum `ActivityType` values (`CALL, MEETING, FOLLOW_UP, EMAIL, TASK, NOTE, REMINDER, INVESTIGATION, ACTION`) instead of string literals (`'Email', 'Llamada', 'Reunión', 'Nota', 'Tarea'`)
- [x] 2.9 Migrate `src/app/(dashboard)/activities/page.tsx` — switch import to module `SupabaseActivityRepository` (`@/modules/activities/infrastructure/repositories/SupabaseActivityRepository`); replace `getAllPending()` with `supabase.auth.getUser()` + `getPending(user.id)` (same pattern as `dashboard/page.tsx`)

## Phase 3: Cleanup + Verification

- [x] 3.1 Remove empty `src/core/application/ideas/` directory
- [x] 3.2 Remove empty `src/core/application/activities/` directory (after deleting its contents)
- [x] 3.3 Remove empty `src/core/domain/schemas/` directory (after deleting IdeaSchema; verify `LeadSchema.ts` still exists — if so, move it to `src/core/domain/`)
- [x] 3.4 Run `npm run build` — verify zero type errors, zero import resolution failures
- [x] 3.5 Run `npm test` — verify existing tests pass (no regression from deleted test)
- [x] 3.6 Run `grep -r "core/domain/Idea\|core/domain/Activity" src/` — confirm zero remaining references
