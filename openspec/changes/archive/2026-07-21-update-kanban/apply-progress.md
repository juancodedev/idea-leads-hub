# Apply Progress: update-kanban

**Phase**: 4 — 📱 Instagram on `/leads/[id]`
**Mode**: Strict TDD (jest)
**Commit**: `feat(leads): add Instagram handle display to lead detail page`

## Completed Tasks — Phase 1 (A11y Fix)

- [x] **T1.1** Import `DialogTitle` from `@/ui/components/dialog` in `src/ui/components/command.tsx`
- [x] **T1.2** Add `<DialogTitle className="sr-only">Command Menu</DialogTitle>` as first child of `<DialogContent>` inside `CommandDialog`
- [x] **T1.3** **Verify**: test confirms DialogTitle renders with "Command Menu" text, Radix MissingDialogTitle warning is resolved

## Completed Tasks — Phase 2 (Ideas DnD Parity)

### Commit 1: `feat(ideas): add useSortable to IdeaCard`

- [x] **T2.1** Add `isOverlay?: boolean` prop to `IdeaCardProps`
- [x] **T2.2** Import `useSortable` from `@dnd-kit/sortable` and `CSS` from `@dnd-kit/utilities` in `IdeaCard.tsx`
- [x] **T2.3** Add `useSortable({ id: idea.id, data: { type: 'Idea', idea } })` and destructure `attributes`, `listeners`, `setNodeRef`, `transform`, `transition`, `isDragging`
- [x] **T2.4** Wrap card in a `<div ref={setNodeRef} style={transform/transition} {...attributes} {...listeners}>` — mirror `PipelineCard` pattern
- [x] **T2.5** Add drag placeholder: when `isDragging && !isOverlay`, render dashed border placeholder div instead of card
- [x] **T2.6** Add `isOverlay` styling to card wrapper (rotate-3 scale-105 shadow-xl when true)
- [x] **T2.7** Add/update tests for `IdeaCard` — verify `useSortable` renders with correct `data.type`, placeholder shows during drag

### Commit 2: `feat(ideas): add handleDragOver and arrayMove to IdeasBoard`

- [x] **T2.8** Import `DragOverEvent` from `@dnd-kit/core` in `IdeasBoard.tsx`
- [x] **T2.9** Import `arrayMove` from `@dnd-kit/sortable`
- [x] **T2.10** Add `handleDragOver` handler that detects cross-column movement
- [x] **T2.11** Wire `onDragOver={handleDragOver}` to `<DndContext>`
- [x] **T2.12** Add `arrayMove` to `handleDragEnd` for within-column reorder
- [x] **T2.13** Add/update tests: verify `handleDragOver` fires on cross-column, `arrayMove` on within-column, error rollback still works

## Completed Tasks — Phase 3 (Lead Popup Wiring)

- [x] **T3.13** Add optional `onClick?: (id: string) => void` prop to `PipelineCardProps` — wired to the card wrapper div's `onClick`
- [x] **T3.14** Add `onCardClick?: (id: string) => void` prop to `PipelineColumnProps` — passed through to `PipelineCard.onClick`
- [x] **T3.15** In `PipelineBoard`, added state `selectedLeadId` and derived `selectedLead`
- [x] **T3.16** On card `onClick`, set `selectedLeadId` — renders `LeadPopup` with lead data and stages
- [x] **T3.17** Handle `onLeadUpdated` callback: calls `updateLead(updated)` in store and closes popup
- [x] **T3.18** DnD handlers remain registered after popup open/close interaction
- [x] **T3.19** Integration tests: click PipelineCard → popup opens, save → store updated, close → popup dismissed

## Completed Tasks — Phase 4 (Instagram on /leads/[id])

- [x] **T4.1** Verified Instagram icon IS available in lucide-react 0.378.0 (confirmed via runtime — named export exists)
- [x] **T4.2** Added `Instagram` import from `lucide-react` in `page.tsx`
- [x] **T4.3** Added conditional Instagram section after website entry:
  - Renders only when `lead.instagramHandle` is truthy
  - Shows Instagram icon + `@{handle}` as clickable link to `https://instagram.com/{handle}`
  - Link: `target="_blank" rel="noopener noreferrer"`
  - Shows `lead.instagramScopedId` as muted secondary text when present
