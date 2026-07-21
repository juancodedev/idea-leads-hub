# Design: UX/UI Polish — Visual Consistency Pass

## Technical Approach

Pure visual refactor across 15+ components: replace native `<select>` with shadcn `Select`, align kanban tokens between pipeline and ideas boards, normalize bar chart opacity, migrate dynamic colors to CSS variables, extract shared `EmptyState` component, consolidate loading skeletons to `<Skeleton>`, and eliminate hardcoded slate spacing/calc values. Every change is per-file with zero behavioral risk — all rollbackable via `git checkout HEAD -- <file>`.

## Architecture Decisions

### Decision: Kanban column unification → token alignment, not shared extraction

| Option | Tradeoff |
|--------|----------|
| Extract shared `KanbanColumn` | Would require abstracting droppable refs, empty state rendering, column actions, and add-card button — forces behavioral coupling between unrelated boards |
| **Chosen: Align tokens in each column** | Zero behavioral risk, both columns converge on same visual classes, each keeps its own droppable/sortable/features |

`PipelineColumn` and `IdeaColumn` converge on: `rounded-lg`, `bg-muted/50`, `border`, header `font-semibold text-sm text-muted-foreground` (dropping uppercase tracking-wider), count badge `bg-muted text-muted-foreground`.

### Decision: Dynamic stage/tag colors → CSS variable pattern

| Option | Tradeoff |
|--------|----------|
| Keep `style={{ backgroundColor: color }}` | Works but blocks Tailwind theming and looks inconsistent |
| **Chosen: Set `--tag-color` via inline style, reference via `bg-[var(--tag-color)]`** | Keeps Tailwind's dark mode/focus tokens working; only the dynamic hue escapes to inline style. For translucent bg (e.g., `${color}20`), use `style={{ '--tag-bg': color+'20', '--tag-color': color }}` |

Pattern: `<div style={{ '--tag-color': color } as React.CSSProperties} className="bg-[var(--tag-color)]" />`

### Decision: shadcn Select → create component + inline usage

| Option | Tradeoff |
|--------|----------|
| Extract `SelectField` wrapper | Premature — only 2 forms use selects with react-hook-form |
| **Chosen: Create `src/ui/components/select.tsx` (standard shadcn pattern), use `<Select>` directly in forms** | `LeadForm` wraps `<Select>` in `<FormControl>` per shadcn pattern; `LeadsTable` filters keep standalone `<Select>` |

Requires installing `@radix-ui/react-select` to match existing Radix dependency pattern.

### Decision: EmptyState → extract shared component

Empty states appear in 4+ locations with 3 different visual patterns. Extraction pays for itself immediately.

**Props**: `{ icon?: LucideIcon, title: string, description?: string, action?: { label: string, onClick: () => void } }`

Location: `src/ui/components/EmptyState.tsx`

### Decision: calc normalization → single token `h-[calc(100vh-8rem)]`

| Current | File | Target |
|---------|------|--------|
| `100vh-120px` | LeadQuickView | `100vh-8rem` |
| `100vh-12rem` | PipelineBoard | `100vh-8rem` |
| `100vh-8rem` | MessagesPage | `100vh-8rem` (already correct) |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/ui/components/select.tsx` | Create | shadcn Select using `@radix-ui/react-select` |
| `src/modules/leads/components/LeadForm.tsx` | Modify | Replace native `<select>` with `<Select>` in FormField |
| `src/modules/leads/components/LeadsTable.tsx` | Modify | Replace 2 native `<select>` with `<Select>`, replace skeleton, replace empty state, fix inline colors |
| `src/modules/leads/components/PipelineColumn.tsx` | Modify | Align tokens (rounded-lg→rounded-lg, bg→bg-muted/50, header→text-muted-foreground, add border) |
| `src/modules/ideas/presentation/components/IdeaColumn.tsx` | Modify | Align tokens (rounded-xl→rounded-lg, header→font-semibold text-sm text-muted-foreground, add border) |
| `src/modules/leads/components/PipelineCard.tsx` | Modify | Inline color → CSS var, replace hardcoded slate colors with tokens |
| `src/modules/leads/components/LeadQuickView.tsx` | Modify | Inline color → CSS var, fix calc to 8rem |
| `src/modules/leads/components/PipelineBoard.tsx` | Modify | Fix calc to 8rem |
| `src/modules/dashboard/components/PipelineAnalytics.tsx` | Modify | Normalize opacity to 0.8, fix hardcoded slate bg |
| `src/modules/dashboard/components/IdeasByStatusChart.tsx` | Modify | Already 0.8 — keep, fix hardcoded slate bg |
| `src/modules/dashboard/components/DashboardStats.tsx` | Modify | Fix CardHeader pb-2 → pb-3 |
| `src/modules/dashboard/components/UpcomingActivities.tsx` | Modify | Fix CardHeader pb-4 → pb-3, replace empty state |
| `src/modules/ideas/presentation/components/IdeaCard.tsx` | Modify | Fix CardHeader pb-2 → pb-3 |
| `src/modules/ideas/presentation/components/TagSelector.tsx` | Modify | Inline color → CSS var, remove dead style overrides |
| `src/modules/ideas/presentation/components/TagBadge.tsx` | Modify | Inline color → CSS var |
| `src/modules/shared/components/TagSelector.tsx` | Modify | Inline color → CSS var |
| `src/app/messages/page.tsx` | Modify | Replace skeleton, replace empty state, fix calc (already 8rem) |
| `src/ui/components/EmptyState.tsx` | Create | Shared empty state component |

## Data Flow

No data flow changes. All modifications are presentation-only — props, data fetching, and state management are untouched.

## Interfaces / Contracts

```tsx
// src/ui/components/EmptyState.tsx
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

```tsx
// CSS variable pattern for dynamic colors
// BEFORE:
style={{ backgroundColor: tag.color }}
// AFTER:
style={{ '--tag-color': tag.color } as React.CSSProperties}
className="bg-[var(--tag-color)]"
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual | Every modified component in light + dark mode | Toggle theme, verify no broken colors, no layout shifts |
| Visual | LeadForm submit with new Select | Submit form, verify value is correctly submitted |
| Visual | Kanban drag-and-drop still works | Drag lead between columns, drag idea between columns |
| Visual | EmptyState renders with/without icon and action | Check all 4+ usages |
| Visual | Skeleton components render in loading states | Trigger loading state in LeadsTable, MessagesPage |
| Snapshot | All modified components | `jest --updateSnapshot` to capture new class output |

## Migration / Rollout

No migration required. All changes are DOM-class swaps with zero data dependency. Run `git checkout HEAD -- <file>` for per-file rollback.

## Risks

| Risk | Mitigation |
|------|------------|
| shadcn Select keyboard nav differs from native `<select>` | Test Tab/Enter/Escape behavior, verify form submission |
| CSS variable notation `as React.CSSProperties` cast may fail in strict mode | Test with `npx tsc --noEmit` |
| Missed hardcoded slate color in a nested child | grep for `(bg|border|text)-slate-` across all modified files |
