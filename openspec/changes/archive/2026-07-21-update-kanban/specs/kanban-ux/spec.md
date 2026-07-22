# Spec: Kanban UX Improvements

**Change**: `update-kanban`
**Phase**: spec
**Scope**: 5 items — Accessibility, Ideas DnD Parity, Lead Popup, Instagram Link, Task Plan

---

## 1. ♿ Accessibility — `DialogTitle` in `CommandDialog`

### Requirements

**Functional**
- Add a visually hidden `DialogTitle` as a child of `DialogContent` inside `CommandDialog` in `src/ui/components/command.tsx`
- Radix UI requires every `DialogContent` to have an associated `DialogTitle` for correct accessibility tree and screen reader announcement
- Use either `VisuallyHidden` from `@radix-ui/react-visually-hidden` or the existing `sr-only` Tailwind utility class
- The title text must be "Command Menu" or an equivalent descriptive label

**Non-functional**
- Zero visual impact — the title must not be visible on screen
- Must not break any existing consumer of `CommandDialog`
- Must not introduce new dependencies (prefer existing `sr-only` utility or `@radix-ui/react-visually-hidden` if already available)
- Fix must live in the shared `CommandDialog` wrapper, not in every call site

### Scenarios

#### Happy path — CommandDialog renders without a11y warning

```
GIVEN a page that renders CommandDialog (triggered by Cmd+K or similar)
WHEN the CommandDialog opens
THEN the DialogContent contains a visually hidden DialogTitle
AND no Radix a11y warning "MissingDialogTitle" appears in the browser console
```

#### Edge case — Multiple CommandDialogs on the same page

```
GIVEN a page that renders multiple instances of CommandDialog
WHEN any instance is opened
THEN each instance has its own visually hidden DialogTitle
AND no duplicate-ID or ARIA attribute conflicts occur
```

#### Edge case — Title text content

```
GIVEN the CommandDialog component
WHEN rendered with default props
THEN the visually hidden DialogTitle contains the text "Command Menu"
```

### Acceptance Criteria

- [ ] `DialogTitle` with `className="sr-only"` is rendered inside `DialogContent` in `CommandDialog`
- [ ] No Radix a11y `MissingDialogTitle` warning in browser console when CommandDialog opens
- [ ] No visual change to the CommandDialog appearance
- [ ] All existing tests pass

---

## 2. 🔄 Ideas DnD Parity

### Requirements

**Functional**
- `IdeaCard` must use `useSortable` from `@dnd-kit/sortable`, mirroring the `PipelineCard` pattern:
  - `id`, `data.type: "Idea"`, drag indicator placeholder (dashed border during drag)
  - Apply `transform`, `transition`, `attributes`, `listeners` via `setNodeRef`
- `IdeasBoard` must add `handleDragOver` handler for cross-column detection during drag (mirroring `PipelineBoard.handleDragOver`)
- The existing `handleDragEnd` with `MoveIdeaStatus` use case, optimistic update, and error rollback must remain unchanged
- Reorder within a column must use `arrayMove` from `@dnd-kit/sortable`
- The existing board/list toggle and search/filter must continue to work without regressions

**Non-functional**
- Drag behavior must match the PipelineBoard UX (same `closestCorners` collision detection, same sensor config)
- Persistence already works via `MoveIdeaStatus` — no changes to the use case
- Error rollback already exists in `handleDragEnd` (reverts to `activeIdea` on failure)

### Scenarios

#### Happy path — Drag card within same column

```
GIVEN the Ideas board is rendered with multiple ideas in "Backlog" column
WHEN the user drags an IdeaCard from position 3 to position 1 within the same column
THEN the card visually moves to position 1 (optimistic reorder)
AND the move persists via MoveIdeaStatus
AND no error toast is shown
```

#### Happy path — Drag card to a different column

```
GIVEN the Ideas board is rendered with ideas in "Backlog" and "In Progress" columns
WHEN the user drags an IdeaCard from "Backlog" to "In Progress"
THEN during drag, the column highlights (isOver styles apply)
AND the card appears in "In Progress" on drop (optimistic)
AND MoveIdeaStatus.execute is called with the new status
AND on success, the card remains in "In Progress"
```

#### Happy path — Cross-column drag without dropping on a card

```
GIVEN the Ideas board is rendered with ideas in multiple columns
WHEN the user drags a card over an empty area of a target column
THEN handleDragOver detects the column's droppable
AND the card preview shows in the target column
AND the column border highlights
```

#### Error case — API failure during cross-column move

