# SDD Spec: nuevas funciones y mejoras

**Status**: draft
**Date**: 2026-07-24

---

## 1. Pipeline Management UI

### Requirements
- Página dedicada para administrar pipelines y sus etapas
- CRUD completo de etapas: crear, leer, actualizar, eliminar
- Reordenamiento drag & drop de etapas
- Validación al eliminar etapas que tienen leads asignados
- Persistencia inmediata en Supabase

### Scenarios

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 1.1 | Usuario crea nueva etapa "Revisado" | Etapa aparece en pipeline, visible en detail y edit de leads |
| 1.2 | Usuario renombra "Nuevo" → "Lead Inicial" | Nombre actualizado en DB, trigger sincroniza status en leads |
| 1.3 | Usuario elimina etapa sin leads | Etapa eliminada, no afecta otros datos |
| 1.4 | Usuario elimina etapa CON leads activos | Modal de confirmación: "Reasignar a otra etapa" o "Cancelar" |
| 1.5 | Usuario reordena etapas vía drag | Nuevo orden persiste al recargar página |
| 1.6 | Usuario crea etapa con nombre duplicado | Error: "Ya existe una etapa con ese nombre en este pipeline" |
| 1.7 | Error de red al crear/eliminar/reordenar | Toast error, UI revierte cambio optimista |

### Validation Rules
- Nombre único por pipeline, case-insensitive
- Máximo 50 caracteres
- Mínimo 1 etapa por pipeline (no eliminar la última)
- Color opcional, formato hex (#RRGGBB)

### Error States
- API failure → toast.error + revert optimistic update
- Loading → skeleton mientras fetch
- Empty pipeline → "Crea tu primera etapa" con CTA

---

## 2. Pipeline Selector

### Requirements
- Reemplazar `pipelines[0]` hardcodeado con un Select de pipeline
- Al cambiar pipeline, recargar stages del nuevo pipeline
- Si el stage actual del lead no existe en el nuevo pipeline, ofrecer reasignación

### Scenarios

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 2.1 | Usuario tiene 2+ pipelines | Select muestra todos, selecciona el que quiere ver |
| 2.2 | Usuario cambia pipeline | Stages del LeadWorkspace se actualizan |
| 2.3 | Stage actual no existe en nuevo pipeline | Toast warning: "El stage actual no existe en este pipeline. Seleccioná uno nuevo." |
| 2.4 | Usuario tiene 1 pipeline | Select oculto o deshabilitado, usa el único pipeline |

### Affected Components
- LeadWorkspace.tsx — agregar Select en header
- StageSelector — depende del pipeline seleccionado

---

## 3. Fix update() bug — Allow clearing optional fields

### Requirements
- `SupabaseLeadRepository.update()` debe diferenciar entre `undefined` (no tocar) y `""` (limpiar)
- Strings vacíos deben enviarse como `null` a la DB

### Scenarios

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 3.1 | Usuario limpia website, guarda lead | DB: `website = null`, no más "http://" fantasma |
| 3.2 | Usuario limpia linkedinUrl | DB: `linkedin_url = null` |
| 3.3 | Usuario limpia notes | DB: `notes = null` |
| 3.4 | Usuario update solo name, deja los demás vacíos | DB: solo cambia name, otros campos no se tocan |
| 3.5 | Usuario envía string con espacios en blanco | Se trata como string válido, no se limpia |

### Affected Fields
`website`, `linkedinUrl`, `address`, `notes`, `instagramHandle`, `instagramScopedId`, `jobTitle`, `phone`, `company`

### Test Cases
- `update({ id, website: "" })` → columna `website` en DB debe ser `null`
- `update({ id, name: "Nuevo" })` → solo UPDATE name, no tocar otras columnas
- `update({ id, estimatedValue: 0 })` → `0` debe persistir como número (no es falsy check)

---

## 4. Search Params for LeadsTable

### Requirements
- Estados de filtro, sort y búsqueda persisten en URL query params
- Sincronización bidireccional: store ↔ URL
- Compatible con filtros existentes del store

### Scenarios

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 4.1 | Usuario filtra por status "Interesado" | URL: `?status=Interesado`, recarga preserva filtro |
| 4.2 | Usuario busca "acme" | URL: `?q=acme`, tabla filtra |
| 4.3 | Usuario navega a /leads y vuelve | URL preserves ?status=... |
| 4.4 | Usuario comparte URL | Destinatario ve misma vista filtrada |
| 4.5 | Usuario limpia todos los filtros | URL: `/leads` sin query params |

### URL Schema
```
/leads?q={search}&status={status}&source={source}&sort={field}&order={asc|desc}&page={n}
```

### Edge Cases
- Query params inválidos: ignorar y usar default
- XSS en query params: sanitizar antes de renderizar

---

## 5. CommandMenu with Lead Search

### Requirements
- Atajo Cmd+K abre CommandMenu
- Búsqueda de leads vía API con debounce
- Máximo 20 resultados
- Al seleccionar, navegar a `/leads/{id}`
- Empty state cuando no hay resultados

### Scenarios

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 5.1 | Usuario presiona Cmd+K | CommandMenu abre, input con foco |
| 5.2 | Usuario escribe "juan" | Debounce 300ms, fetch leads matching "juan", muestra hasta 20 |
| 5.3 | Usuario selecciona resultado | Navega a `/leads/{id}` |
| 5.4 | Sin resultados | Muestra "No se encontraron leads" |
| 5.5 | Error de API | Toast error, input sigue funcional |
| 5.6 | Usuario presiona Escape | Cierra CommandMenu |
| 5.7 | Usuario escribe muy rápido | Solo se ejecuta el último fetch (debounce cancela anteriores) |

### Performance
- Debounce: 300ms
- Límite: 20 resultados
- Cache: no cache (datos pueden cambiar)

---

## 6. Undo Toast on Delete

### Requirements
- Al eliminar lead, mostrar Sonner toast con botón "Deshacer"
- Al hacer clic en Deshacer, re-crear el lead
- Toast auto-dismiss segundos después
- Undo no funciona post-dismiss o recarga

### Scenarios

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 6.1 | Usuario elimina lead | Toast: "Lead eliminado" + botón "Deshacer" |
| 6.2 | Usuario hace clic en Deshacer | Lead se re-crea con mismos datos, toast desaparece |
| 6.3 | Toast se cierra solo | Lead permanece eliminado |
| 6.4 | Usuario recarga página antes de deshacer | Lead eliminado permanentemente |
| 6.5 | Error al deshacer (re-crear falla) | Toast error: "No se pudo recuperar el lead" |

### Implementation Notes
- Guardar objeto Lead completo en variable antes de delete
- Al deshacer: `repository.create(savedLead)` 
- Si el ID original es UUID, generar nuevo UUID (no reusar el mismo)
