# SDD Tasks: nuevas funciones y mejoras

**Status**: draft
**Date**: 2026-07-24

---

## Slice 1 — Core Pipeline (~500 lines)

### T1. Fix update() bug in SupabaseLeadRepository  [x]
- **Files**: `src/infrastructure/repositories/SupabaseLeadRepository.ts`
- **Description**: Change all `if (valor)` checks to `if (valor !== undefined)` and send empty strings as `null`
- **Fields affected**: website, linkedinUrl, address, notes, instagramHandle, instagramScopedId, jobTitle, phone, company
- **Type**: bugfix
- **Dependencies**: none
- **Risk**: baja — cambio mecánico

### T2. Create Pipeline Management page  [x]
- **Files**: 
  - `src/app/(dashboard)/pipeline/page.tsx` (nuevo)
  - `src/modules/pipeline/components/PipelineSettings.tsx` (nuevo)
  - `src/modules/pipeline/components/StageList.tsx` (nuevo)
  - `src/modules/pipeline/components/StageItem.tsx` (nuevo)
  - `src/modules/pipeline/components/InlineRename.tsx` (nuevo)
  - `src/modules/pipeline/components/AddStageButton.tsx` (nuevo)
- **Description**: Full pipeline settings page with CRUD stages, drag reorder, delete validation
- **Dependencies**: T1 (para que forms funcionen bien al crear)
- **Risk**: media — drag & drop y validación de eliminación

### T3. Add Pipeline Selector to LeadWorkspace
- **Files**: `src/modules/leads/components/LeadWorkspace.tsx`
- **Description**: Replace hardcoded `pipelines[0]` with a Select to choose pipeline
- **Dependencies**: T2 (pipeline management debe existir para que el selector tenga sentido)
- **Risk**: baja — cambio aislado

---

## Slice 2 — Daily Productivity (~400 lines)

### T4. Implement search params for LeadsTable
- **Files**:
  - `src/app/(dashboard)/leads/page.tsx`
  - `src/modules/leads/store/useLeadsStore.ts`
  - `src/modules/leads/components/LeadsTable.tsx`
- **Description**: Sync filter/sort/search state with URL search params
- **Dependencies**: none (puede ir en paralelo con Slice 1)
- **Risk**: media — migración de estado, edge cases con params inválidos

### T5. Add lead search to CommandMenu
- **Files**:
  - `src/modules/shared/components/CommandMenu.tsx` (o donde esté)
  - Eventual: `src/app/api/leads/search/route.ts` (nuevo endpoint API)
- **Description**: Add "Buscar leads..." command with debounced API search, 20-result limit, navigate on select
- **Dependencies**: none
- **Risk**: baja — feature aislada

### T6. Implement Undo toast on delete
- **Files**: Componente donde se ejecuta delete (LeadsTable o store)
- **Description**: Save lead before delete, Sonner toast with Undo action
- **Dependencies**: T1 (para que re-crear funcione correctamente si hay campos vacíos)
- **Risk**: baja — feature aislada

---

## Review Workload Forecast

| Slice | Items | Est. líneas cambiadas | PR recomendado |
|-------|-------|----------------------|----------------|
| 1 | T1 + T2 + T3 | ~500 | PR #1 (preguntar si dividir) |
| 2 | T4 + T5 + T6 | ~400 | PR #2 |

**Chained PRs recommended**: Sí, si Slice 1 supera 500 líneas
**400-line budget risk**: Slice 1 está en ~500, Slice 2 en ~400
**Decision needed before apply**: Sí — confirmar si dividir Slice 1 en 2 PRs

---

## Total Estimated Effort
- Slice 1: ~4-5 horas
- Slice 2: ~3-4 horas
- **Total**: ~7-9 horas

## Dependencies Graph
```
T1 ──→ T3
  └──→ T6
T2 ──→ T3
```
T3 depende de T1 (fix update) + T2 (pipeline management). T6 depende de T1.
T4 y T5 son independientes.
