# Design: Update Kanban

## Technical Approach

Four independent modifications to the kanban/board views: (1) fix Radix a11y warning in shared `CommandDialog`, (2) bring Ideas DnD to parity with Pipeline by adding `useSortable` + `handleDragOver`, (3) add inline `LeadPopup` Sheet to the Pipeline board, (4) display stored Instagram fields on `/leads/[id]`. Each item is independently revertible.

## 1. ♿ Accessibility — CommandDialog DialogTitle

### Component Tree

```
CommandDialog (command.tsx)
  └─ Dialog (unchanged)
      └─ DialogContent
          ├─ DialogTitle className="sr-only"   ← NEW
          └─ Command (unchanged)
```

**State**: None. Pure markup addition (no new state or props needed).

### Technical Decision

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `@radix-ui/react-visually-hidden` | Requires installing new package, exact same a11y outcome as `sr-only` | Rejected |
| `sr-only` Tailwind utility | Zero-dependency, already used in `dialog.tsx` line 49, `sheet.tsx` line 70 | **Adopted** |

Import `DialogTitle` from `@/ui/components/dialog` (already available). Add `<DialogTitle className="sr-only">Command Menu</DialogTitle>` as the first child of `DialogContent`.

## 2. 🔄 Ideas DnD Parity

### Component Tree

```
IdeasBoard (modified)
  ├─ DndContext (add onDragOver={handleDragOver})
  │   └─ IdeaColumn (unchanged)
  │       └─ SortableContext
  │           └─ IdeaCard (modified — add useSortable)
  └─ DragOverlay (unchanged)
```

**Props updates**:
- `IdeaCard`: add `isOverlay?: boolean` (mirror `PipelineCard`)
- `IdeasBoard`: no new props

**State**: `activeIdea` (already exists), no new store actions needed.

### Data Flow

```
Drag card → useSortable (optimistic transform)
  ↳ Cross-column? → handleDragOver → updateIdea({...idea, status}) in store
  ↳ Drop → handleDragEnd:
      1. updateIdea({...activeIdea, status: newStatus}) (optimistic)
      2. MoveIdeaStatus.execute(id, status) (persist)
      3. On error: updateIdea(activeIdea) (rollback) + toast
```

