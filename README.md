# Idea Leads Hub

Idea Leads Hub es un CRM personal diseñado para gestionar leads e ideas de negocio de manera eficiente. La plataforma permite organizar el flujo de ventas, realizar el seguimiento de actividades y transformar ideas en oportunidades reales, todo bajo una arquitectura sólida y escalable.

## 🚀 Características Principales

-   **Gestión de Leads**: Registro y seguimiento detallado de prospectos.
-   **Pipeline de Ventas**: Tablero Kanban para leads con drag & drop entre columnas y popup inline para editar, cambiar estado, agregar notas y ver historial de actividades.
-   **Gestión de Ideas**: Tablero Kanban para ideas con drag & drop entre estados (cross-column y reorden intra-columna), persistencia con error rollback.
-   **Seguimiento de Actividades**: Registro de llamadas, correos, reuniones, tareas e Instagram DMs.
-   **Integración con Instagram**: Envío y recepción de mensajes DM vía Meta API, timeline de conversaciones por lead, auto-DM en transiciones de estado, handle clickeable en la ficha del lead, lista de conversaciones agrupadas por lead, página de mensajes dedicada con acciones de eliminar y vincular leads, y badge de notificaciones no leídas en tiempo real.
-   **API REST Completa**: ~35 endpoints para todas las entidades, con autenticación JWT, rate limiting y logging estructurado.
-   **Documentación Interactiva**: Documentación de la API integrada con Swagger UI (OpenAPI 3.0).
-   **275 Tests Automatizados**: Tests unitarios y de integración con Jest + React Testing Library.

## 🏗️ Arquitectura

El proyecto está construido siguiendo los principios de **Arquitectura Hexagonal** y **Clean Architecture**:

-   `src/core/` — Entidades, puertos, casos de uso (lógica de negocio pura).
-   `src/infrastructure/` — Adaptadores de base de datos (Supabase), repositorios concretos.
-   `src/modules/` — Módulos por dominio (ideas, activities) con su propia UI e infraestructura.
-   `src/ui/` — Componentes de presentación reutilizables (shadcn/ui).
-   `src/lib/` — Utilidades compartidas (logger, API helpers).
-   `src/app/` — Next.js App Router (rutas de página + API endpoints).

Incluye:
-   `BaseRepository` compartido que elimina boilerplate en los 7 repositorios.
-   Tipado fuerte con `Database` interface generada desde las migraciones SQL.
-   Errores tipados (`NotFoundError`, `ConflictError`, `UnauthorizedError`, `DatabaseError`).
-   `apiHandler` wrapper con rate limiting, auth centralizada y logging.

Para más detalles, consulta la [Guía de Arquitectura](./docs/architecture.md).

## 🛠️ Tecnologías

