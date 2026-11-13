# Idea Leads Hub

Idea Leads Hub es un CRM personal diseñado para gestionar leads e ideas de negocio de manera eficiente. La plataforma permite organizar el flujo de ventas, realizar el seguimiento de actividades y transformar ideas en oportunidades reales, todo bajo una arquitectura sólida y escalable.

## 🚀 Características Principales

-   **Gestión de Leads**: Registro y seguimiento detallado de prospectos.
-   **Pipeline de Ventas**: Tablero Kanban para leads con drag & drop entre columnas y popup inline para editar, cambiar estado, agregar notas y ver historial de actividades.
-   **Gestión de Ideas**: Tablero Kanban para ideas con drag & drop entre estados (cross-column y reorden intra-columna), persistencia con error rollback.
-   **Seguimiento de Actividades**: Registro de llamadas, correos, reuniones, tareas e Instagram DMs.
-   **Lead Scoring**: Clasificación hot/warm/cold según etapa, valor estimado y actividad reciente.
-   **Búsqueda Global**: CommandMenu (⌘K) con búsqueda de leads por nombre y accesos directos.
-   **Paginación Server-Side**: Tabla de leads con paginación, filtros combinables y persistencia en URL.
-   **Filtros en Actividades e Ideas**: Búsqueda por texto, filtro por tipo/estado con persistencia en URL.
- **Loading States**: Skeletons en todas las rutas del dashboard (loading.tsx).
-   **Audit Log**: Historial de cambios con línea de tiempo en detalle de leads, ideas y actividades.
-   **Identidad Visual**: Logo SVG, favicon, paleta de colores indigo/slate personalizada.
-   **Integración con Instagram**: Envío y recepción de mensajes DM vía Meta API, timeline de conversaciones por lead, auto-DM en transiciones de estado, handle clickeable en la ficha del lead, lista de conversaciones agrupadas por lead (vinculadas y no vinculadas), página de mensajes dedicada con acciones de eliminar, vincular leads, y envío de mensajes a contactos sin lead asociado, badge de notificaciones no leídas en tiempo real.
-   **API REST Completa**: ~35 endpoints para todas las entidades, con autenticación JWT, rate limiting y logging estructurado.
-   **Documentación Interactiva**: Documentación de la API integrada con Swagger UI (OpenAPI 3.0).
-   **336 Tests Automatizados**: Tests unitarios y de integración con Jest + React Testing Library.

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
-   **Testing**: Jest + React Testing Library (336 tests)
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
    -   `SUPABASE_SERVICE_ROLE_KEY`: Clave service role que usan el webhook y el barrido de reintentos (nunca en el cliente).
    -   `CRON_SECRET`: Secreto que exige `GET /api/webhook/instagram/sweep` en `Authorization: Bearer <CRON_SECRET>`. Sin él, el endpoint responde 401.

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
| GET | `/api/auth/api-keys` | Sesión | Listar las API keys propias (sin el valor en claro) |
| POST | `/api/auth/api-keys` | Sesión | Crear una API key para integraciones (se muestra una sola vez) |
| DELETE | `/api/auth/api-keys/:id` | Sesión | Revocar una API key |

#### Integraciones (API keys)

Una integración de máquina (por ejemplo el Prospector) no necesita guardar la
contraseña de un usuario. Se crea una API key con la sesión del dueño y se envía
como `X-API-Key: crm_...` o `Authorization: Bearer crm_...`.

