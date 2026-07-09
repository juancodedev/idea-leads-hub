## Exploration: resolve-domain-duality — Domain Duality (Ideas & Activities)

### Current State

Ideas and Activities exist in TWO parallel versions across the codebase, creating type confusion, dead code, and potential runtime bugs.

#### Idea Duality

| Aspect | `core/domain/Idea.ts` (OLD) | `modules/ideas/domain/entities/Idea.ts` (LIVE) |
|--------|------|-------|
| Status type | String union: `'Borrador' \| 'Investigando' \| 'En Progreso' \| 'Validada' \| 'Descartada'` | Enum `IdeaStatus`: `BACKLOG, RESEARCHING, PLANNED, IN_PROGRESS, COMPLETED, ARCHIVED` |
| Priority type | `number` (1-5) | Enum `IdeaPriority`: `LOW, MEDIUM, HIGH, CRITICAL` |
| Dates | `string` (ISO) | `Date` objects |
| User ref | `userId: string` | `createdBy: string` |
| Tags | ❌ None | `tags?: Tag[]` (joined via `idea_tags`) |
| Attachments | ❌ None | `attachments?: IdeaAttachment[]` |
| Lead relation | ❌ None | `leadId?: string \| null` |
| Archive support | ❌ None | `archivedAt?: Date` |

#### Activity Duality

| Aspect | `core/domain/Activity.ts` (OLD) | `modules/activities/domain/entities/Activity.ts` (LIVE) |
|--------|------|-------|
| Type | String union: `'Email' \| 'Llamada' \| 'Reunión' \| 'Nota' \| 'Tarea'` | Enum `ActivityType`: `CALL, MEETING, FOLLOW_UP, EMAIL, TASK, NOTE, REMINDER, INVESTIGATION, ACTION` |
| Title | ❌ No title field | `title: string` (required) |
| Description | `description: string` (required) | `description?: string` (optional) |
| Idea relation | ❌ None | `ideaId?: string \| null` |
| Completion tracking | `completed: boolean` | `completed: boolean` + `completedAt?: Date` |
| Attachments | ❌ None | `attachments?: ActivityAttachment[]` |

### Affected Areas

#### DEAD CODE — Not imported by anything, safe to delete

- **`src/modules/ideas/components/IdeaForm.tsx`** — Uses OLD `core/domain/schemas/IdeaSchema` + OLD `infrastructure/repositories/SupabaseIdeaRepository`. Not imported anywhere.
- **`src/modules/ideas/components/IdeasList.tsx`** — Uses OLD `core/domain/Idea`. Not imported (IdeasView imports `presentation/components/IdeasList` instead).
- **`src/core/application/ideas/`** — Empty directory. No files.

#### CONFLICTED CODE — Imported but uses wrong types

- **`src/modules/activities/components/ActivityItem.tsx`** — **Imported by `activities/page.tsx`**. Uses OLD `core/domain/Activity` (no title, limited types). This is a runtime type mismatch waiting to happen.
- **`src/app/(dashboard)/activities/page.tsx`** — Uses OLD `infrastructure/repositories/SupabaseActivityRepository` (core version) + OLD `ActivityItem`. Should use module versions.

#### LIVE CODE — Module versions, fully functional

- **`src/modules/ideas/domain/`** — Entities, enums, repository interface (all live)
- **`src/modules/ideas/application/use-cases/`** — 5 use cases (CreateIdea, UpdateIdea, GetIdeas, MoveIdeaStatus, DeleteIdea)
- **`src/modules/ideas/infrastructure/`** — Module repo, mapper, zod schema, server actions
- **`src/modules/ideas/presentation/`** — Views, components, forms (all use module types)
- **`src/modules/ideas/store/`** — Zustand store (uses module types)
- **`src/modules/ideas/index.ts`** — Factory export
- **`src/modules/activities/domain/`** — Entities, enums, repository interface (all live)
- **`src/modules/activities/application/use-cases/`** — 2 use cases (CreateActivity, CompleteActivity)
- **`src/modules/activities/infrastructure/`** — Module repo, mapper, zod schema
- **`src/modules/activities/presentation/`** — Components, forms (all use module types)
- **`src/modules/activities/index.ts`** — Factory export

