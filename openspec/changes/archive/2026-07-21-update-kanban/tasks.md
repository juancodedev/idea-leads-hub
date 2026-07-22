# Tasks: Update Kanban

**Change**: `update-kanban`
**Phase**: tasks
**Scope**: 5 items — Accessibility, Ideas DnD Parity, Lead Popup, Instagram Link, Task Plan

---

## Phase 1: ♿ A11y Fix — `DialogTitle` in `CommandDialog`

### Commit: `fix(a11y): add sr-only DialogTitle to CommandDialog`

- [x] **T1.1** Import `DialogTitle` from `@/ui/components/dialog` in `src/ui/components/command.tsx` (~2 min)
- [x] **T1.2** Add `<DialogTitle className="sr-only">Command Menu</DialogTitle>` as first child of `<DialogContent>` inside `CommandDialog` (~2 min)
- [x] **T1.3** **Verify**: open CommandDialog in browser, confirm no "MissingDialogTitle" Radix a11y warning in console (~2 min)

**Files**: `src/ui/components/command.tsx` (+1 import, +1 JSX tag)
**Tests**: None needed (pure markup, covered by existing rendering)

---

## Phase 2: 🔄 Ideas DnD Parity

### Commit 1: `feat(ideas): add useSortable to IdeaCard`

- [x] **T2.1** Add `isOverlay?: boolean` prop to `IdeaCardProps` (~2 min)
- [x] **T2.2** Import `useSortable` from `@dnd-kit/sortable` and `CSS` from `@dnd-kit/utilities` in `IdeaCard.tsx` (~1 min)
- [x] **T2.3** Add `useSortable({ id: idea.id, data: { type: 'Idea', idea } })` and destructure `attributes`, `listeners`, `setNodeRef`, `transform`, `transition`, `isDragging` (~3 min)
- [x] **T2.4** Wrap card in a `<div ref={setNodeRef} style={transform/transition} {...attributes} {...listeners}>` — mirror `PipelineCard` pattern (~5 min)
- [x] **T2.5** Add drag placeholder: when `isDragging && !isOverlay`, render dashed border placeholder div instead of card (~5 min)
- [x] **T2.6** Add `isOverlay` styling to card wrapper (rotate-3 scale-105 shadow-xl when true) (~3 min)
- [x] **T2.7** Add/update tests for `IdeaCard` — verify `useSortable` renders with correct `data.type`, placeholder shows during drag (~15 min)

**Files**: `src/modules/ideas/presentation/components/IdeaCard.tsx`
**Tests**: `src/modules/ideas/presentation/components/__tests__/IdeaCard.spec.tsx` (create/update)

### Commit 2: `feat(ideas): add handleDragOver and arrayMove to IdeasBoard`

- [x] **T2.8** Import `DragOverEvent` from `@dnd-kit/core` in `IdeasBoard.tsx` (~1 min)
- [x] **T2.9** Import `arrayMove` from `@dnd-kit/sortable` (~1 min)
- [x] **T2.10** Add `handleDragOver` handler that detects cross-column movement:
  - Guard: `activeId !== overId`, `active.data.type === 'Idea'`, detect target column status
  - Only update store when `activeIdea.status !== newStatus` (avoid redundant renders)
  - Call `updateIdea({ ...idea, status: newStatus })` optimistically (~15 min)
- [x] **T2.11** Wire `onDragOver={handleDragOver}` to `<DndContext>` (~1 min)
- [x] **T2.12** Add `arrayMove` to `handleDragEnd` for within-column reorder: on drop inside same column, reorder items via arrayMove and persist position order (~8 min)
- [x] **T2.13** Add/update tests: verify `handleDragOver` fires on cross-column, `arrayMove` on within-column, error rollback still works (~20 min)

**Files**: `src/modules/ideas/presentation/components/IdeasBoard.tsx`
**Tests**: `src/modules/ideas/presentation/components/__tests__/IdeasBoard.spec.tsx` (create/update)

---

## Phase 3: 🃏 Lead Popup

### Commit 1: `feat(leads): create LeadPopup Sheet component`

