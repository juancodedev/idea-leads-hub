# Delta: Dependency Injection Infrastructure

## ADDED Requirements

### Requirement: RepositoryProvider

The system SHALL provide a `RepositoryProvider` component (React Context) that injects repository implementations into the component tree.

The provider SHALL accept a `repositories` prop typed as `Repositories` with keys: `lead` (LeadRepository), `note` (NoteRepository), `tag` (TagRepository), `pipeline` (PipelineRepository).

The provider SHALL render inside `src/app/layout.tsx`, wrapping children alongside existing `QueryProvider`.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Provider renders children | All 4 repository implementations provided | Provider renders with children | Children render without error |
| Missing repository at runtime | Provider with only `lead` repo | Hook for missing repo called | Error thrown: "useXRepository must be used within RepositoryProvider" |

### Requirement: Repository Hooks

The system SHALL expose 4 hooks: `useLeadRepository`, `useNoteRepository`, `useTagRepository`, `usePipelineRepository`.

Each hook SHALL consume `RepositoryContext` and return the corresponding repository instance.

Each hook SHALL throw if called outside `RepositoryProvider`.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Hook returns correct instance | Provider with mock repos | Hook called inside child | Returns same instance as provided |
| Hook throws outside provider | No provider rendered | Hook called | Error: "useLeadRepository must be used within RepositoryProvider" |

### Requirement: Module Factories

`leadModule()` in `src/modules/leads/index.ts` SHALL create Supabase client, instantiate `SupabaseLeadRepository`, and expose the repository.

`notesModule()` in `src/modules/shared/index.ts` SHALL create Supabase client, instantiate `SupabaseNoteRepository`, and expose the repository.

Existing factories (`ideaModule()`, `activitiesModule()`) SHALL remain unchanged.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| leadModule returns LeadRepository | `leadModule()` called | Repository used | Valid LeadRepository instance |
| notesModule returns NoteRepository | `notesModule()` called | Repository used | Valid NoteRepository instance |

### Requirement: Component Refactors — Leads (6)

Six lead components MUST replace `new XRepository(supabase)` with the corresponding hook.

| Component | Instancias | Hook reemplazo |
|-----------|-----------|----------------|
| PipelineBoard | 1 (LeadRepository) | `useLeadRepository()` |
| LeadPopup | 2 (LeadRepository, NoteRepository) | `useLeadRepository()`, `useNoteRepository()` |
| LeadForm | 1 (LeadRepository) | `useLeadRepository()` |
| LeadsTable | 2 (LeadRepository) | `useLeadRepository()` |
| LeadQuickView | 2 (TagRepository, NoteRepository) | `useTagRepository()`, `useNoteRepository()` |
| LeadWorkspace | 2 (TagRepository, NoteRepository) | `useTagRepository()`, `useNoteRepository()` |

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Component resolves via hook | Provider with mock repos | Each lead component renders | Repository resolved via hook, zero `new` calls |

### Requirement: Component Refactors — Ideas (4)

Four idea components MUST replace `new XRepository(supabase)` with the corresponding hook.

| Component | Instancias | Hook reemplazo |
|-----------|-----------|----------------|
| LeadSelector | 1 (LeadRepository) | `useLeadRepository()` |
| RelatedLeadCard | 1 (LeadRepository) | `useLeadRepository()` |
| TagSelector (ideas) | 1 (TagRepository) | `useTagRepository()` |
| TagsInput | 1 (TagRepository) | `useTagRepository()` |

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Component resolves via hook | Provider with mock repos | Each idea component renders | Repository resolved via hook, zero `new` calls |

### Requirement: Component Refactors — Shared (3)

Three shared components MUST replace `new XRepository(supabase)` with the corresponding hook.

| Component | Instancias | Hook reemplazo |
|-----------|-----------|----------------|
| NoteTimeline | 1 (NoteRepository) | `useNoteRepository()` |
| NoteForm | 1 (NoteRepository) | `useNoteRepository()` |
| TagSelector (shared) | 1 (TagRepository) | `useTagRepository()` |

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Component resolves via hook | Provider with mock repos | Each shared component renders | Repository resolved via hook, zero `new` calls |

### Requirement: Component Refactor — Activities (1)

`LeadActivitiesSection` MUST replace `new SupabaseActivityRepository(supabase)` with a hook.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Component resolves via hook | Provider with mock ActivityRepository | Component renders | Repository resolved via hook, zero `new` calls |

### Requirement: Manual Verification

PipelineBoard drag & drop SHALL work correctly after refactor. Form submission (leads, notes, tags) SHALL persist data to Supabase.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| PipelineBoard DnD | PipelineBoard renders with leads | User drags lead between columns | Lead stage updates correctly |
| Lead form saves data | LeadForm renders | User fills and submits form | Data persisted in Supabase |
| Note form saves data | NoteForm renders | User creates a note | Note persisted in Supabase |
| Tag selector works | TagSelector renders | User selects tags | Selection updates correctly |

### Requirement: Build and Test Integrity

After refactor, `pnpm build` MUST exit 0, `pnpm test` MUST exit 0. Zero `new XRepository(supabase)` SHALL remain in `src/modules/*/components/` and `src/modules/*/presentation/`.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Build passes | All refactors applied | `pnpm build` | Exit code 0 |
| Tests pass | All refactors applied | `pnpm test` | Exit code 0 |
| No residual `new` | Refactor complete | Grep for `new Supabase.*Repository(supabase)` in client-side modules | Zero matches |

### Requirement: Test Helper — renderWithProviders

The system SHALL provide `renderWithProviders` in test utilities that wraps children in `RepositoryProvider` with mock repositories.

The helper SHALL accept optional `repositories` override per key for custom test scenarios.

The helper SHALL return render result + `mocks` object with all mock repos.

| Escenario | GIVEN | WHEN | THEN |
|-----------|-------|------|------|
| Default mock render | Test component using `useLeadRepository()` | `renderWithProviders(<Component />)` | Renders without error, mock repo injected |
| Custom mock per test | Test needs `getAll` to return empty | `renderWithProviders(<Component />, {lead: {getAll: mockFn}})` | Component uses custom mock behavior |
