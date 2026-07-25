# SDD Design: nuevas funciones y mejoras

**Status**: draft
**Date**: 2026-07-24

---

## Architecture Overview

Estos cambios son aditivos sobre la arquitectura existente (Hexagonal / Screaming Architecture). No requieren nuevos patrones arquitectónicos ni cambios en la capa de dominio.

```
┌──────────────────────┐
│    UI Layer          │  Componentes nuevos/modificados
│  (LeadForm,          │
│   LeadWorkspace,     │
│   PipelineSettings,  │
│   CommandMenu)       │
└──────┬───────────────┘
       │ hooks / stores
┌──────▼───────────────┐
│  Application Layer   │  usePipelineRepository, useLeadRepository
│  (providers, hooks)  │
└──────┬───────────────┘
       │ repository interface
┌──────▼───────────────┐
│  Infrastructure      │  SupabasePipelineRepository
│  (repositories)      │  SupabaseLeadRepository (fix)
└──────────────────────┘
```

---

## 1. Pipeline Management UI

### Component Tree
```
/app/pipeline/page.tsx          → Server component, fetches pipelines
└── PipelineSettings            → Client component
    ├── PipelineSelector        → Select para elegir pipeline (reused)
    ├── StageList               → Lista de etapas con drag & drop
    │   └── StageItem           → Etapa individual (drag handle, name, delete)
    │       ├── InlineRename    → Editar nombre inline
    │       └── DeleteButton    → Eliminar (con confirmación)
    ├── AddStageButton          → Botón + input inline
    └── DeletePipelineDialog    → Confirmación al eliminar pipeline
```

### Data Flow
1. `PipelineSettings` monta → `pipelineRepo.getAll()` → set state
2. CRUD operations llaman directo a `pipelineRepo.{createStage, updateStage, deleteStage, reorderStages}`
3. Cada operación → optimistic update → API call → revert on error
4. Drag & drop → onDragEnd → calcular nuevo orden → `reorderStages()` → actualizar UI

### Routing
- Nueva ruta: `/pipeline` como página independiente (no modal)
- Sidebar: agregar link "Pipeline" a la navegación principal

---

## 2. Pipeline Selector

### Changes to LeadWorkspace.tsx
- Agregar `<Select>` en el header, antes del StageSelector
- Estado `selectedPipelineId` (default: `lead.pipelineId` o `pipelines[0].id`)
- Al cambiar pipeline:
  1. `pipelineRepo.getStages(newPipelineId)` → actualizar stages
  2. Si `currentStage` no existe en nuevo pipeline → warning toast + ofrecer reasignar

### State
```typescript
const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
  lead.pipelineId ?? null
);
```

---

## 3. Fix update() bug — SupabaseLeadRepository

### Current Code (broken)
```typescript
const updates: Record<string, any> = {};
if (data.name) updates.name = data.name;
if (data.website) updates.website_url = data.website;
// "" → falsy → never sent → column never cleared
```

### Fixed Code
```typescript
const updates: Record<string, any> = {};
if (data.name !== undefined) updates.name = data.name;
if (data.website !== undefined) updates.website_url = data.website || null;
// "" → sent as null → column cleared
```

### Affected Method
- `SupabaseLeadRepository.update(id, data)` — lines ~45-90

---

## 4. Search Params for LeadsTable

### Sync Architecture
```
URL (searchParams) ←──→ useLeadsStore ──→ LeadsTable (filtrado)
        ↑                      ↓
   useRouter.replace()    server fetch
```

### Implementation
1. En `LeadsTable` (o página `/leads`), leer `searchParams` del server component
2. Pasar como initial state al store
3. Store escribe a URL via `useRouter.replace()` en cada cambio de filtro
4. Al cargar página, si hay `searchParams`, aplicarlos como filtros iniciales

### Key Files
- `src/app/(dashboard)/leads/page.tsx` — leer params, pasarlos al store
- `src/modules/leads/store/useLeadsStore.ts` — sincronizar con URL
- `src/modules/leads/components/LeadsTable.tsx` — usar filtros del store

---

## 5. CommandMenu with Lead Search

### Component Structure
```
CommandMenu (existing) → agregar comando "Buscar leads..."
└── LeadSearchDialog  → cmdk.Dialog con input
    └── ResultList    → cmdk.List con items dinámicos
        └── LeadItem  → cmdk.Item por cada lead
```

### Data Flow
```
Input change → debounce 300ms → fetch(`/api/leads/search?q=...`) → setResults
                                                                    ↓
                                                            cmdk.List re-render
```

### API Endpoint
- Usar endpoint existente o crear `GET /api/leads/search?q={term}`
- Devolver: `{ id, name, company, status }` — max 20
- La query usa `ilike` sobre `name` y `company`

---

## 6. Undo Toast on Delete

### Flow
```
Delete click
  → saveLead = structuredClone(lead)   ← en memoria
  → repository.delete(id)
  → toast("Lead eliminado", { action: { label: "Deshacer", onClick: deshacer } })
  
deshacer()
  → repository.create(saveLead)
  → toast.success("Lead recuperado")
  → refresh list
```

### Key Detail
- Al re-crear, generar nuevo UUID (no reusar el original)
- Si hay campos unique (email), pueden fallar — manejar con toast.error
