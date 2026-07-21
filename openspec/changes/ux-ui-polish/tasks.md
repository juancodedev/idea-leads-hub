# Tasks: UX/UI Polish — Visual Consistency Pass

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Select migration | PR 1 | 3 creates + 3 mods; base = main |
| 2 | Visual token sweep | PR 2 | 11 mods, independent; base = main |

## Phase 1: Foundation

- [x] 1.1 `pnpm add @radix-ui/react-select`
- [x] 1.2 Create `src/ui/components/select.tsx` — shadcn Select with Trigger, Content, Item, Value
- [x] 1.3 Create `src/ui/components/EmptyState.tsx` — `{ icon?, title, description?, action? }`

## Phase 2: Select Migration

- [x] 2.1 `LeadForm.tsx` — native `<select>` → `<Select>` in FormField
- [x] 2.2 `LeadsTable.tsx` — 2 native selects → Select, hand skeleton → `<Skeleton>`, inline empty state → `<EmptyState>`, inline colors → CSS var

## Phase 3: Visual Token Alignment

- [x] 3.1 `PipelineColumn.tsx` — rounded-lg, bg-muted/50, header font-semibold text-sm text-muted-foreground, border, count badge
- [x] 3.2 `IdeaColumn.tsx` — same tokens as PipelineColumn
- [x] 3.3 `PipelineCard.tsx` — inline color → `--tag-color` CSS var, replace hardcoded slate
- [x] 3.4 `LeadQuickView.tsx` — inline color → CSS var, calc → `100vh-8rem`
- [x] 3.5 `PipelineBoard.tsx` — calc → `100vh-8rem`
- [x] 3.6 `PipelineAnalytics.tsx` — opacity 0.8, slate bg → theme token
- [x] 3.7 `IdeasByStatusChart.tsx` — slate bg → theme token
- [x] 3.8 `DashboardStats.tsx` — CardHeader pb-2 → pb-3
- [x] 3.9 `UpcomingActivities.tsx` — CardHeader pb-4 → pb-3, inline empty → `<EmptyState>`
- [x] 3.10 `IdeaCard.tsx` — CardHeader pb-2 → pb-3
- [x] 3.11 `MessagesPage.tsx` — hand skeleton → `<Skeleton>`, inline empty → `<EmptyState>`, verify calc

## Phase 4: Color Pattern Sweep

- [x] 4.1 `TagSelector.tsx` (ideas) — inline color → CSS var, remove dead styles
- [x] 4.2 `TagBadge.tsx` — inline color → CSS var
- [x] 4.3 `TagSelector.tsx` (shared) — inline color → CSS var

## Phase 5: Slate Audit

- [x] 5.1 Grep all 16 modified files for `(bg|border|text)-slate-` → replace with CSS variable tokens
- [x] 5.2 `npx tsc --noEmit` and fix CSSProperties cast issues
- [x] 5.3 Visual check: toggle light/dark mode on all modified components