- `handleDragOver` fires frequently — only update store when `activeIdea.status !== newStatus` (guard against redundant updates)
- `arrayMove` in `handleDragEnd` for intra-column reorder (new addition matching PipelineBoard's pattern)

### Decision: handleDragOver approach

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Store update on every DragOver event | Simple but fires many times | **Adopted** (guard with status-change check prevents wasted renders) |
| Debounce handleDragOver | Reduces renders but adds latency to visual feedback | Rejected — not worth complexity |

## 3. 🃏 Lead Popup

### Component Tree

```
PipelineBoard (modified)
  ├─ DndContext
  │   └─ PipelineColumn
  │       └─ PipelineCard (add onClick)
  └─ LeadPopup ← NEW
       ├─ SheetHeader + SheetTitle
       ├─ Form (react-hook-form + LeadSchema)
       │   ├─ name, company, email, phone, address, website (Input fields)
       │   └─ StageSelector (Select from stages prop)
       ├─ NotesSection
       │   ├─ NoteForm (existing shared component)
       │   └─ NoteTimeline (existing shared component)
       └─ LeadActivitiesSection (existing activity module)
```

**New state in PipelineBoard**:
```ts
const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
const [isPopupOpen, setIsPopupOpen] = useState(false);
```

**LeadPopup Props**:
```
interface LeadPopupProps {
  lead: Lead;
  stages: PipelineStage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
}
```

### Data Flow

```
Click PipelineCard
  → setSelectedLeadId(lead.id), setIsPopupOpen(true)
  → LeadPopup renders with lead prop (already loaded from initialLeads/useLeadsStore)
  → User edits fields → Save →
      1. repository.update({...values}) (persist)
      2. updateLead(updatedLead) in store (optimistic)
      3. toast + close popup
  → User adds note →
      NoteForm calls SupabaseNoteRepository.create, refetches notes
  → Activity history →
      LeadActivitiesSection fetches independently via useEffect(leadId)
```

**Loading/Error states**:
- Lead data: already available from store (no fetch needed on open)
- Save: `isSubmitting` boolean on form, disable button, show Loader2
- Save error: `toast.error`, form stays open with user's edits
- Notes: `NoteForm` has its own `loading` state and `toast.error`
- Activity: `LeadActivitiesSection` has its own `isLoading` → `Skeleton`

### Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sheet vs Dialog | **Sheet** (right) | LeadPopup has many fields (form + notes + activity). Sheet gives side-panel real estate (`sm:max-w-2xl`) while keeping board context visible. Dialog would be cramped and modal. |
| Fetch on open vs store | **Store data** | Lead is already in `useLeadsStore` from `initialLeads`. Re-fetching adds latency. Store is source of truth after DnD updates. |
| Notes via shared vs inline | **Shared NoteForm + NoteTimeline** | Already exist, work with `entityType: 'lead'`, have their own loading/error/empty states. Zero new code. |
| Activity data source | **LeadActivitiesSection re-fetch** | It already fetches independently by `leadId`. No prop drilling needed. |

## 4. 📱 Instagram on /leads/[id]

### Component Tree

```
LeadDetailsPage (page.tsx — modified)
  └─ Contact Sidebar
      ├─ Mail (existing)
      ├─ Phone (existing)
      ├─ Website (existing)
      ├─ Instagram (NEW — conditional)
      │   ├─ Instagram icon
      │   ├─ @{handle} → instagram.com/{handle} (link)
      │   └─ ID: {scopedId} (muted)
      ├─ Building (existing)
      ├─ MapPin (existing)
      └─ ...
```

**No new state or props** — server component reads `lead.instagramHandle` and `lead.instagramScopedId` directly from the fetched Lead entity.

### Data Flow

```
Server component renders page → lead object has instagramHandle
  → Condition: lead.instagramHandle is truthy?
    → Yes: render icon + link + scoped ID
    → No: render nothing
```

Instagram icon name in lucide-react: use `Camera` or check available icons — `Instagram` was added in lucide v0.379+. Fallback: use an SVG inline or `ExternalLink` icon.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/ui/components/command.tsx` | Modify | Add `<DialogTitle className="sr-only">` inside `DialogContent` |
| `src/modules/ideas/presentation/components/IdeaCard.tsx` | Modify | Add `useSortable`, `isOverlay` prop, drag placeholder |
| `src/modules/ideas/presentation/components/IdeasBoard.tsx` | Modify | Add import `DragOverEvent`, add `handleDragOver`, wire to `DndContext.onDragOver` |
| `src/modules/leads/components/LeadPopup.tsx` | **New** | Sheet with form, stage selector, notes, activity history |
| `src/modules/leads/components/PipelineCard.tsx` | Modify | Add optional `onClick` prop |
| `src/modules/leads/components/PipelineBoard.tsx` | Modify | Add state for popup, wire card click, render `LeadPopup` |
| `src/modules/leads/components/PipelineColumn.tsx` | Modify | Pass `onClick` through to `PipelineCard` |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Modify | Add Instagram section after website in contact sidebar |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Ideas DnD — drag events fire correctly with `useSortable` | Existing test patterns for IdeasBoard |
| Unit | LeadPopup form validation | Mirror existing LeadForm tests with `react-hook-form` |
| Integration | Ideas DnD cross-column → `MoveIdeaStatus.execute` called | Mock use case, trigger `DragEndEvent` |
| Integration | LeadPopup save → `SupabaseLeadRepository.update` called | Mock repository, verify params |
| E2E | Visual: no a11y warning in console | Manual — test with Cmd+K open/close |
| A11y | Screen reader: CommandDialog announces "Command Menu" | Manual — VoiceOver/NVDA |

## Migration / Rollout

No migration required. Each item is independently revertible by reverting its commit.

## Open Questions

- [ ] Instagram icon name in the installed lucide-react version — verify with `pnpm ls lucide-react` (fallback to inline SVG or `Camera` icon if `Instagram` not available).
- [ ] Whether `arrayMove` should be used in `IdeasBoard.handleDragEnd` for within-column reorder — PipelineBoard doesn't use it, but it's required for full DnD parity per the spec. Confirm during implementation.