```
GIVEN the Ideas board is rendered
WHEN the user drags an IdeaCard to a different column
AND the MoveIdeaStatus.execute throws an error
THEN the card returns to its original column
AND a toast error "Error al mover la idea" is displayed
AND the store state is reverted to the original idea snapshot
```

#### Edge case — Dragging to the same column it came from

```
GIVEN the Ideas board is rendered
WHEN the user drags an IdeaCard from "Backlog" to "Backlog"
AND drops it
THEN no MoveIdeaStatus.execute is called (status unchanged)
AND the card stays in its original position
```

#### Edge case — Drag ends outside any droppable

```
GIVEN the Ideas board is rendered
WHEN the user starts dragging an IdeaCard
AND drops it outside any column or card (e.g., on the background or releases outside the board)
THEN the card returns to its original position
AND no API call is made
AND no error toast is shown
```

#### Edge case — Board/list toggle still works after DnD

```
GIVEN the Ideas page has a board/list toggle
WHEN the user switches from board to list view and back to board view
THEN all cards render correctly in their columns
AND drag-and-drop still functions after toggling views
```

#### Edge case — Search/filter still works after DnD

```
GIVEN the Ideas page has a search or filter input
WHEN the user filters ideas by keyword
THEN filtered results display correctly
AND drag-and-drop still functions on the filtered set
```

### Acceptance Criteria

- [ ] `IdeaCard` uses `useSortable` with `data.type: "Idea"` and shows a dashed placeholder during drag
- [ ] `IdeasBoard` has a `handleDragOver` handler that detects cross-column movement
- [ ] Reorder within column works (optimistic `arrayMove`)
- [ ] Cross-column move persists via `MoveIdeaStatus`
- [ ] API failure reverts the optimistic update and shows error toast
- [ ] Existing board/list toggle works without regression
- [ ] Existing search/filter works without regression

---

## 3. 🃏 Lead Popup

### Requirements

**Functional**
- Clicking a `PipelineCard` in `/pipeline` opens a popup (use shadcn Sheet or Dialog)
- Popup displays editable lead fields:
  - Name, Company, Email, Phone, Address, Website
- Stage/status selector matching the pipeline stages (from `stages` prop in PipelineBoard)
- Notes section:
  - Add a new note via inline form
  - View existing notes in a timeline
- Activity history section showing recent activities for that lead (reuses `LeadActivitiesSection` or equivalent)
- Save button persists changes via `SupabaseLeadRepository.update`
- Close/cancel buttons dismiss the popup without persisting unsaved changes
- New component: `src/modules/leads/components/LeadPopup.tsx`
- Wire `onClick` prop on `PipelineCard`
- State managed in `PipelineBoard` (open/close, selected lead ID)
- Form fields should use `react-hook-form` with the existing `LeadSchema` for validation (reuse pattern from `LeadForm.tsx`)

**Non-functional**
- Popup must not replace the full page — it's an overlay on the pipeline board
- Must work on mobile (responsive Sheet or Dialog)
- Must not affect the DnD behavior of the pipeline board
- Fetch fresh lead data from Supabase when popup opens (or use currently loaded lead from store)
- Loading state while fetching lead data (if fetching fresh)
- Error state if lead data fetch fails

### Scenarios

#### Happy path — Open popup and view lead details

```
GIVEN the Pipeline board is rendered with leads
WHEN the user clicks on a PipelineCard
THEN a popup opens showing the lead's name, company, email, phone, website, address
AND the stage selector shows the current stage selected
AND the notes section shows existing notes in a timeline
AND the activity history section shows recent activities
```

#### Happy path — Edit lead field and save

```
GIVEN the lead popup is open
WHEN the user edits the "company" field
AND clicks "Guardar" (Save)
THEN the field becomes disabled/loading during save
AND SupabaseLeadRepository.update is called with the updated fields
AND the store is updated with the new lead data
AND the PipelineCard in the board reflects the updated field
AND a success toast "Lead actualizado correctamente" appears
```

#### Happy path — Change pipeline stage from popup

```
GIVEN the lead popup is open
WHEN the user changes the stage selector from "Contactado" to "Interesado"
AND clicks "Guardar"
THEN the lead's stageId and status are updated
AND the card moves to the "Interesado" column in the board
AND the popup closes (or stays open with updated stage)
```

#### Happy path — Add a note from the popup

```
GIVEN the lead popup is open
WHEN the user types a note in the notes input
AND clicks "Añadir Nota" (Add Note)
THEN the note is saved via SupabaseNoteRepository
AND the note appears in the notes timeline
AND the input is cleared
```

