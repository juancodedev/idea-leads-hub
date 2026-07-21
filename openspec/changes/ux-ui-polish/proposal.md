# Proposal: UX/UI Polish — Visual Consistency Pass

## Intent

Eliminate visual inconsistencies between similar components across the app (leads pipeline vs. ideas kanban, bar charts, native selects, empty states, loading skeletons, spacing) without changing behavior or adding features. A polish pass, not a redesign.

## Scope

### In Scope

1. **Native `<select>` → shadcn `Select`** in `LeadForm.tsx`, `LeadsTable.tsx` — broken in dark mode
2. **Kanban column unification** — align `PipelineColumn.tsx` (rounded-lg, bg-slate-100/50, font-semibold text-slate-700) and `IdeaColumn.tsx` (rounded-xl, bg-muted/50, uppercase tracking-wider text-muted-foreground) onto shared tokens
3. **Bar chart opacity mismatch** — normalize `PipelineAnalytics.tsx` (opacity 0.7) and `IdeasByStatusChart.tsx` (opacity 0.8) to same value
4. **Inline styles for stage/tag colors** — refactor `LeadQuickView.tsx`, `PipelineCard.tsx`, `PipelineAnalytics.tsx`, `TagBadge.tsx`, `TagSelector.tsx` (2 instances), `LeadsTable.tsx` from `style={{ backgroundColor, color }}` to CSS variable / Tailwind approach
5. **Empty state standardization** — unify 5+ patterns across `LeadsTable`, `MessagesPage`, `IdeaColumn`, `UpcomingActivities`, dashboard sidebar
6. **Loading skeleton consolidation** — replace hand-rolled `bg-slate-200 dark:bg-slate-800` with shadcn `<Skeleton>`
7. **Spacing consistency** — align CardHeader `pb-2` vs `pb-4` across `DashboardStats`, `UpcomingActivities`, `RelatedLeadCard`, `IdeaCard`
8. **Calc value normalization** — unify `h-[calc(100vh-120px)]`, `h-[calc(100vh-12rem)]`, `h-[calc(100vh-8rem)]` to a shared token or consistent unit
9. **Layout hardcoded slate colors** — replace `bg-slate-100`, `border-slate-200`, `text-slate-700`, `text-slate-500` in layout components with CSS variable tokens

### Out of Scope

- Feature changes, new components, or behavior additions
- Color palette, typography, or design system overhaul
- Accessibility improvements not directly related to fixes above
- Shadcn/ui component library updates

## Capabilities

### New Capabilities

None — pure visual refactor, no new behavior.

### Modified Capabilities

None — no spec-level requirements change. The `api-rest` spec is unaffected.

## Approach

Three-phase execution:

1. **Component sweep** — refactor each file in scope with targeted edits: replace native `<select>` with shadcn `Select` + Radix primitive; migrate inline styles to `style` from CSS variable tokens or Tailwind classes; swap skeleton `div`s for `<Skeleton>`; unify `calc()` to rem-based values.
2. **Pattern extraction** — extract a shared `KanbanColumn` primitive if both kanbans converge; extract an `EmptyState` component for reuse across modules.
3. **Token audit** — scan all targeted files for hardcoded `slate` colors and replace with CSS variable tokens (`bg-background`, `bg-muted`, `text-muted-foreground`, `border-border`, etc.).

Each change is a single-file edit with zero behavioral risk.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/{leads,ideas,dashboard}/**/*.tsx` | Modified | 15+ components |
| `src/app/messages/page.tsx` | Modified | Empty state + calc |
| `src/modules/shared/components/TagSelector.tsx` | Modified | Inline style refactor |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| shadcn `Select` differs in behavior from native `<select>` | Low | Test keyboard nav, form submit, and controlled value |
| Shared component extraction changes call sites | Low | Keep extraction in same PR, verify all usages |
| CSS variable swap reveals missing token | Low | Fall back to explicit token; test light + dark mode |

## Rollback Plan

Per-file revert via `git checkout HEAD -- <file>`. All changes are independent — any single file can be reverted without affecting others.

## Dependencies

None.

## Success Criteria

- [ ] Every `<select>` in scope uses shadcn `Select` with dark mode visible
- [ ] Pipeline and Idea columns use same border-radius, background, and header tokens
- [ ] Both bar charts use identical opacity for bar fills
- [ ] No hardcoded `bg-slate-*` / `text-slate-*` remain in scoped files
- [ ] Empty states follow a single pattern (icon + message + optional action)
- [ ] All loading states use `<Skeleton>` component
- [ ] `calc()` values use consistent rem-based units
- [ ] CardHeader padding matches across dashboard components
