# CRM Analysis — IdeaLeadsHub

> Generado: 2026-07-24
> Propósito: Identificar features faltantes, problemas de UX/fluidez y mejoras de diseño para priorizar y abordar en sprints futuros.

---

## Estado Actual (Resumen)

| Área | Estado |
|------|--------|
| Auth | Email/password via Supabase |
| Leads | CRUD completo, tabla con filtros, detalle, edición |
| Pipeline | Kanban drag-and-drop, múltiples etapas con colores |
| Tags | Asignables a leads e ideas |
| Notas | Timeline por entidad |
| Actividades | TODOs con completado, pendientes |
| Ideas | Board/List view, CRUD, filtros |
| Dashboard | Stats, pipeline analytics, leads recientes |
| Instagram | Send/receive DMs, OAuth, webhook, conversaciones |
| Búsqueda global | CommandMenu (⌘K) básico |
| Perfiles | Avatar, nombre, email |

---

## 1. 🟥 Features CRÍTICAS Faltantes (CRM Standard)

### 1.1 Email Integration
- **No hay**: No se pueden enviar/recibir correos desde el CRM
- **Impacto**: El canal de comunicación más importante no está integrado
- **Sugerencia**: Integración con Gmail/Outlook via API, o con Resend/SendGrid para envío transaccional. Almacenar historial de emails en activities.

### 1.2 Lead Scoring / Cualificación
- **No hay**: No hay forma de puntuar o calificar leads (hot/warm/cold)
- **Impacto**: Dificultad para priorizar seguimiento
- **Sugerencia**: Campo `score` (0-100) en leads, calculado por reglas (actividad reciente, etapa, valor estimado, interacción en Instagram). Mostrar badge de "caliente/tibio/frío".

### 1.3 Importación/Exportación CSV
- **No hay**: No se pueden importar leads desde CSV ni exportar la base
- **Impacto**: Migración de datos y backups manuales imposibles
- **Sugerencia**: Botón "Importar CSV" en /leads con mapeo de columnas, y "Exportar" que descargue leads filtrados como CSV.

### 1.4 Reporting y Analytics
- **No hay**: Solo estadísticas básicas en dashboard. Sin reportes exportables
- **Impacto**: No se puede medir conversión, fuente de leads, pipeline velocity
- **Sugerencia**:
  - Tasa de conversión por etapa (funnel chart)
  - Leads por fuente (pie chart)
  - Tiempo promedio en cada etapa
  - Valor del pipeline (suma de estimatedValue por etapa)
  - Exportar reportes a PDF/CSV

### 1.5 Pipeline Management UI
- **No hay**: No se pueden crear/editar/reordenar pipelines o stages desde la UI
- **Impacto**: Dependencia de migraciones SQL para cambios en el pipeline
- **Sugerencia**: Página "Configuración de Pipeline" con drag-to-reorder, crear/renombrar/eliminar stages, definir colores y closed/won flags.

### 1.6 Webhooks / Automatización
- **No hay**: Sin reglas de automatización (ej: "al pasar a Interesado, crear actividad de seguimiento")
- **Impacto**: Trabajo manual repetitivo
- **Sugerencia**: Sistema simple de reglas: cuando status cambia a X → crear actividad / enviar email / cambiar etapa. Similar a workflows de PipeDrive o HubSpot.

### 1.7 Búsqueda Global Efectiva
- **Actual**: CommandMenu solo tiene accesos directos, no busca datos
- **Impacto**: No se puede encontrar un lead por nombre desde cualquier página
- **Sugerencia**: CommandMenu con búsqueda cross-entity (leads, ideas, tags, conversaciones) via API.

### 1.8 Calendario / Programación
- **No hay**: Las actividades tienen due_date pero no hay vista de calendario
- **Impacto**: No se puede planificar visualmente la semana
- **Sugerencia**: Vista de calendario (semanal/mensual) para actividades con drag para reprogramar.

---

## 2. 🟧 UX & Fluidez — Problemas Detectados

### 2.1 Paginación y Carga de Datos
- **Problema**: `/leads` carga TODOS los leads en una tabla sin paginación. Con pocos datos funciona, pero escala mal (>100 leads).
- **Fix sugerido**: Server-side pagination con cursor o offset, filtros que van a la URL (search params), y tabla virtualizada (TanStack Table + virtualization).