```bash
# 1. Crear la key (con la sesión del usuario; el valor se muestra una sola vez)
curl -X POST https://crm.juancode.dev/api/auth/api-keys \
  -H "Cookie: <sesión de Supabase>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Prospector"}'

# 2. Crear o actualizar un lead de forma idempotente
curl -X POST https://crm.juancode.dev/api/leads \
  -H "X-API-Key: crm_..." \
  -H "Content-Type: application/json" \
  -d '{"company":"Acme","source":"Prospector","externalId":"acme.com","city":"Rosario","industry":"Retail","opportunityScore":87,"rating":4.5,"reviewsCount":132}'
# 201 si el externalId era nuevo, 200 si actualizó el existente

# 3. Registrar el correo enviado como actividad (idempotente)
curl -X POST https://crm.juancode.dev/api/activities \
  -H "X-API-Key: crm_..." \
  -H "Content-Type: application/json" \
  -d '{"externalId":"acme.com#correo-1","type":"EMAIL","title":"Correo 1","status":"COMPLETED","completedAt":"2026-11-12T15:04:00Z","leadId":"<uuid>"}'

# 4. Guardar la investigación como nota (idempotente, no pisa `notes` del lead)
curl -X POST https://crm.juancode.dev/api/notes \
  -H "X-API-Key: crm_..." \
  -H "Content-Type: application/json" \
  -d '{"externalId":"acme.com#investigacion","entityType":"lead","entityId":"<uuid>","content":"..."}'

# 5. Marcar el estado cuando el usuario responde
curl -X PATCH https://crm.juancode.dev/api/leads/<uuid>/status \
  -H "X-API-Key: crm_..." \
  -H "Content-Type: application/json" \
  -d '{"status":"Interesado"}'
```

**Contrato del upsert.** En la actualización por `externalId` solo se escriben los
campos que enviaste. Los defaults (`status: "Nuevo"`, `name` = compañía) se aplican
solo al crear, así que un `POST` de actualización nunca pisa el estado que el usuario
cambió en el CRM. `null` o campo ausente = conservar; `""` = borrar.

**Mapeo de nombres** (lo que manda el Prospector → lo que guarda el CRM):

| Prospector | CRM | Notas |
|------------|-----|-------|
| dominio del negocio | `externalId` | clave del upsert del lead |
| nombre / razón social | `company` | obligatorio |
| contacto | `name` | si falta, se usa `company` |
| sitio web | `website` | URL completa |
| comuna / ciudad | `city` | |
| rubro / categoría | `industry` | |
| puntaje | `opportunityScore` | entero 0-100 |
| reseñas / rating | `rating` | 0-5, acepta `"4.9"` |
| cantidad de reseñas | `reviewsCount` | entero ≥ 0 |
| asunto del correo | `title` | en la actividad |
| cuerpo / link del correo | `description` | en la actividad |
| fecha del correo | `completedAt` | ISO-8601, no es fecha de vencimiento |
| id del paso de la secuencia | `externalId` | en nota o actividad, ej. `"acme.com#correo-1"` |

**Estados.** `status` no es una lista fija: los valores válidos son las **etapas del
pipeline del usuario**. `GET /api/leads/statuses` (con API key) devuelve el catálogo
vigente y `PATCH /api/leads/:id/status` valida contra esa misma lista. Las etapas por
defecto son `Nuevo`, `Contactado`, `Interesado`, `Propuesta`, `Ganado`, `Perdido`, y el
mapeo recomendado desde el Prospector es:

| Prospector | CRM |
|------------|-----|
| `Nuevo` | `Nuevo` |
| `Contactado` | `Contactado` |
| `Respondió` | `Interesado` |
| `Interesado` | `Interesado` |
| `Retomar` | `Contactado` |
| `Descartado` | `Perdido` |
| `Rebotó` | `Perdido` |

Si querés 1:1 sin perder señal, creá las etapas faltantes (`Respondió`, `Retomar`,
`Descartado`, `Rebotó`) en el pipeline: el catálogo las publica automáticamente y no
hay que tocar código.

Un `status` que no coincide con ninguna etapa se guarda tal cual, pero el lead queda
**sin etapa** en el tablero. Por eso conviene mapear contra el catálogo antes de
mandarlo.

Las API keys habilitan `GET/POST /api/leads`, `GET/PATCH /api/leads/:id`,
`GET /api/leads/search`, `GET /api/leads/statuses`, `POST /api/notes`,
`POST /api/activities` y `PATCH /api/leads/:id/status`. `DELETE /api/leads/:id` sigue
requiriendo sesión de usuario.

#### Sincronización inversa (`updatedSince`)

`GET /api/leads?updatedSince=<iso>` devuelve solo los leads modificados desde ese
instante, que es lo que permite la vuelta CRM → integración (por ejemplo, cortar los
seguimientos cuando el usuario marca a alguien como no contactar).

