# Idea Leads Hub

Idea Leads Hub es un CRM personal diseñado para gestionar leads e ideas de negocio de manera eficiente. La plataforma permite organizar el flujo de ventas, realizar el seguimiento de actividades y transformar ideas en oportunidades reales, todo bajo una arquitectura sólida y escalable.

## 🚀 Características Principales

-   **Gestión de Leads**: Registro y seguimiento detallado de prospectos.
-   **Pipeline de Ventas**: Visualización del estado de tus leads en un tablero Kanban.
-   **Gestión de Ideas**: Repositorio para capturar y validar ideas de negocio, vinculándolas a leads si es necesario.
-   **Seguimiento de Actividades**: Registro de llamadas, correos, reuniones y tareas pendientes.
-   **API REST Completa**: ~25 endpoints para todas las entidades, con autenticación JWT, rate limiting y logging estructurado.
-   **Documentación Interactiva**: Documentación de la API integrada con Swagger UI (OpenAPI 3.0).
-   **106 Tests Automatizados**: Tests unitarios con Jest + React Testing Library.

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
-   **Drag & Drop**: @dnd-kit (Kanban pipeline)
-   **Testing**: Jest + React Testing Library (106 tests)
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

Actualmente **106 tests** pasando en 23 suites, incluyendo:
- Tests de casos de uso (CreateLead, CreateIdea, CreateActivity, etc.)
- Tests de API routes (Profile, Tags, Notes, Ideas, Activities, Pipeline, Leads)
- Tests de BaseRepository y error classes

## 🔄 CI/CD

Cada PR a `main` ejecuta automáticamente:
1. TypeScript type-check (`tsc --noEmit`)
2. ESLint (30 warnings máx.)
3. Test suite completa (`jest`)

Ver `.github/workflows/ci.yml` para más detalles.

## 📖 Documentación Adicional

-   [Configuración de Desarrollo](./docs/development-setup.md)
-   [Migraciones y Base de Datos](./docs/migrations-databases.md)
-   [Guía de Arquitectura](./docs/architecture.md)

--