### 2.2 Estados de Carga Inconsistentes
- **Problema**: Algunas páginas tienen skeletons (LeadWorkspace notas), otras no muestran nada mientras cargan (messages page conversaciones). El dashboard es server-side, carga todo de una.
- **Fix sugerido**: Patrón consistente: Skeleton mientras carga, EmptyState si no hay datos, error boundary con retry si falla.

### 2.3 Feedback de Acciones
- **Problema**: 
  - Eliminar lead no tiene confirmación visible (el Dialog aparece pero no hay undo)
  - Cambiar etapa en pipeline drag-and-drop no tiene feedback visual claro de éxito
  - Instagram send no muestra progreso mientras el mensaje se envía
- **Fix sugerido**: 
  - Toast con "Deshacer" para acciones destructivas
  - Optimistic updates con revert on error (como ya existe en pipeline board)
  - Loading states inline en botones

### 2.4 Navegación y Rutas
- **Problema**:
  - No hay breadcrumbs
  - El botón "Volver" en lead detail va a `/leads` pero no recuerda filtros/página anterior
  - Messages page no tiene URL para conversaciones específicas (no se puede compartir/enlazar)
- **Fix sugerido**:
  - Breadcrumbs en páginas de detalle
  - Search params para filtros en tabla de leads (persistencia)
  - URL por conversación `/messages/[id]`

### 2.5 Filtros y Búsqueda Limitados
- **Problema**:
  - Leads: búsqueda client-side, filtros por etapa y tag (OK básico pero sin combinación avanzada)
  - Ideas: solo búsqueda por título/descripción
  - Actividades: sin filtros (solo pendientes)
  - Dashboard: sin filtros de fecha
- **Fix sugerido**: Uniformizar filtros: búsqueda + filtros combinables + persistencia en URL.

### 2.6 Responsive y Mobile
- **Problema**: 
  - La tabla de leads no es responsive en mobile (horiz scroll)
  - El pipeline board horizontal en mobile requiere swipe
  - Messages page tiene layout responsive pero la conversación en sidebar no funciona bien en pantallas chicas
- **Fix sugerido**: 
  - Leads table: card view en mobile
  - Pipeline: scroll horizontal con snap points
  - Messages: full-screen conversation en mobile

### 2.7 Onboarding y Empty States
- **Problema**: 
  - Usuario nuevo sin datos ve páginas vacías con mensajes genéricos
  - No hay "primeros pasos" o tour guiado
  - El login no tiene opción de registro ni "olvidé mi contraseña"
- **Fix sugerido**:
  - Empty states con CTA (ej: "Crea tu primer lead" con link a /leads/new)
  - Onboarding checklist: "Conecta Instagram", "Crea un pipeline", "Agrega tu primer lead"
  - Auth: registro, forgot password, magic link

### 2.8 CommandMenu (⌘K) Mejorable
- **Problema**: Solo tiene 4 comandos. No busca leads, no tiene comandos de acción.
- **Fix sugerido**: 
  - Búsqueda global cross-entity
  - Acciones: "Nuevo lead", "Nueva idea", "Nueva actividad"
  - Navegación a leads/ideas recientes
  - Atajos de teclado tipo "g → d" (go to dashboard), "g → l" (go to leads)

---

## 3. 🟨 Diseño Visual y Consistencia

### 3.1 Identidad Visual
- **Problema**: El logo es solo texto "IdeaLeadsHub" sin marca gráfica. Los colores son los defaults de shadcn/ui (slate). No hay personalidad.
- **Sugerencia**: Logo/icono, paleta de colores propia, tipografía distintiva, favicon.

### 3.2 Densidad de Información
- **Problema**: La tabla de leads tiene buen spacing pero la vista de detalle desperdicia espacio (grid 1:3, la columna izquierda es angosta). El popup de LeadPopup tiene mucho scroll.
- **Sugerencia**: 
  - Lead detail: layout más balanceado
  - LeadPopup: tabs horizontales mejor organizados
  - Pipeline cards: mostrar más info (valor, próxima acción)