#### ORPHANED CORE FILES — Need cleanup after migration

- **`src/core/domain/Idea.ts`** — OLD types, only imported by `src/infrastructure/repositories/SupabaseIdeaRepository` (OLD infra) and the DEAD `IdeasList.tsx`
- **`src/core/domain/Activity.ts`** — OLD types, only imported by `src/infrastructure/repositories/SupabaseActivityRepository` (OLD infra) and the CONFLICTED `ActivityItem.tsx`
- **`src/core/ports/IdeaRepository.ts`** — 6 methods, only implemented by OLD infra
- **`src/core/ports/ActivityRepository.ts`** — 6 methods, only implemented by OLD infra
- **`src/core/domain/schemas/IdeaSchema.ts`** — OLD Zod schema (string unions, number priority)
- **`src/core/application/activities/`** — 3 use cases using core types (CreateActivity, GetPendingActivities, ToggleActivityCompletion) — NOT imported by any page
- **`src/infrastructure/repositories/SupabaseIdeaRepository.ts`** — OLD repo, uses core types, NOT imported by any page (all pages use module repo)
- **`src/infrastructure/repositories/SupabaseActivityRepository.ts`** — OLD repo, only imported by `activities/page.tsx` (which needs to switch to module repo)

#### PAGES IMPORTING DIRECTLY

| Page | Uses |
|------|------|
| `ideas/page.tsx` | Module repo (correct ✅) |
| `ideas/[id]/edit/page.tsx` | Module repo (correct ✅) |
| `ideas/new/page.tsx` | Module view (correct ✅) |
| `activities/page.tsx` | **OLD** infra repo (incorrect ❌) |
| `dashboard/page.tsx` | Module repos (correct ✅) |
| `leads/*` | Core domain only (not affected ✅) |

#### Leads — NOT Affected

- **`src/modules/leads/`** only has `components/` and `store/`. No domain entities, enums, or repositories. Uses `core/domain/Lead.ts` directly (single source of truth).
- **`src/core/domain/Lead.ts`**, **`core/ports/LeadRepository.ts`**, **`core/application/leads/`** — all clean, no duality.

### Approaches

#### 1. Merge into core/ — Move enriched models into core/

**Description**: Move the enriched module entities, enums, repository interfaces into `src/core/domain/` and `src/core/ports/`. Delete module-level duplicates. Keep module-level use cases, infrastructure, and presentation where they are.

**Pros**:
- Restores the intended clean architecture (core domain as single source of truth)
- Aligns with the existing Lead pattern
- Eliminates confusion about which types to use

**Cons**:
- Huge blast radius: every module file that imports entities from `modules/ideas/domain/` must change its import path
- Module organization loses self-containment
- All use cases, mappers, schemas, and presentation components need import updates
- The module `index.ts` exports (`export * from "./domain/entities/Idea"`) break for external consumers
- High risk of missing an import path

**Effort**: HIGH (15-20 files to update)

#### 2. Merge into modules/ — Clean up core/ ports and types, use module versions as source of truth

**Description**: Declare the module-level entities as the canonical types. Delete or deprecate core/ domain duplicates. Update the two remaining core imports (ActivityItem, activities/page.tsx) to use module types. Remove OLD infra repositories. Keep the module structure as-is.

**Pros**:
- Minimal changes (~6-8 files affected)
- The modules already have the richer, correct models
- Preserves module encapsulation (each module owns its domain)
- Low risk — most of the codebase already imports from module versions
- No import path changes needed for the vast majority of files

