# 🧠 Mapa de Contexto del Proyecto (AI Agent Map)

Este archivo es la fuente de verdad para cualquier agente de IA que trabaje en **Idea Leads Hub**. Contiene la estructura, arquitectura y reglas críticas del sistema. **Debe actualizarse después de cualquier cambio estructural significativo.**

## 📌 Resumen del Proyecto
CRM Personal para la gestión de leads, ideas de negocio y actividades, construido con Next.js 15 (App Router), Supabase y Arquitectura Hexagonal. Optimizado para despliegue en Cloudflare Pages (Edge Runtime).

## 🏗️ Arquitectura (Hexagonal + Clean Architecture)

- **`src/core/domain/`**: Entidades puras, DTOs y reglas de negocio (sin dependencias externas).
- **`src/core/ports/`**: Interfaces (contratos) para repositorios y servicios.
- **`src/core/application/`**: Casos de uso que orquestan la lógica de negocio.
- **`src/infrastructure/`**: Implementaciones técnicas (Supabase, Repositorios concretos, Base de datos).
- **`src/modules/`**: Módulos funcionales autocontenidos que agrupan UI y lógica específica por feature.
- **`src/app/`**: Rutas de Next.js, API Handlers y configuración de middleware.
- **`src/ui/`**: Sistema de diseño, componentes base (shadcn/ui) y layouts compartidos.

## 📂 Mapa de Archivos Críticos

### Configuración Global
- `.env.example`: Plantilla de variables de entorno (Supabase URL/Keys).
- `package.json`: Scripts de build (`next build`) y dependencias.
- `wrangler.toml`: Configuración de despliegue en Cloudflare Pages.
- `jest.config.mjs`: Configuración de tests (entorno `node`).

### Lógica de Datos (Core)
- `src/core/domain/Lead.ts`: Modelo y DTOs de leads.
- `src/core/domain/Profile.ts`: Modelo de perfil de usuario.
- `src/core/domain/schemas/LeadSchema.ts`: Validaciones Zod para entrada de datos.

### Infraestructura (Persistencia)
- `src/infrastructure/database/server.ts`: Cliente Supabase para Server Components (async).
- `src/infrastructure/database/client.ts`: Cliente Supabase para Browser Components (async).
- `src/infrastructure/repositories/`: Implementaciones de repositorios (Supabase).

### API & Seguridad
- `src/app/api/leads/route.ts`: Endpoint seguro para carga de leads (Edge runtime).
- `src/app/api/auth/login/route.ts`: Endpoint de autenticación (JWT).
- `src/app/api/docs/`: Documentación Swagger/OpenAPI.
- `src/middleware.ts`: Lógica de protección de rutas y auth en Edge Runtime.

### UI & Layouts
- `src/ui/layouts/DashboardLayout.tsx`: Layout principal con sidebar y visibilidad de usuario.
- `src/modules/shared/presentation/components/ProfileForm.tsx`: Gestión de perfil de usuario.

### Kanban Boards (Drag & Drop)
- **PipelineBoard** (`src/modules/leads/components/PipelineBoard.tsx`): Kanban de leads con drag & drop cross-column vía @dnd-kit. Al clickear una tarjeta abre `LeadPopup.tsx` (Sheet) con formulario editable, stage selector, notas e historial de actividades.
- **IdeasBoard** (`src/modules/ideas/presentation/components/IdeasBoard.tsx`): Kanban de ideas con `useSortable` en cada card, `handleDragOver` para movimiento cross-column y `arrayMove` para reorden intra-columna. Persistencia vía `MoveIdeaStatus` use case con error rollback.

### Lead Management
- `src/modules/leads/components/LeadPopup.tsx`: Sheet lateral con react-hook-form para editar leads, cambiar estado, agregar notas y ver actividad. Se abre al clickear una tarjeta en PipelineBoard.

### Instagram
- `src/app/(dashboard)/leads/[id]/page.tsx`: Muestra `@{instagramHandle}` como link clickeable a `https://instagram.com/{handle}` + scoped ID cuando el lead tiene datos de Instagram.

## ⚠️ Reglas Críticas para Agentes

1. **Edge Runtime**: Los API routes y páginas del dashboard deben incluir `export const runtime = 'edge'`.
2. **Next.js 16+ en Cloudflare**: Usar `middleware.ts` para conservar Edge Runtime; evitar `proxy.ts` porque Next.js 16 lo ejecuta en Node.js runtime. No agregar `export const runtime = "edge"` al middleware: Next.js 16.2 lo rechaza durante el build.
3. **Async Cookies**: El cliente de base de datos de servidor debe ser `async` debido a `cookies()` en Next.js 15+.
4. **Validación**: Siempre validar entradas externas con Zod usando esquemas estrictos (`.strict()`).
5. **Arquitectura**: Nunca importar infraestructura (`src/infrastructure`) dentro del core (`src/core`).
6. **Tests**: Ejecutar `pnpm test` antes de entregar cambios. Usar entorno `node` para lógica pura.

## 🛠️ Comandos Frecuentes
- `pnpm dev`: Iniciar desarrollo local.
- `pnpm run build`: Verificar tipos y compilación.
- `pnpm test`: Ejecutar suites de pruebas unitarias.
- `pnpm pages:build`: Simular build de Cloudflare Pages.