#### Happy path — View activity history

```
GIVEN the lead popup is open for a lead with recent activities
WHEN the user views the activity history section
THEN recent activities are displayed (e.g., status changes, note additions)
```

#### Edge case — Popup opens for a lead with missing optional fields

```
GIVEN the lead popup is open for a lead without phone, website, or address
WHEN the popup renders
THEN missing fields display as empty or with placeholder text
AND no errors occur
```

#### Edge case — Cancel without saving

```
GIVEN the lead popup is open with edited form fields
WHEN the user clicks "Cancelar" or closes the popup
AND there are unsaved changes
THEN the popup closes without persisting changes
AND the board state remains unchanged
```

#### Edge case — Empty notes timeline

```
GIVEN the lead popup is open for a lead with no notes
WHEN the user views the notes section
THEN the timeline shows an empty state: "Sin notas" or "No hay notas todavía"
```

#### Error case — Save fails

```
GIVEN the lead popup is open with edited fields
WHEN the user clicks "Guardar"
AND SupabaseLeadRepository.update throws an error
THEN an error toast "Error al actualizar el lead" appears
AND the form remains editable with the user's changes (not reverted)
AND the popup does not close
```

#### Error case — Lead data fetch fails

```
GIVEN the Pipeline board is rendered
WHEN the user clicks on a PipelineCard
AND the lead data fetch from Supabase fails
THEN an error state is shown in the popup
AND an error toast appears
```

### Acceptance Criteria