### 3.3 Animaciones y Transiciones
- **Problema**: Transiciones mínimas. El sidebar slide-in tiene 300ms pero es la única animación noticeable.
- **Sugerencia**: 
  - Fade-in de páginas
  - Transiciones en drag-and-drop (ya existe DragOverlay, mejorarlo)
  - Micro-interacciones en botones y cards (hover, active states mejor definidos)
  - Loading skeletons con animación pulse (ya existe, extender)

### 3.4 Tabla de Leads
- **Problema**: Columna de tags muestra hasta 2 y el resto con "+N" pero el tooltip/popover para ver todos no es intuitivo. El menú de acciones (3 dots) es pequeño target en mobile.
- **Sugerencia**: 
  - Quick actions row al hover (editar, eliminar, ver)
  - Tags inline con popover on hover
  - Row expansion para más info sin navegar a detalle

### 3.5 Pipeline Board
- **Problema**: Sin scroll horizontal visible (no hay indicador de que se puede scroll). Stage "cerrado" o "ganado" no tiene distinción visual clara.
- **Sugerencia**:
  - Scroll indicators sutiles (gradients en los bordes)
  - Stage cerrado: estilo atenuado, stage ganado: badge verde con check
  - Límite máximo de columnas visibles antes de overflow

---

## 4. 🟩 Features Nice-to-Have

### 4.1 Notificaciones
- Notificaciones in-app y push para nuevos mensajes, actividades vencidas, cambios de etapa

### 4.2 Colaboración Multi-usuario
- Compartir leads, asignar tareas, comentarios en leads

### 4.3 Plantillas de Mensajes
- Plantillas reutilizables para outreach en Instagram/Email

### 4.4 Integración WhatsApp/Telegram
- Además de Instagram, agregar canales de mensajería

### 4.5 Vista Calendario
- Actividades en formato calendario (semanal/mensual)

### 4.6 Historial de Cambios (Audit Log)
- Mostrar en lead detail quién cambió qué y cuándo (ya hay tabla audit_logs pero no se muestra en UI)

### 4.7 Copia de Seguridad
- Backup automático de datos exportable

### 4.8 Modo Oscuro / Tema
- Paleta clara/oscura toggleable (shadcn ya lo soporta en parte, faltan ajustes)

---

## 5. Priorización Sugerida

| Prioridad | Feature | Esfuerzo | Impacto |
|-----------|---------|----------|---------|
| 🟥 P0 | Paginación en tabla leads | Media | Alto |
| 🟥 P0 | Search params persistencia filtros | Baja | Alto |
| 🟥 P0 | CommandMenu con búsqueda global | Media | Alto |
| 🟥 P1 | Importar/Exportar CSV | Media | Alto |
| 🟥 P1 | Pipeline management UI | Alta | Alto |
| 🟧 P2 | Estados de carga consistentes | Media | Medio |
| 🟧 P2 | Email integration básica | Alta | Alto |
| 🟧 P2 | Filtros en actividades e ideas | Baja | Medio |
| 🟧 P2 | Empty states con CTA | Baja | Medio |
| 🟧 P3 | Breadcrumbs y navegación | Baja | Medio |
| 🟧 P3 | Confirmación para acciones destructivas | Baja | Medio |
| 🟨 P3 | Identidad visual (logo, colores, favicon) | Baja | Medio |
| 🟨 P3 | Responsive mobile | Alta | Medio |
| 🟩 P4 | Reporting y analytics | Alta | Medio |
| 🟩 P4 | Lead scoring | Media | Medio |
| 🟩 P4 | Automatización/reglas | Alta | Medio |
| 🟩 P4 | Notificaciones | Alta | Medio |

---

## 6. Technical Debt Observado

- `src/modules/ideas/presentation/views/IdeasView.tsx` usa `JSON.parse(JSON.stringify(ideas))` para deep clone (server → client serialization hack)
- Algunos componentes usaban `new XRepository(supabase)` directo (ya refactorizado a RepositoryProvider en su mayoría)
- Las migraciones SQL tienen timestamps inconsistentes (`20240508...`, `20240715...`, `20260723...`)
- `database.types.ts` probablemente necesita regenerarse si hay cambios de schema recientes
- La tabla `user_secrets` almacena tokens de Instagram de forma no encriptada (solo RLS)
- No hay tests para Instagram messaging flow, solo para PipelineBoard y LeadPopup