- [ ] **T3.1** Create `src/modules/leads/components/LeadPopup.tsx` as `"use client"` component (~3 min)
- [ ] **T3.2** Define `LeadPopupProps` interface: `lead: Lead`, `stages: PipelineStage[]`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onLeadUpdated?: (lead: Lead) => void` (~3 min)
- [ ] **T3.3** Set up Sheet (right side, `sm:max-w-2xl`) with `SheetHeader` + `SheetTitle` showing lead name (~5 min)
- [ ] **T3.4** Wire `react-hook-form` with `zodResolver(LeadSchema)` — reuse fields: name, company, email, phone, address, website. Default values from `lead` prop (~15 min)
- [ ] **T3.5** Add stage selector using shadcn `Select` populated from `stages` prop — show stage name, call `onValueChange` on select (~8 min)
- [ ] **T3.6** Add Notes section with heading, `NoteForm(entityId=lead.id, entityType='lead')`, and `NoteTimeline` — manage notes state locally, refresh on create/delete (~15 min)
- [ ] **T3.7** Add Activity section heading + `<LeadActivitiesSection leadId={lead.id} />` (~5 min)
- [ ] **T3.8** Add "Guardar" button that calls `SupabaseLeadRepository.update`, then `updateLead` in store, then `onLeadUpdated` callback + toast + close popup on success (~15 min)
- [ ] **T3.9** Add "Cancelar" button that calls `onOpenChange(false)` without persisting (~2 min)
- [ ] **T3.10** Handle save error: toast.error, keep form open with user's edits (~3 min)
- [ ] **T3.11** Handle loading state: `isSubmitting` disables Save button, shows Loader2 spinner (~3 min)
- [ ] **T3.12** Write tests: render popup with lead data, edit field and save, cancel without saving, save error shows toast, empty notes state (~30 min)

**Files**: `src/modules/leads/components/LeadPopup.tsx` **(NEW)**
**Tests**: `src/modules/leads/components/__tests__/LeadPopup.spec.tsx` (create)

### Commit 2: `feat(leads): wire LeadPopup into PipelineBoard`

- [x] **T3.13** Add optional `onClick?: (id: string) => void` prop to `PipelineCardProps` — wire to the card wrapper div's `onClick` (~3 min)
- [x] **T3.14** Add `onCardClick?: (id: string) => void` prop to `PipelineColumnProps` — pass through to `PipelineCard.onClick` (~3 min)
- [x] **T3.15** In `PipelineBoard`, add state: `const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)` and derived `const selectedLead = leads.find(l => l.id === selectedLeadId)` (~3 min)
- [x] **T3.16** On card `onClick`, set `selectedLeadId` — render `<LeadPopup lead={selectedLead} stages={stages} open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLeadId(null)} />` (~8 min)
- [x] **T3.17** Handle `onLeadUpdated` callback: update store + PipelineCard reflects changes (~3 min)
- [x] **T3.18** Verify DnD still works when popup opens/closes — drag state and popup are independent (~5 min)

- [x] **T3.19** Write integration tests: click PipelineCard → popup opens, save → store updated, close → popup dismissed (~15 min)
**Files**:
- `src/modules/leads/components/PipelineCard.tsx`
- `src/modules/leads/components/PipelineColumn.tsx`
- `src/modules/leads/components/PipelineBoard.tsx`

---

## Phase 4: 📱 Instagram on `/leads/[id]`

### Commit: `feat(leads): add Instagram handle display to lead detail page`

- [x] **T4.1** Verify Instagram icon availability: `lucide-react` is at `0.378.0` — `Instagram` IS available (confirmed via runtime check). Import directly. (~3 min)
- [x] **T4.2** Add Instagram icon import (from `lucide-react`) in `src/app/(dashboard)/leads/[id]/page.tsx` (~1 min)
- [x] **T4.3** Add conditional section **after** the website entry in the Contact sidebar:
  - Only render when `lead.instagramHandle` is truthy
  - Display Instagram icon + `@{handle}` as clickable link → `https://instagram.com/{handle}`
  - Link: `target="_blank" rel="noopener noreferrer"`
  - Below the link, show `lead.instagramScopedId` as muted secondary text (only when present) (~15 min)
- [x] **T4.4** Update tests: verify Instagram section renders with handle, does not render without handle, handles missing scoped ID, link has correct attributes (~15 min)

**Files**: `src/app/(dashboard)/leads/[id]/page.tsx`
**Tests**: Existing leads detail page tests (extend with Instagram cases)

---

## Review Workload Forecast

| Scope Item | Core | Tests | Total |
|---|---|---|---|
| ♿ A11y (CommandDialog) | ~5 | — | ~5 |
| 🔄 Ideas DnD (IdeaCard) | ~55 | ~25 | ~80 |
| 🔄 Ideas DnD (IdeasBoard) | ~30 | ~30 | ~60 |
| 🃏 Lead Popup (component) | ~160 | ~35 | ~195 |
| 🃏 Lead Popup (wiring) | ~25 | ~20 | ~45 |
| 📱 Instagram (/leads/[id]) | ~20 | ~15 | ~35 |
| **Total estimated changed lines** | **~295** | **~125** | **~420** |

- Budget: 800 lines
- Estimated total: ~420 lines (**under budget**)
- **400-line threshold**: Exceeded (~420 lines with tests)
- **Delivery strategy**: `ask-on-risk` — orchestrator must decide
- **Chained PRs recommended**: Yes — split into 2 chains:
  - **Chain 1**: A11y + Ideas DnD (~145 lines) — smallest slice, independently reviewable
  - **Chain 2**: Lead Popup + Instagram (~275 lines) — larger slice, popup is the bulk
- **Decision needed before apply**: Yes — orchestrator must confirm chained PR strategy or accept single PR with note that it exceeds 400 lines

### Dependency Graph

```
Phase 1 (A11y) — no deps
  ↓
Phase 2 (Ideas DnD) — no deps (independent)
  ↓
Phase 3 (Lead Popup) — no deps on Phase 1/2 (independent)
  ↓
Phase 4 (Instagram) — no deps on Phase 1/2/3 (independent)
```

All phases are **independent** — they touch different files/modules. They can be applied in any order, though the listed order minimizes risk (smallest/safest first).

### Commit Sequence

```
fix(a11y): add sr-only DialogTitle to CommandDialog
feat(ideas): add useSortable to IdeaCard
feat(ideas): add handleDragOver and arrayMove to IdeasBoard
feat(leads): create LeadPopup Sheet component
feat(leads): wire LeadPopup into PipelineBoard
feat(leads): add Instagram handle display to lead detail page
```
