# Propuesta: Repository Dependency Injection — Context-based DI

## Resumen ejecutivo

22 componentes client-side violan el Dependency Inversion Principle instanciando `new Repositorio(supabase)` directamente. Esto acopla la UI a implementaciones concretas de infraestructura, impide testear componentes con repositorios mock, y hace que cualquier cambio en los repositorios (constructor, dependencias) cascade a dos docenas de archivos.

Se introduce un `RepositoryProvider` vía React Context que provee implementaciones de repositorios a toda la app mediante hooks custom. Cada módulo expone una factory que centraliza la instanciación de sus repos y casos de uso. Los componentes consumen repositorios vía hooks — nunca más con `new`.

## Drivers

- 22 componentes acoplados a `new XRepository(supabase)` — in testeables sin instancia real de Supabase
- Cada nuevo repositorio o cambio de firma exige modificar N componentes en lugar de 1 provider
- `docs/architecture.md` exige Clean Architecture pero el codebase no la aplica consistentemente
- Leads y Shared no tienen factories — toca crearlas

## Enfoque técnico

### RepositoryProvider
Un provider global (React Context) que recibe las implementaciones concretas como props al iniciar la app. Provee 5 repositorios a todo el árbol de componentes:

```tsx
// src/ui/providers/RepositoryProvider.tsx
interface Repositories {
  lead: LeadRepository;
  note: NoteRepository;
  tag: TagRepository;
  pipeline: PipelineRepository;
}
```

### Hooks custom
Cada repositorio expone un hook:

- `useLeadRepository()` → `LeadRepository`
- `useNoteRepository()` → `NoteRepository`
- `useTagRepository()` → `TagRepository`
- `usePipelineRepository()` → `PipelineRepository`

Los hooks hacen `useContext(RepositoryContext)` y lanzan error si se usan fuera del provider.

### Estructura de módulos (antes vs después)

**Antes:**
```
LeadPopup.tsx → const repo = new SupabaseLeadRepository(supabase) ← DIP violation
```

**Después:**
```
LeadPopup.tsx → const repo = useLeadRepository() ← DIP satisfecho
                                  ↑
RepositoryProvider (inyecta en root layout)
                                  ↑
factories: leadModule(), sharedModule(), activitiesModule(), ideasModule()
```

Factories existentes (`ideaModule()`, `activitiesModule()`) se mantienen. Se crean:
- `src/modules/leads/index.ts` → `leadModule()`
- `src/modules/shared/index.ts` → `notesModule()` (factoria específica para notas)
- Se instancia todo en el provider y se pasa a los hijos

### Flujo de mock para tests
Los hooks permiten mockear a nivel de Context en tests unitarios sin tocar Supabase:

```tsx
const mockRepo = { getAll: jest.fn(), ... };
render(<RepositoryProvider repos={{ lead: mockRepo }}><Component /></RepositoryProvider>);
```

## Capacidades

### Nuevas Capacidades
None — refactor puro. No cambia comportamiento observable.

### Capacidades Modificadas
None — sin cambios en requirements a nivel spec.

## Alcance

### Incluye
- Crear `RepositoryProvider` + contexto + hooks custom (4 hooks)
- Crear `leadModule()` factory en `src/modules/leads/index.ts`
- Crear `notesModule()` factory en `src/modules/shared/index.ts`
- Refactorizar 22 componentes para usar hooks en lugar de `new`
- Mover `TagSelector` compartido a infraestructura compartida si hay duplicación
- Verificar visualmente PipelineBoard, formularios y popups

### No incluye
- Refactor de server components (no violan la regla, no tocar)
- Cambios en la API REST (no afectada)
- Migración de tipos de dominio o esquemas
- Tests unitarios de los 22 componentes (se validan con TDD existente + verificación manual)
- Module factories para Profile (no usado directamente en UI client-side)

## Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Provider no envuelve algún layout | Media | Buscar `new Repositorio` residual con grep post-migración |
| Componente pierde repositorio en test porque falta wrapper | Media | Agregar helper `renderWithProviders` en test utils |
| Duplicación de `TagSelector` (shared vs ideas) | Baja | Evaluar si uno puede importar al otro; si no, dejarlos como están |
| Regresión en flujos de drag & drop (PipelineBoard) | Media | Probar manualmente arrastrar leads entre columnas |

## Plan de reversión

Cada commit es independientemente reversible. El PR completo se revierte con `git revert --no-commit HEAD~1`. Los componentes refactorizados mantienen las interfaces de repositorio — la reversión restaura los `new Repositorio(supabase)` sin pérdida de datos.

## Dependencias

Ninguna — todo es TypeScript nativo, no requiere paquetes nuevos.

## Criterios de éxito

- [ ] `pnpm build` pasa (type check + build)
- [ ] `pnpm test` pasa (tests existentes + nuevos)
- [ ] Zero `new XRepository(supabase)` en archivos client-side de `src/modules/`
- [ ] PipelineBoard responde a drag & drop correctamente (verificación manual)
- [ ] Formularios de leads, notas y tags persisten datos correctamente
- [ ] Provider + hooks funcionan en tests con mock de contexto
