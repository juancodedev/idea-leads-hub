# Proposal: Resolve Domain Duality (Ideas & Activities)

## Intent

Ideas and Activities exist in two parallel domain models — one in `core/` (old, stale) and one in `modules/` (live, enriched). This creates type confusion, dead code, and risk of runtime bugs from stale types. This refactor eliminates the duality with zero behavioral change.

## Scope

### In Scope
- Delete dead `core/` domain types, ports, schemas, and application use cases for Ideas + Activities
- Delete orphaned infra repositories (old Supabase versions)
- Delete dead components referencing core types
- Migrate `activities/page.tsx` and `ActivityItem.tsx` from core types to module types
- Clean up empty directories

### Out of Scope
- Leads domain (single source of truth, no duality — untouched)
- Architectural restructuring (moving types between layers)
- Any behavioral or spec-level change

## Capabilities

### New Capabilities
None — pure refactor, no new specs needed.

### Modified Capabilities
None — no requirements or behaviors change.

## Approach

Merge into modules/ (Approach 2 from exploration). Module entities, enums, and repos are already the live source of truth. Delete dead core/ duplicates and migrate the 2 remaining files that reference core types.

| # | Action | Files |
|---|--------|-------|
| 1 | Delete dead Idea components | `src/modules/ideas/components/{IdeaForm.tsx,IdeasList.tsx}` |
| 2 | Delete OLD core domain types | `src/core/domain/{Idea.ts,Activity.ts}` |
| 3 | Delete OLD core ports | `src/core/ports/{IdeaRepository.ts,ActivityRepository.ts}` |
| 4 | Delete OLD core schema | `src/core/domain/schemas/IdeaSchema.ts` |
| 5 | Delete OLD core use cases | `src/core/application/activities/*.ts` (3 files) |
| 6 | Delete OLD infra repos | `src/infrastructure/repositories/{SupabaseIdeaRepository.ts,SupabaseActivityRepository.ts}` |
| 7 | Migrate ActivityItem | Switch import to `modules/activities/domain/entities/Activity` |
| 8 | Migrate activities/page | Switch to module repo + module ActivityItem |
| 9 | Clean empty dirs | `core/application/ideas/`, `core/domain/schemas/` (if LeadSchema handled) |

## Affected Areas

| Area | Status |
|------|--------|
| `src/core/domain/Idea.ts` | Deleted |
| `src/core/domain/Activity.ts` | Deleted |
| `src/core/ports/IdeaRepository.ts` | Deleted |
| `src/core/ports/ActivityRepository.ts` | Deleted |
| `src/core/domain/schemas/IdeaSchema.ts` | Deleted |
| `src/core/application/activities/*.ts` (3 files) | Deleted |
| `src/infrastructure/repositories/SupabaseIdeaRepository.ts` | Deleted |
| `src/infrastructure/repositories/SupabaseActivityRepository.ts` | Deleted |
| `src/modules/ideas/components/IdeaForm.tsx` | Deleted |
| `src/modules/ideas/components/IdeasList.tsx` | Deleted |
| `src/modules/activities/components/ActivityItem.tsx` | Migrated |
| `src/app/(dashboard)/activities/page.tsx` | Migrated |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Activity page breaks if ActivityItem + infra switch aren't atomic | Low | Migrate both in same commit, verify together |
| Barrel exports reference orphaned files | Low | Check `src/infrastructure/repositories/index.ts` and `src/core/domain/index.ts` before each delete |
| OLD core app use cases have tests that expect core types | Low | Check `core/application/activities/__tests__/` before deleting; migrate test imports if found |

## Rollback Plan

Each file deletion is independently revertible via `git restore <path>`. The two migration changes (ActivityItem + page) are the only non-trivial scope — revert both together if the activities page fails to render. Full revert: `git checkout HEAD~1 -- <paths>`.

## Dependencies

None.

## Success Criteria

- [ ] No remaining imports of `core/domain/Idea` or `core/domain/Activity` in `src/`
- [ ] `npm run build` succeeds
- [ ] All existing tests pass
- [ ] Activities page loads and renders with correct types