**Cons**:
- Leaves `src/core/domain/Idea.ts` and `src/core/domain/Activity.ts` as dead files that should be deleted (or marked deprecated)
- Breaks the "core domain as single source" architectural intent
- Core ports become useless if the entities they import are deleted
- The architectural story becomes muddled: "core/ exists but doesn't own domain types"

**Effort**: LOW (~6 files: delete OLD schemas/ports, fix 3 imports, delete OLD infra repos)

#### 3. Incremental — Fix one entity at a time

**Description**: First fix Idea (delete dead files, confirm nothing breaks), then fix Activity (migrate the page to module repo, fix ActivityItem import).

**Pros**:
- Safest approach, can validate each step
- Easy to roll back per-entity
- Can parallelize or pause between entities

**Cons**:
- Two separate cleanup passes with intermediate messy state
- The first pass (Idea) is almost entirely deleting dead code — minimal real impact
- The second pass (Activity) is the only one with actual behavioral change

**Effort**: LOW per entity, but two passes required — overall LOW/MEDIUM

### Recommendation

**Approach 2: Merge into modules/ (with cleanup)**

Here's the reasoning:

1. **The module versions are already the source of truth** — the data is flowing through module repos, module use cases, module schemas. The core types are dead letter for Ideas and effectively dead for Activities.
2. **Minimal risk** — only ~6 files need changes. The rest of the codebase already works correctly.
3. **Architectural purity is secondary** — you can layer a future cleanup that moves domain types to a shared package. For now, fixing the duality with minimum disruption is the pragmatic choice.

**Specific actions**:

| # | Action | Files |
|---|--------|-------|
| 1 | Delete DEAD files (Idea) | `src/modules/ideas/components/IdeaForm.tsx`, `src/modules/ideas/components/IdeasList.tsx`, `src/core/domain/schemas/IdeaSchema.ts`, `src/core/application/ideas/` (empty dir) |
| 2 | Delete OLD infra repos | `src/infrastructure/repositories/SupabaseIdeaRepository.ts`, `src/infrastructure/repositories/SupabaseActivityRepository.ts` |
| 3 | Fix Activity page | `activities/page.tsx` — switch to module repo import + module ActivityItem |
| 4 | Fix ActivityItem import | `src/modules/activities/components/ActivityItem.tsx` — switch to module `../../domain/entities/Activity` |
| 5 | Delete OLD core domain types | `src/core/domain/Idea.ts`, `src/core/domain/Activity.ts` |
| 6 | Delete OLD core ports | `src/core/ports/IdeaRepository.ts`, `src/core/ports/ActivityRepository.ts` |
| 7 | Delete OLD core use cases | `src/core/application/activities/CreateActivity.ts`, `GetPendingActivities.ts`, `ToggleActivityCompletion.ts` and their tests |
| 8 | Clean up core/domain/schemas | Either keep `LeadSchema.ts` or move it |

### Risks

- **`src/app/(dashboard)/activities/page.tsx`** currently uses the OLD infra repo `SupabaseActivityRepository`. Switching it to the module repo changes the returned type from core `Activity` (no title, 5 types) to module `Activity` (has title, 9 types, ideaId). The `ActivityItem` used on that page currently expects the core type — must be fixed in the same pass.
- **`src/modules/activities/components/ActivityItem.tsx` is imported by `activities/page.tsx`** — but `src/modules/activities/presentation/components/ActivityItem.tsx` is a SEPARATE component. Need to ensure the page imports the correct one after migration.
- **The OLD infra repos might be referenced in barrel imports** — check `src/infrastructure/repositories/index.ts` if exists.
- **No tests found for core/application/activities/** — verify they exist and are still relevant before deleting.

### Ready for Proposal

Yes. The exploration is complete and the scope is well understood. The duality is clear: module versions are live and complete, core versions are dead/orphaned with two exceptions (Activity page + ActivityItem). Approach 2 (merge into modules) is the recommended path with clear, low-risk actions.

The orchestrator should proceed to `sdd-propose` with the "merge into modules" approach.
