# Proposal: Update Kanban

## Intent

The kanban/board views have four gaps: (1) `CommandMenu` triggers a Radix a11y error (missing `DialogTitle`), (2) `/ideas` board drag-and-drop lacks cross-column reordering and `useSortable` on cards, (3) `/pipeline` has no inline lead management popup, forcing navigation away from the board, and (4) `/leads/[id]` doesn't display stored Instagram contact info.

## Scope

### In Scope
1. **♿ Accessibility** — Add `VisuallyHidden` `DialogTitle` to `CommandDialog` in `command.tsx`
2. **🔄 Ideas DnD parity** — Add `useSortable` to `IdeaCard`, `handleDragOver` to `IdeasBoard`, reorder within columns
3. **🃏 Lead popup** — Full slide-over/dialog on `/pipeline` for editing leads, changing status, notes, activity history
4. **📱 Instagram info** — Show `instagramHandle`, profile link, and scoped ID on `/leads/[id]` contact sidebar
5. **📋 Task plan** — Concrete implementation tasks for all 4 items above

### Out of Scope
- Extracting a shared Kanban abstraction (boards differ enough — dynamic stages vs fixed statuses)
- Instagram profile picture/bio fetching (not stored in Lead entity; needs separate Graph API integration)
- Bulk operations or keyboard navigation for DnD beyond existing @dnd-kit setup
- Error rollback for PipelineBoard DnD (no-rollback is pre-existing, out of scope for this change)

## Capabilities

### New Capabilities
- `lead-popup`: Inline lead management slide-over/dialog for pipeline board. Popup with editable fields, status change, notes, activity history.

### Modified Capabilities
- `visual-consistency`: Ideas board DnD behavior (cross-column drag, sortable cards) + Instagram info display on lead detail

## Approach

### 1. Accessibility (`command.tsx` line 31)
- Import `VisuallyHidden` from `@radix-ui/react-visually-hidden` or use `sr-only` utility
- Wrap `CommandDialog`'s `DialogContent` with a hidden `<DialogTitle>`: "Command Menu"
- Fix in the shared `command.tsx` wrapper, not in every consumer

### 2. Ideas DnD parity
- **`IdeaCard.tsx`**: Add `useSortable` hook — mirror `PipelineCard` pattern with `id`, `data.type: "Idea"`, drag indicator placeholder
- **`IdeasBoard.tsx`**: Add `handleDragOver` to detect cross-column movement during drag (same logic as PipelineBoard's `handleDragOver`). Add `SortableContext` wrapping each column's items (already exists in `IdeaColumn` but card IDs need to be in the SortableContext — they already are)
- **Persistence**: Already works via `MoveIdeaStatus` use case + optimistic update with rollback

### 3. Lead popup
- New component: `LeadPopup` as a sheet/dialog (Radix Dialog or shadcn Sheet)
- Embedded `LeadForm` fields (name, company, email, phone, etc.)
- Status/stage selector matching pipeline stages
- Inline `NoteForm` + `NoteTimeline` for notes
- `LeadActivitiesSection` for activity history
- Fetches lead data from `SupabaseLeadRepository` on open, persists via same repository
- Triggered by clicking a `PipelineCard` — new `onClick` prop on `PipelineCard`

### 4. Instagram link
- In `app/(dashboard)/leads/[id]/page.tsx` contact sidebar, add Instagram section after website:
  - Instagram icon + `@{instagramHandle}` link to `https://instagram.com/{instagramHandle}`
  - Show scoped ID as muted secondary info
  - Conditionally render only when `instagramHandle` exists

### 5. Task plan
- Hierarchical tasks per item, grouped by implementation order (1→2→3→4→5)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/components/command.tsx` | Modified | Add `DialogTitle` with `VisuallyHidden` |
| `src/modules/ideas/presentation/components/IdeaCard.tsx` | Modified | Add `useSortable` |
| `src/modules/ideas/presentation/components/IdeasBoard.tsx` | Modified | Add `handleDragOver` |
| `src/modules/leads/components/PipelineCard.tsx` | Modified | Add `onClick` prop |
| `src/modules/leads/components/PipelineBoard.tsx` | Modified | Wire card click → popup |
| `src/modules/leads/components/LeadPopup.tsx` | **New** | Full lead management popup |
| `app/(dashboard)/leads/[id]/page.tsx` | Modified | Instagram contact display |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LeadPopup overlaps with existing `/leads/[id]/edit` UX | Med | Keep popup as a quick-action overlay; full edit page remains primary |
| Ideas DnD reorder within column breaks existing drag-to-column | Low | `handleDragOver` only fires during drag, not on end — separate concerns |
| CommandMenu accessibility fix changes shadcn wrapper for all consumers | Low | `VisuallyHidden` has zero visual impact |

## Rollback Plan

- Revert `command.tsx`, `IdeaCard.tsx`, `IdeasBoard.tsx` changes individually per commit
- Delete `LeadPopup.tsx` and revert `PipelineCard`/`PipelineBoard` changes
- Revert `leads/[id]/page.tsx` Instagram section
- Each item is independently revertible via its own commit

## Dependencies

- `@radix-ui/react-visually-hidden` (already available in project via Radix UI deps)

## Success Criteria

- [ ] No Radix a11y warning for `DialogContent` without `DialogTitle` in console
- [ ] Ideas board: drag card vertically within column reorders, drag to another column changes status, persistence succeeds
- [ ] Pipeline: clicking a lead card opens a popup with editable fields, status/stage change, notes, and activity history
- [ ] `/leads/[id]` shows Instagram handle as clickable link when data exists
- [ ] All existing tests pass (`pnpm test`)
