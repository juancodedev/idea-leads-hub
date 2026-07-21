# Visual Consistency Specification

## Purpose

Define the visual standards that eliminate inconsistencies across similar components in IdeaLeadsHub. All requirements apply to both light and dark mode unless otherwise noted. This is a pure visual refactor — zero behavioral changes.

## Requirements

### Requirement: Native `<select>` Replacement

All native `<select>` elements in scoped forms and tables MUST render as shadcn `Select` (Radix UI primitive).

#### Scenario: Form select renders as shadcn Select
- GIVEN a user views LeadForm or LeadsTable in any theme
- WHEN they focus the stage/status dropdown
- THEN the trigger renders as a styled shadcn button, not a native `<select>`
- AND the dropdown uses `SelectContent` with visible, theme-correct options

### Requirement: Kanban Column Unification

PipelineColumn and IdeaColumn MUST use identical header tokens, border-radius, and background colors.

#### Scenario: Columns match across pipelines
- GIVEN a user views the leads pipeline and the ideas kanban
- WHEN they compare column headers
- THEN both use the same `font-weight`, `text-transform`, and `letter-spacing` tokens
- AND both use the same `border-radius` and background token

### Requirement: Bar Chart Opacity Consistency

All bar chart fills MUST use identical opacity across PipelineAnalytics and IdeasByStatusChart.

#### Scenario: Chart fills match opacity
- GIVEN a user views any analytics bar chart
- WHEN inspecting the SVG bar fill elements
- THEN all fills use the same opacity value (0.8 or the agreed standard)
- AND no bar uses 0.7 while another uses 0.8

### Requirement: Inline Style Migration

Stage/tag color assignments MUST NOT use inline `style={{ backgroundColor, color }}`. They MUST reference CSS variable tokens or standard Tailwind classes.

#### Scenario: Tag colors use tokens
- GIVEN a user views a tag badge, tag selector, pipeline card, or lead quick view
- WHEN inspecting the `style` attribute on color-bearing elements
- THEN inline `backgroundColor`/`color` are absent or use CSS variable references
- AND the colors respond correctly to theme switching

### Requirement: Empty State Standardization

All empty states MUST follow a single pattern: centered icon, descriptive message, and optional CTA button — sharing the same spacing and typography tokens.

#### Scenario: Empty state renders consistently
- GIVEN a user views an empty list in LeadsTable, MessagesPage, IdeaColumn, UpcomingActivities, or the dashboard sidebar
- WHEN no data is present
- THEN they see a centered layout with an icon and a descriptive message
- AND if a CTA exists, it uses the same button token across all modules

### Requirement: Loading Skeleton Consolidation

All loading placeholders MUST use the shadcn `<Skeleton>` component.

#### Scenario: Loading state uses Skeleton component
- GIVEN a user views a component while data is loading
- WHEN inspecting the loading placeholder
- THEN it renders `<Skeleton>` with appropriate `className` props
- AND it does NOT use hand-rolled `bg-slate-200 dark:bg-slate-800` divs

### Requirement: CardHeader Spacing Consistency

All scoped card headers MUST use identical bottom padding.

#### Scenario: Card headers share spacing
- GIVEN a user views DashboardStats, UpcomingActivities, RelatedLeadCard, or IdeaCard
- WHEN inspecting the CardHeader padding-bottom
- THEN all use the same value (e.g., `pb-3` or the agreed token)
- AND none use `pb-2` or `pb-4` inconsistently

### Requirement: Calc Value Normalization

All height `calc()` values in scoped layouts MUST use consistent rem-based units.

#### Scenario: Layout heights use consistent calc
- GIVEN a user views any page with a `calc()` height for the content area
- WHEN inspecting the layout style
- THEN the subtracted value uses `rem` (not `px`)
- AND all scoped pages use the same subtracted value or a shared CSS variable

### Requirement: Hardcoded Slate Color Removal

Layout components MUST NOT use `bg-slate-*`, `border-slate-*`, or `text-slate-*` classes. They MUST use CSS variable tokens.

#### Scenario: Layout uses theme tokens
- GIVEN a user views any layout component in light mode
- WHEN toggling to dark mode
- THEN backgrounds, borders, and text colors adjust via CSS variables
- AND no color remains stuck at a hardcoded slate value that breaks in dark mode