- [x] **T4.4** 9 tests covering: render with handle, link attributes (href/target/rel), scoped ID present/absent, no render on undefined/empty/null handle, order after website, icon next to handle

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/ui/components/command.tsx` | Modified | Added `DialogTitle` import and `<DialogTitle className="sr-only">` as first child of `<DialogContent>` |
| `src/ui/components/__tests__/command.spec.tsx` | Created | Unit test verifying sr-only DialogTitle renders with "Command Menu" text |
| `src/modules/ideas/presentation/components/IdeaCard.tsx` | Modified | Added `useSortable`, `isOverlay` prop, drag placeholder, `data-state` attribute, `isOverlay` styling |
| `src/modules/ideas/presentation/components/__tests__/IdeaCard.spec.tsx` | Created | Unit tests for useSortable rendering (6 tests) |
| `src/modules/ideas/presentation/components/IdeasBoard.tsx` | Modified | Added `DragOverEvent` import, `handleDragOver` handler, `onDragOver` wiring, `arrayMove` in `handleDragEnd`, `isOverlay` on DragOverlay card |
| `src/modules/ideas/presentation/components/__tests__/IdeasBoard.spec.tsx` | Created | Integration tests for DnD handlers (7 tests) |
| `src/modules/leads/components/PipelineCard.tsx` | Modified | Added `onClick` prop, wired to card wrapper div |
| `src/modules/leads/components/PipelineColumn.tsx` | Modified | Added `onCardClick` prop, passed through to PipelineCard |
| `src/modules/leads/components/PipelineBoard.tsx` | Modified | Added `LeadPopup` import, `selectedLeadId` state, `selectedLead` derived, `onCardClick` wiring, LeadPopup rendering with save/close handlers |
| `src/modules/leads/components/__tests__/PipelineBoard.spec.tsx` | Created | Integration tests for LeadPopup wiring (6 tests) |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Modified | Added Instagram import and conditional Instagram section after website entry in Contact sidebar |
| `src/app/(dashboard)/leads/[id]/__tests__/page.spec.tsx` | Created | Integration tests for Instagram section (9 tests) |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| T2.1–T2.7 | `src/modules/ideas/presentation/components/__tests__/IdeaCard.spec.tsx` | Unit | ✅ 41/41 suites, 223/223 tests | ✅ Written (6 tests) | ✅ Passed (6/6) | ✅ 5 test cases | ➖ None needed |
| T2.8–T2.13 | `src/modules/ideas/presentation/components/__tests__/IdeasBoard.spec.tsx` | Integration | ✅ 41/41 suites, 223/223 tests | ✅ Written (7 tests) | ✅ Passed (7/7) | ✅ 6 test cases | ➖ None needed |
| T3.13–T3.19 | `src/modules/leads/components/__tests__/PipelineBoard.spec.tsx` | Integration | ✅ 44/44 suites, 242/242 tests | ✅ Written (6 tests) | ✅ Passed (6/6) | ✅ 6 test cases: open + close + save + initial + multi-lead + DnD persistence | ➖ None needed |
| T4.1–T4.4 | `src/app/(dashboard)/leads/[id]/__tests__/page.spec.tsx` | Integration | ✅ 45/45 suites, 248/248 tests | ✅ Written (9 tests) | ✅ Passed (9/9) | ✅ 9 test cases: handle+icon, link attrs, scoped ID present, scoped ID absent, undefined handle, empty handle, null handle, order after website, icon+link proximity | ➖ None needed |

### Test Summary
- **Total tests written**: 34 (6 IdeaCard + 7 IdeasBoard + 6 LeadPopup + 6 PipelineBoard + 9 Instagram)
- **Total tests passing**: 257 (all phases)
- **Layers used**: Unit (6), Integration (28)
- **Approval tests** (refactoring): None — new code only
- **Pure functions created**: 0

## Deviations from Design

None — implementation matches design exactly.

## Issues Found

None.

## Remaining Tasks

All tasks complete. Ready for verify/archive.

## Workload / PR Boundary

- **Mode**: Single PR with `size:exception` (approved)
- **Current work unit**: Phase 4 — Instagram on `/leads/[id]`
- **Boundary**: This batch covers Phase 4 (Instagram section added to lead detail page)
- **Estimated review budget impact**: ~15 lines of new/modified production code + ~180 lines of test code
