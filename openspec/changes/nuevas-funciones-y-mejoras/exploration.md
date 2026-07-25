# Exploration: Nuevas funciones y mejoras

> Fecha: 2026-07-24
> Propósito: Investigar estado actual del CRM y determinar qué mejoras y funcionalidades abordar como primer slice del change "nuevas funciones y mejoras"

---

## 1. Hallazgos clave

### 1.1 Pipeline Management: backend completo, UI inexistente

- **Backend listo**: Tablas `pipelines` y `pipeline_stages` en DB, `PipelineRepository` con CRUD completo + `reorderStages`, API REST funcional con 7 endpoints (GET/POST pipelines, GET/PATCH/DELETE pipeline, GET/POST stages, PATCH/DELETE stage, PUT reorder)
- **Seed automático**: La migración `20240509195500` crea un pipeline por defecto con 6 etapas (Nuevo, Contactado, Interesado, Propuesta, Ganado, Perdido)
- **UI faltante**: No hay ninguna página o componente para crear/editar/reordenar pipelines o stages. La page `/pipeline` usa `pipelines[0]` sin selector. Si un usuario quiere cambiar el nombre de una etapa, necesita hacer una migración SQL manual.

### 1.2 La tabla de leads no escala

- `SupabaseLeadRepository.getAll()` hace `select('*, lead_tags(tags(*)), notes_data:notes(*)')` SIN paginación. Con >100 leads empieza a degradarse.
- Los filtros (búsqueda, etapa, tag) son 100% client-side via `React.useMemo`. No persisten en URL (search params).
- El `BaseRepository` ya tiene soporte para `limit` y `range` via `findAll`, pero `LeadRepository.getAll()` no los expone.

### 1.3 UX inconsistente en estados vacíos y de carga

- `EmptyState` component existe (con soporte para icon, title, description, action CTA) y se usa en leads table y pipeline columns, pero NO en activities page (usa inline text), dashboard (usa inline), lead detail sidebar info sections.
- Loading states: LeadWorkspace usa skeleton para notas, LeadsTable usa skeleton, pero otras secciones no muestran nada durante carga.
- Acciones destructivas: El diálogo de confirmación para eliminar lead existe, pero NO hay undo toast ni optimistic update rollback visible.

### 1.4 CommandMenu subutilizado

- cmdk (command palette) ya está instalado y el componente CommandMenu existe con CommandDialog
- Solo tiene 4 comandos de navegación y 1 acción rápida ("Nuevo Lead")
- No busca datos (leads, ideas) — es solo un menú de accesos directos
- El placeholder dice "Escribe un comando o busca..." pero no busca nada

### 1.5 Deuda técnica identificada

| Issue | Archivo | Severidad |
|-------|---------|-----------|
| `getAll()` sin paginación con joins pesados | `SupabaseLeadRepository.ts:22` | Alta |
| Pipeline siempre usa `pipelines[0]` sin selector | `pipeline/page.tsx:22-23` | Media |
| `update()` no permite limpiar campos opcionales (usa `if(valor)` en vez de `!== undefined`) | `SupabaseLeadRepository.ts:77-98` | Alta (bug) |
| `JSON.parse(JSON.stringify(ideas))` para deep clone | `IdeasView.tsx` | Media |
| LeadForm usa `stage.name` como value (frágil si cambia nombre) | `LeadForm.tsx:197` | Media |
| LeadStatus es solo `string` — pierde type safety | `Lead.ts:4` | Baja |
| Mensajes fuera del group `(dashboard)` — no comparte layout | `/messages/page.tsx` | Baja |
| user_secrets almacena tokens Instagram sin encriptar | docs/crm-analysis.md | Media |

---

## 2. Áreas de mejora priorizadas

### Bajo esfuerzo / Alto impacto

| Mejora | Esfuerzo | Impacto | Archivos afectados |
|--------|----------|---------|-------------------|
| **Search params para filtros** | Bajo (~1h) | Alto — persistencia de filtros al navegar | `LeadsTable.tsx`, `leads/page.tsx` |
| **Empty states con CTA** | Bajo (~30min) | Alto — mejor onboarding | Activities page, dashboard, lead detail |
| **Undo toast en delete** | Bajo (~30min) | Alto — seguridad psicológica | `LeadsTable.tsx` |
| **CommandMenu con búsqueda de leads** | Medio (~2h) | Alto — productividad diaria | `CommandMenu.tsx`, API de búsqueda |
| **Selector de pipeline en /pipeline** | Bajo (~1h) | Alto — usar pipeline real, no solo el primero | `pipeline/page.tsx`, `PipelineBoard.tsx` |

### Esfuerzo medio / Alto impacto

| Mejora | Esfuerzo | Impacto | Dependencias |
|--------|----------|---------|-------------|
| **Pipeline Management UI** | Medio (~4h) | Alto — elimina dependencia de SQL | Backend listo, solo UI |
| **Paginación server-side** | Medio (~4h) | Alto — escala a cientos de leads | Modificar `LeadRepository.getAll()` + refactor `LeadsTable` |
| **Breadcrumbs** | Bajo (~1h) | Medio — navegación | Nuevo componente + agregar a layouts |

### Alto esfuerzo / Alto impacto (para slices futuros)