- [ ] `LeadPopup.tsx` is created in `src/modules/leads/components/`
- [ ] Clicking a `PipelineCard` opens the popup (Sheet or Dialog)
- [ ] All lead fields are editable (name, company, email, phone, address, website)
- [ ] Stage selector reflects available pipeline stages
- [ ] Notes can be added and viewed in a timeline
- [ ] Activity history section shows recent activities
- [ ] Save persists via `SupabaseLeadRepository.update`
- [ ] Close/cancel without saving does not persist changes
- [ ] Pipeline DnD continues to work (opening popup doesn't break drag state)
- [ ] Error states handled gracefully with toasts

---

## 4. 📱 Instagram on `/leads/[id]`

### Requirements

**Functional**
- In the contact sidebar section of `src/app/(dashboard)/leads/[id]/page.tsx`, add an Instagram section after the website entry
- Display `@{instagramHandle}` when the field is present
- Make the handle a clickable link to `https://instagram.com/{instagramHandle}` (opens in new tab)
- Show `instagramScopedId` as secondary/muted info below the handle
- Use the `Instagram` icon from lucide-react (available since lucide-react v0.379+ or use a custom SVG/alternative icon from lucide)
- Conditionally render the section only when `instagramHandle` exists
- Must preserve existing layout and spacing of the contact sidebar

**Non-functional**
- Zero visual impact when `instagramHandle` is not set (no empty section, no layout shift)
- Styling must match the existing contact info entries (same icon size, text size, spacing)
- Link must have `target="_blank"` and `rel="noopener noreferrer"` for security
- No external API calls — display stored data only

### Scenarios

#### Happy path — Lead with Instagram handle

```
GIVEN a lead with instagramHandle="acme_corp" and instagramScopedId="17841405822304715"
WHEN the user visits /leads/{id}
THEN the contact sidebar shows:
  - Instagram icon
  - "@acme_corp" as a clickable link to "https://instagram.com/acme_corp"
  - "ID: 17841405822304715" as muted secondary text below the handle
```

#### Happy path — Instagram link opens in new tab

```
GIVEN a lead with instagramHandle
WHEN the user clicks the Instagram link in the contact sidebar
THEN the link opens in a new browser tab
AND the link has rel="noopener noreferrer"
```

#### Edge case — Lead without Instagram handle

```
GIVEN a lead where instagramHandle is undefined or empty string
WHEN the user visits /leads/{id}
THEN the Instagram section is not rendered in the contact sidebar
AND the layout of the remaining contact fields is unchanged
```

#### Edge case — Lead with handle but no scoped ID

```
GIVEN a lead with instagramHandle="acme_corp" but instagramScopedId is undefined
WHEN the user visits /leads/{id}
THEN the Instagram section shows the handle link
AND the scoped ID line is not rendered
```

### Acceptance Criteria

- [ ] Instagram section appears after website in the contact sidebar when `instagramHandle` is set
- [ ] `@{instagramHandle}` is a clickable link to `https://instagram.com/{instagramHandle}`
- [ ] Instagram icon displayed next to the handle
- [ ] Scoped ID shown as secondary info when present
- [ ] Section not rendered when `instagramHandle` is absent
- [ ] Link opens in new tab with `rel="noopener noreferrer"`
- [ ] Styling consistent with existing contact fields (Mail, Phone, Website)

---

## 5. 📋 Tasks

### Implementation Order

1. **Accessibility fix** (`command.tsx`) — Smallest change, no side effects
2. **Ideas DnD parity** (`IdeaCard`, `IdeasBoard`) — Isolated to ideas module
3. **Instagram link** (`/leads/[id]/page.tsx`) — Isolated component change
4. **Lead popup** (`LeadPopup.tsx`, `PipelineCard`, `PipelineBoard`) — Largest, depends on understanding of existing components

### Concrete Task Breakdown

#### Task 1: Add DialogTitle to CommandDialog

**Files**: `src/ui/components/command.tsx`
**Changes**:
- Import `DialogTitle` from `@/ui/components/dialog`
- Inside `DialogContent` in `CommandDialog`, add `<DialogTitle className="sr-only">Command Menu</DialogTitle>`
- Verify no Radix a11y warning in browser console

#### Task 2: Add useSortable to IdeaCard

**Files**: `src/modules/ideas/presentation/components/IdeaCard.tsx`
**Changes**:
- Import `useSortable` from `@dnd-kit/sortable` and `CSS` from `@dnd-kit/utilities`
- Add `useSortable({ id: idea.id, data: { type: 'Idea', idea } })` hook
- Apply `setNodeRef`, `style` (transform/transition), `attributes`, `listeners` to the wrapping element
- Show dashed placeholder when `isDragging && !isOverlay` (mirror PipelineCard pattern)
- Add `isOverlay` prop to `IdeaCardProps` (similar to PipelineCard)

#### Task 3: Add handleDragOver to IdeasBoard

**Files**: `src/modules/ideas/presentation/components/IdeasBoard.tsx`
**Changes**:
- Import `DragOverEvent` from `@dnd-kit/core`
- Add `handleDragOver` handler that detects cross-column movement
- On cross-column drag, update store optimistically (same pattern as PipelineBoard)
- Wire `onDragOver` to the `DndContext`
- Note: `handleDragOver` fires frequently during drag — it should only update the store when the card actually enters a new column, not on every pixel

#### Task 4: Add Instagram section to leads/[id] page

**Files**: `src/app/(dashboard)/leads/[id]/page.tsx`
**Changes**:
- Import `Instagram` icon from `lucide-react` (verify icon name — may need `Camera` or custom SVG if `Instagram` is not in the installed version)
- Add conditional block after `website` entry in the contact sidebar:
  - If `lead.instagramHandle` is truthy, render icon + link + scoped ID
- Ensure existing tests pass

#### Task 5: Create LeadPopup component

**Files**: `src/modules/leads/components/LeadPopup.tsx` (new)
**Changes**:
- Create as a client component
- Use Sheet or Dialog from shadcn/ui
- Props: `lead: Lead`, `stages: PipelineStage[]`, `open: boolean`, `onOpenChange`, `onSave`
- Form using `react-hook-form` + `zod` with `LeadSchema`
- Stage selector using pipeline stages
- Notes section with `NoteForm` + `NoteTimeline`
- Activity history section with `LeadActivitiesSection`
- Save handler calling `SupabaseLeadRepository.update`
- Loading/error states

#### Task 6: Wire LeadPopup into PipelineBoard and PipelineCard

**Files**: 
- `src/modules/leads/components/PipelineCard.tsx`
- `src/modules/leads/components/PipelineBoard.tsx`

**Changes**:
- `PipelineCard`: Add optional `onClick` prop (string id) 
- `PipelineBoard`: Add state for `selectedLeadId` and `isPopupOpen`
- On card click, set `selectedLeadId` and open popup
- Render `LeadPopup` with selected lead's data
- Pass `stages` to the popup
- Handle save/close events
- Update `PipelineColumn` to pass `onClick` through to `PipelineCard`

### Verification

- All items individually revertible
- Spec must be reviewed before implementation
- Each task generates its own spec sub-document if needed

---

## Delivery Strategy Notes

- **Estimated change size**: ~350-500 lines (LeadPopup alone ~200-300 lines)
- **400-line budget**: May be borderline — consider chaining LeadPopup into its own PR if the total exceeds 400
- **Revert safety**: Each item is in its own commit, independently revertible