```bash
curl "https://crm.juancode.dev/api/leads?source=Prospector&updatedSince=2026-11-12T00:00:00Z&limit=100" \
  -H "X-API-Key: crm_..."
```

- El orden por defecto pasa a `updatedAt` **ascendente**: paginá con `limit` + `page` y
  quedate con el `updatedAt` más alto como próximo cursor (`updatedSince`), así no se
  pierde ningún cambio entre una consulta y la siguiente.
- `updatedSince` inválido responde 400 con `fields.updatedSince`.
- Cada lead trae `id`, `externalId`, `status` y `updatedAt`, que es lo mínimo para
  decidir si se corta la secuencia.

Para distinguir "no contactar" de un cierre normal, creá una etapa
`No contactar` en el pipeline: el catálogo de `/api/leads/statuses` la publica y el
poll la devuelve como `status`.

### Profile

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/profile` | Obtener perfil del usuario actual |
| PUT | `/api/profile` | Actualizar perfil |

### Leads

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/leads` | Listar leads paginados (filtros: `status`, `source`, `q`, `updatedSince`; orden por `opportunityScore`, `rating`, etc.) |
| POST | `/api/leads` | Crear lead; con `externalId` hace upsert (201 al crear, 200 al actualizar) y actualiza solo los campos enviados. English camelCase es el contrato canónico; los campos en español siguen aceptándose como alias deprecated |
| GET | `/api/leads/:id` | Obtener lead |
| PATCH | `/api/leads/:id` | Actualizar lead (campos en inglés; `''` limpia el valor) |
| DELETE | `/api/leads/:id` | Eliminar lead (solo sesión) |
| GET | `/api/leads/statuses` | Catálogo de estados válidos = etapas del pipeline (sesión o API key) |
| PATCH | `/api/leads/:id/status` | Cambiar estado; valida contra ese catálogo (sesión o API key) |
| GET | `/api/leads/search` | Búsqueda ligera por `q` (nombre, empresa, email o externalId) |

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
| POST | `/api/activities` | Crear actividad; con `externalId` hace upsert (201/200) |
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
| POST | `/api/notes` | Crear nota; con `externalId` hace upsert (201/200) |
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
| POST | `/api/instagram/send` | ✅ | Enviar DM a un contacto sin lead (usa `recipientId`) |
| GET | `/api/leads/:id/instagram/conversation` | ✅ | Obtener timeline de conversación |
| GET | `/api/instagram/conversations` | ✅ | Listar todas las conversaciones (vinculadas y no vinculadas) |
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

Actualmente **336 tests** pasando en 56 suites, incluyendo:
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

### 🗄️ Migraciones y deploy

Mergear a `main` **deploya a producción**, así que el esquema tiene que estar aplicado antes.
El primer paso del workflow es `scripts/check-schema-drift.mjs`: compara
`src/infrastructure/database/database.types.ts` (el contrato contra el que está tipada toda
la app) con el esquema que producción realmente sirve vía PostgREST, y **falla el deploy**
listando las tablas y columnas que faltan.

```bash
# Verificar a mano contra producción (usa las mismas variables que el deploy)
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node --no-warnings scripts/check-schema-drift.mjs

# Verificar contra un spec guardado, sin red
node --no-warnings scripts/check-schema-drift.mjs --spec ./spec.json
```

No necesita la password de la base: usa la service role key que ya existe y el
spec OpenAPI del root de PostgREST. Para aplicar lo que falte:

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

Si una migración se aplicó a mano desde el SQL Editor, registrala para que el
historial no quede mintiendo: `supabase migration repair --status applied <version>`.

**Las secrets de Meta** se configuran en el dashboard de Cloudflare Workers (secrets runtime, no van en build):

```bash
# Desde la CLI (alternativa al dashboard):
npx wrangler secret put META_APP_ID
npx wrangler secret put META_APP_SECRET
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put TOKEN_ENCRYPTION_KEY
npx wrangler secret put CRON_SECRET
```

O desde [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → idea-leads-hub → Settings → Variables.

## 📖 Documentación Adicional

-   [Configuración de Desarrollo](./docs/development-setup.md)
-   [Migraciones y Base de Datos](./docs/migrations-databases.md)
-   [Guía de Arquitectura](./docs/architecture.md)

--
