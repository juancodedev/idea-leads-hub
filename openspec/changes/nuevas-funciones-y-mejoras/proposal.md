# SDD Proposal: nuevas funciones y mejoras

**Status**: approved
**Date**: 2026-07-24

---

## Executive Summary

El CRM actual tiene su backend de pipeline completo pero sin UI de administración, un bug que impide limpiar campos opcionales, y carencias de productividad diaria (filtros sin persistencia, CommandMenu placeholder, delete sin undo). Este change ataca los ítems de mayor impacto con esfuerzo bajo-medio en 2 slices, dejando mejoras de UX menor para un change futuro.

---

## Intent & Purpose

- **Pipeline Management**: Hoy las etapas solo se gestionan vía SQL. Un CRM necesita UI para crear, renombrar, reordenar y eliminar etapas.
- **Bug critical**: `SupabaseLeadRepository.update()` usa `if(valor)` en vez de `if(valor !== undefined)`, lo que impide limpiar campos como website, linkedin, etc.
- **Productividad diaria**: Los filtros en leads no persisten en URL, el CommandMenu no busca datos reales, y al eliminar un lead no hay undo. Son fricciones diarias.

---

## Scope — IN

1. **Pipeline Management UI** — Página de settings con lista de etapas, rename inline, drag-to-reorder, add/delete, validación al eliminar etapas con leads
2. **Pipeline selector** — Reemplazar `pipelines[0]` hardcodeado con un selector de pipeline
3. **Fix update() bug** — `if(valor)` → `if(valor !== undefined)` en `SupabaseLeadRepository.update()`
4. **Search params** — Persistir filtros, sort y búsqueda en URL para LeadsTable
5. **CommandMenu con búsqueda** — Buscar leads via API con debounce, límite 20 resultados
6. **Undo toast en delete** — Usar acción de Sonner para re-crear el lead

---

## Scope — OUT

- Server-side pagination (requiere refactor profundo del repo, otro change)
- CSV import/export
- Lead scoring
- Email integration
- Multi-user / team features
- Dark mode
- Breadcrumbs (defer)
- Empty states con CTA (defer)

---

## Technical Approach

### Pipeline Management UI
- Nueva ruta `/pipeline` con `PipelineSettings` component
- Usar `usePipelineRepository` existente (`getAll`, `updateStage`, `createStage`, `deleteStage`, `reorderStages`)
- Drag-to-reorder con HTML5 drag & drop o librería liviana (hello-pangea/dnd)
- Al eliminar: verificar `leadRepo.countByStage(stageId)` → si > 0, mostrar diálogo de reasignación

### Pipeline selector
- En LeadWorkspace, agregar un `Select` en el header del StageSelector para elegir pipeline
- Al cambiar pipeline, recargar stages y actualizar estado del lead si su stage no existe en el nuevo pipeline

### Fix update() bug
- Cambiar cada `if (valor)` por `if (valor !== undefined)` en el método `update()` del repo
- Los strings vacíos (`""`) deben enviarse como `null` a la DB para limpiar el campo

### Search params
- Usar `useSearchParams` + `useRouter` de Next.js
- Sincronizar estado del store (`useLeadsStore`) con URL en ambos sentidos
- Mantener compatibilidad con filtros actuales

### CommandMenu con búsqueda
- Agregar comando "Buscar leads..." que abre input de búsqueda
- Llamar a API endpoint (o repo) con debounce 300ms
- Máximo 20 resultados para evitar lentitud
- Al seleccionar, navegar a `/leads/{id}`

### Undo toast
- En delete, antes de borrar guardar el lead en memoria
- `toast('Lead eliminado', { action: { label: 'Deshacer', onClick: () => repository.create(saved) } })`

---

## Slicing Strategy

| Slice | Items | Est. líneas | PR |
|-------|-------|-------------|-----|
| **1 — Core Pipeline** | Pipeline UI + selector + fix bug update() | ~500 | PR #1 |
| **2 — Productividad** | Search params + CommandMenu + Undo toast | ~400 | PR #2 |
| **(futuro)** | Empty states + Breadcrumbs | ~200 | PR #3 |

---

## Delivery

- **Chained PR strategy**: `ask-on-risk` — preguntar al llegar al review workload guard
- **Chain strategy**: pendiente de definir si es necesario dividir
- **Review budget**: 800 líneas

---

## Risks & Mitigations

| Riesgo | Mitigación |
|--------|-----------|
| Eliminar etapa con leads activos | Validar con `countByStage()`, ofrecer reasignación |
| CommandMenu lento sin paginación | Limitar a 20 resultados con debounce 300ms |
| Search params rompen filtros existentes | Migración gradual, mantener store sincronizado |
| update() bug afecta forms existentes | Incluir fix como primer cambio del Slice 1 |