-   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
-   **Lenguaje**: TypeScript (strict mode)
-   **Base de Datos & Auth**: [Supabase](https://supabase.com/)
-   **Estilos**: Tailwind CSS + shadcn/ui
-   **Validación**: Zod
-   **Estado**: Zustand + React Query (@tanstack/react-query)
-   **Drag & Drop**: @dnd-kit (Pipeline de leads + Board de ideas)
- **Testing**: Jest + React Testing Library (275 tests)
-   **CI/CD**: GitHub Actions (type-check, lint, tests en cada PR)

## 📋 Requisitos Previos

-   Node.js 22+ (ver `.nvmrc`)
-   pnpm 8+ (ver `package.json` → `packageManager`)
-   Una cuenta en Supabase

## 🔧 Instalación y Configuración

1.  **Clonar el repositorio**:
    ```bash
    git clone <url-del-repositorio>
    cd idea-leads-hub
    ```

2.  **Inicializar Node.js con la versión correcta**:
    ```bash
    nvm use
    # o instalá la versión del .nvmrc manualmente
    ```

3.  **Instalar dependencias**:
    ```bash
    pnpm install
    ```

4.  **Configurar variables de entorno**:
    Copia el archivo de ejemplo y rellena tus credenciales de Supabase:
    ```bash
    cp .env.example .env.local
    ```
    Variables necesarias:
    -   `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase.
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima para el cliente.
    -   `NEXT_PUBLIC_APP_URL`: URL base de la aplicación (ej: `http://localhost:3000`).

    Variables de integración con Instagram (opcionales, necesarias para usar mensajería):
    -   `META_APP_ID`: ID de tu app en Meta Developers.
    -   `META_APP_SECRET`: Secreto de la app en Meta Developers.
    -   `META_VERIFY_TOKEN`: Token de verificación para el webhook de Meta.
    -   `TOKEN_ENCRYPTION_KEY`: Clave AES-256 (32 caracteres) para encriptar tokens en Supabase.

5.  **Preparar la Base de Datos**:
    Ejecuta las migraciones de la carpeta `supabase/migrations` en el SQL Editor de tu proyecto Supabase para crear las tablas, políticas de RLS y funciones necesarias.

6.  **Iniciar el servidor de desarrollo**:
    ```bash
    pnpm dev
    ```

## 🔌 API REST

La plataforma expone una API REST privada. Todos los endpoints (excepto `/api/auth/login`) requieren autenticación via header `Authorization: Bearer <token>` (JWT de Supabase). Rate limit: 50 requests/minuto por IP.

La especificación completa sigue el estándar **OpenAPI 3.0** y está disponible en `/api/docs/openapi.json`. También podés explorarla interactivamente en `/api/docs` (Swagger UI).

### Auth

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | ❌ | Obtener token JWT (email + password) |

### Profile

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/profile` | Obtener perfil del usuario actual |
| PUT | `/api/profile` | Actualizar perfil |

### Leads

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/leads` | Listar leads (filtros: `status`, `q`) |
| POST | `/api/leads` | Crear lead (campos en español, backward compat) |
| GET | `/api/leads/:id` | Obtener lead |
| PATCH | `/api/leads/:id` | Actualizar lead (campos en inglés) |
| DELETE | `/api/leads/:id` | Eliminar lead |
| PATCH | `/api/leads/:id/status` | Cambiar estado |

### Ideas

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/ideas` | Listar ideas (filtros: `status`, `leadId`) |
| POST | `/api/ideas` | Crear idea |
| GET | `/api/ideas/:id` | Obtener idea |
| PATCH | `/api/ideas/:id` | Actualizar idea |
| DELETE | `/api/ideas/:id` | Eliminar idea |
| PATCH | `/api/ideas/:id/status` | Cambiar estado |

### Activities

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/activities` | Listar actividades (filtros: `leadId`, `ideaId`) |
| POST | `/api/activities` | Crear actividad |
| GET | `/api/activities/:id` | Obtener actividad |
| PATCH | `/api/activities/:id` | Actualizar actividad |
| DELETE | `/api/activities/:id` | Eliminar actividad |
| PATCH | `/api/activities/:id/complete` | Completar actividad |

### Pipeline + Stages

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/pipelines` | Listar pipelines |
| POST | `/api/pipelines` | Crear pipeline |
| GET | `/api/pipelines/:id` | Obtener pipeline con stages |
| PATCH | `/api/pipelines/:id` | Actualizar pipeline |
| DELETE | `/api/pipelines/:id` | Eliminar pipeline |
| GET | `/api/pipelines/:id/stages` | Listar stages |
| POST | `/api/pipelines/:id/stages` | Crear stage |
| PATCH | `/api/pipelines/:id/stages/:stageId` | Actualizar stage |
| DELETE | `/api/pipelines/:id/stages/:stageId` | Eliminar stage |
| PUT | `/api/pipelines/:id/stages/reorder` | Reordenar stages |

### Tags

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/tags` | Listar tags |
| POST | `/api/tags` | Crear tag |
| DELETE | `/api/tags/:id` | Eliminar tag |
| POST | `/api/tags/assign` | Asignar tag a entidad |
| POST | `/api/tags/remove` | Remover tag de entidad |

### Notes

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/notes` | Listar notas por entidad (`entityId` + `entityType`) |
| POST | `/api/notes` | Crear nota |
| PATCH | `/api/notes/:id` | Actualizar nota |
| DELETE | `/api/notes/:id` | Eliminar nota |

### Instagram + Webhook

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/instagram/auth` | ✅ | Iniciar OAuth para conectar Instagram Business |
| DELETE | `/api/instagram/auth` | ✅ | Desconectar Instagram |
| GET | `/api/instagram/auth/callback` | 🍪 | Callback OAuth de Meta (usa cookie de sesión) |
| GET | `/api/instagram/status` | ✅ | Verificar si Instagram está conectado |
| POST | `/api/leads/:id/instagram/send` | ✅ | Enviar DM de Instagram a un lead |
| GET | `/api/leads/:id/instagram/conversation` | ✅ | Obtener timeline de conversación |
| GET | `/api/instagram/conversations` | ✅ | Listar todas las conversaciones (linked + unlinked) |
| GET | `/api/messages?key=<lead:id\|unlinked:senderId>` | ✅ | Obtener mensajes de una conversación |
| DELETE | `/api/messages?key=<...>` | ✅ | Eliminar conversación completa |
| PATCH | `/api/messages` | ✅ | Vincular mensajes no ligados a un lead |
| GET | `/api/activities/unread` | ✅ | Obtener cantidad de mensajes no leídos |
| GET | `/api/webhook/instagram` | ❌ | Verificación de webhook de Meta |
| POST | `/api/webhook/instagram` | 🔒 | Recibir mensajes entrantes de Instagram (firma HMAC) |

> **Auth**: ✅ = JWT de Supabase, 🍪 = Cookie de sesión, ❌ = Público (endpoint de Meta), 🔒 = Verificación por firma HMAC-SHA256

### Documentación Interactiva (Swagger UI)

Con el servidor en ejecución, visitá `/api/docs` para explorar y probar los endpoints desde el navegador con Swagger UI. La especificación OpenAPI raw está disponible en `/api/docs/openapi.json`.

## 🧪 Pruebas

```bash
# Ejecutar tests unitarios
pnpm test

# Ver cobertura
pnpm test -- --coverage

# Type checking
npx tsc --noEmit

# Linter
npx eslint .
```

Actualmente **275 tests** pasando en 47 suites, incluyendo:
- Tests de casos de uso (CreateLead, CreateIdea, CreateActivity, etc.)
- Tests de API routes (Profile, Tags, Notes, Ideas, Activities, Pipeline, Leads, Instagram)
- Tests de servicios (InstagramAuthService, InstagramMessagingService)
- Tests de componentes (ActivityItem, ActivityTypeIcon, InstagramSendDialog, LeadPopup, IdeaCard)
- Tests de integración de Instagram OAuth (auth, callback, status routes)
- Tests de drag & drop (IdeasBoard handleDragOver, PipelineBoard popup, PipelineCard sortable)
- Tests de accesibilidad (CommandMenu DialogTitle sr-only)
- Tests de API de mensajería Instagram (GET/DELETE/PATCH /api/messages)
- Tests de BaseRepository y error classes

## 🔄 CI/CD

Cada PR a `main` ejecuta automáticamente:
1. TypeScript type-check (`tsc --noEmit`)
2. ESLint (30 warnings máx.)
3. Test suite completa (`jest`)

Ver `.github/workflows/ci.yml` para más detalles.

### 🚀 Deploy a Cloudflare Workers

El deploy se activa automáticamente al hacer push a `main` (`.github/workflows/deploy.yml`).

**Las secrets de Supabase** se pasan desde GitHub Secrets en el build:

| GitHub Secret | Uso |
|--------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable |
| `CLOUDFLARE_API_TOKEN` | Token de API de Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | ID de cuenta Cloudflare |

**Las secrets de Meta** se configuran en el dashboard de Cloudflare Workers (secrets runtime, no van en build):

```bash
# Desde la CLI (alternativa al dashboard):
npx wrangler secret put META_APP_ID
npx wrangler secret put META_APP_SECRET
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put TOKEN_ENCRYPTION_KEY
```

O desde [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → idea-leads-hub → Settings → Variables.

## 📖 Documentación Adicional

-   [Configuración de Desarrollo](./docs/development-setup.md)
-   [Migraciones y Base de Datos](./docs/migrations-databases.md)
-   [Guía de Arquitectura](./docs/architecture.md)

--