| Mejora | Esfuerzo | Razón |
|--------|----------|-------|
| **CSV Import/Export** | Alto (~6h) | Múltiples componentes (subida, mapeo, descarga) |
| **Email integration** | Muy alto | Dependencia externa (Resend/SendGrid) |
| **Lead Scoring** | Medio (~3h) | Requiere schema nuevo + UI |
| **Automatización/Reglas** | Muy alto | Motor de reglas + UI |

---

## 3. Recomendación de alcance — Primer slice

Propongo que el change "nuevas funciones y mejoras" incluya **6 items de bajo/medio esfuerzo** que dan el mayor retorno inmediato, organizados en orden de implementación:

### Slice 1 (Core UX - sesión 1)
1. **Pipeline Management UI** — Página de settings de pipeline con crear/editar/reordenar/eliminar stages. El backend ya existe. Añadir sección en `/settings/pipeline` o como página independiente.
2. **Selector de pipeline** — En la página `/pipeline`, permitir seleccionar qué pipeline ver (hoy hardcodea `pipelines[0]`)

### Slice 2 (Productividad diaria - sesión 2)
3. **Search params para filtros** — Persistir `search`, `stage`, `tag` en URL en leads page
4. **CommandMenu con búsqueda de leads** — Agregar búsqueda cross-entity usando API existente
5. **Undo toast para delete** — Sonner toast con acción de deshacer

### Slice 3 (UX consistente - sesión 3)
6. **Empty states con CTA** — Pasar todas las páginas a usar `EmptyState` con CTA relevantes
7. **Breadcrumbs** — Componente de navegación jerárquica

### Excluido de este change (para próximos):
- Paginación server-side (requiere refactor más profundo del repositorio y tabla)
- CSV Import/Export (esfuerzo alto, mejor como change separado)
- Lead Scoring (requiere schema nuevo)
- Email integration (dependencia externa)

---

## 4. Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| **Pipeline Management UI puede requerir migraciones si se eliminan stages con leads** | Media | Validar que no haya leads en un stage antes de permitir eliminar, o preguntar a dónde reasignar |
| **CommandMenu con búsqueda puede ser lento sin paginación** | Media | Limitar resultados a 20, usar debounce en búsqueda |
| **El bug de `update()` (no puede limpiar campos) puede afectar LeadForm/LeadPopup** | Alta | Incluir fix en este change: cambiar `if(valor)` por `if(valor !== undefined)` en `SupabaseLeadRepository.update()` |
| **Refactor de leads page para search params puede romper filtros existentes** | Baja | Tests existentes en `__tests__/` cubren PipelineBoard y LeadPopup |

---

## Archivos clave descubiertos

### Pipeline domain
- `src/core/domain/Pipeline.ts` — Interfaces Pipeline, PipelineStage, DTOs
- `src/core/ports/PipelineRepository.ts` — Puerto con CRUD + reorderStages
- `src/infrastructure/repositories/SupabasePipelineRepository.ts` — Implementación completa
- `src/app/api/pipelines/route.ts` — GET (list), POST (create)
- `src/app/api/pipelines/[id]/route.ts` — GET, PATCH, DELETE
- `src/app/api/pipelines/[id]/stages/route.ts` — GET, POST
- `src/app/api/pipelines/[id]/stages/[stageId]/route.ts` — PATCH, DELETE
- `src/app/api/pipelines/[id]/stages/reorder/route.ts` — PUT reorder

### UI actual de pipeline
- `src/app/(dashboard)/pipeline/page.tsx` — Page que usa `pipelines[0]`
- `src/modules/leads/components/PipelineBoard.tsx` — Kanban drag-and-drop
- `src/modules/leads/components/PipelineColumn.tsx` — Columna individual
- `src/modules/leads/components/PipelineCard.tsx` — Card de lead

### Leads
- `src/core/domain/Lead.ts` — Lead entity (status es `string`)
- `src/core/ports/LeadRepository.ts` — Puerto
- `src/infrastructure/repositories/SupabaseLeadRepository.ts` — Implementación (sin paginación)
- `src/app/(dashboard)/leads/page.tsx` — Server component que pasa TODOS los leads
- `src/modules/leads/components/LeadsTable.tsx` — Tabla con filtros client-side
- `src/modules/leads/components/LeadForm.tsx` — Form de creación/edición
- `src/modules/leads/components/LeadPopup.tsx` — Popup de edición rápida
- `src/modules/leads/components/LeadQuickView.tsx` — Quick view sheet

### Shared / UX
- `src/ui/components/CommandMenu.tsx` — Solo 4 comandos, sin búsqueda de datos
- `src/ui/components/EmptyState.tsx` — Componente con action CTA
- `src/ui/layouts/DashboardLayout.tsx` — Sidebar + header + CommandMenu
- `src/ui/providers/RepositoryProvider.tsx` — DI para todos los repos

### Migraciones relevantes
- `supabase/migrations/20240508000000_initial_schema.sql` — Schema original (leads con status CHECK)
- `supabase/migrations/20240509184500_crm_expansion.sql` — pipelines + pipeline_stages + initialize_default_pipeline()
- `supabase/migrations/20240509195500_seed_default_pipeline.sql` — Seed de 6 etapas por defecto
- `supabase/migrations/20260724_drop_leads_status_check.sql` — Drop constraint ahora que status viene de stages
