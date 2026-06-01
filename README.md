# Idea Leads Hub

CRM personal para freelancers y desarrolladores. Gestiona leads, ideas de negocio y actividades en un solo lugar, con un pipeline visual tipo Kanban, dashboard de métricas y una API privada para integraciones externas.

## Características

- **Pipeline de Ventas Kanban**: Arrastra y suelta leads entre etapas del pipeline.
- **Gestión de Leads**: CRUD completo con tabla filtrable, búsqueda y vista rápida.
- **Gestión de Ideas**: Repositorio con estados (backlog, investigando, planeado, en progreso, completado, archivado), prioridades y vínculos a leads.
- **Seguimiento de Actividades**: Registro de llamadas, correos, reuniones y tareas pendientes.
- **Dashboard**: Estadísticas de leads activos, tasa de conversión, actividades pendientes e ideas por estado.
- **API Privada**: Endpoint `POST /api/leads` con autenticación JWT y validación Zod.
- **Documentación Interactiva**: Swagger UI en `/api/docs` con especificación OpenAPI 3.0.
- **Autenticación**: Login con Supabase Auth y middleware de protección de rutas.
- **Modo Oscuro**: Soporte de tema claro/oscuro vía CSS variables (shadcn/ui).
- **Despliegue Automático**: CI/CD con GitHub Actions hacia Cloudflare Pages.

## Tecnologías

| Categoría | Tecnología |
|---|---|
| **Framework** | [Next.js](https://nextjs.org/) 15 (App Router) |
| **Lenguaje** | TypeScript 5 (strict mode) |
| **UI** | Tailwind CSS 3 + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives) |
| **Estado** | [Zustand](https://github.com/pmndrs/zustand) 4 |
| **Formularios** | React Hook Form + Zod |
| **Base de Datos & Auth** | [Supabase](https://supabase.com/) |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/) |
| **Testing** | Jest + Testing Library |
| **Formato/Lint** | ESLint, Prettier, Husky, lint-staged |
| **Despliegue** | [Cloudflare Pages](https://pages.cloudflare.com/) via OpenNext + Wrangler |

## Arquitectura

El proyecto sigue **Arquitectura Hexagonal + Clean Architecture**:

```
src/
├── core/               # Lógica de negocio pura (sin dependencias externas)
│   ├── domain/         # Entidades, DTOs y esquemas Zod
│   ├── application/    # Casos de uso (orquestación)
│   └── ports/          # Interfaces de repositorios/servicios
├── infrastructure/     # Implementaciones técnicas (Supabase, repositorios)
├── modules/            # Módulos autocontenidos (leads, ideas, activities, dashboard)
├── ui/                 # Sistema de diseño (componentes shadcn/ui, layouts)
└── app/                # Next.js App Router (rutas, API handlers, middleware)
```

Principios:
- `core/` nunca importa de `infrastructure/`, `modules/` o `app/`.
- Las implementaciones concretas (Supabase) dependen de las interfaces definidas en `core/ports/`.
- Los módulos usan el patrón **Module Factory** con inyección de dependencias.

> Ver [Guía de Arquitectura](./docs/architecture.md) para detalles completos.

## Requisitos

- Node.js 18+
- pnpm (recomendado) o npm
- Cuenta en [Supabase](https://supabase.com/)

## Instalación

```bash
git clone https://github.com/juancodedev/idea-leads-hub.git
cd idea-leads-hub
pnpm install
```

## Configuración

Copia el archivo de entorno y completa tus credenciales:

```bash
cp .env.example .env.local
```

Variables necesarias en `.env.local`:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima del cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (para operaciones admin) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (ej: `http://localhost:3000`) |

### Base de Datos

Ejecuta las migraciones de `supabase/migrations/` en el SQL Editor de Supabase. Incluyen:

- Schema inicial (profiles, leads, ideas, activities)
- Pipeline de ventas con etapas personalizables
- Tags y notas con relaciones polimórficas
- Adjuntos para ideas
- Logs de auditoría
- Políticas de seguridad RLS
- Storage para avatares

## Desarrollo

```bash
pnpm dev        # Inicia servidor de desarrollo en localhost:3000
pnpm test       # Ejecuta pruebas unitarias
pnpm lint       # ESLint
pnpm build      # Build de producción
```

## API

### Autenticación

```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "token": "jwt..." }
```

### Leads (carga externa)

```
POST /api/leads
Authorization: Bearer <jwt-token>
Body: {
  "name": "string",
  "company": "string (opcional)",
  "email": "email (opcional)",
  "phone": "string (opcional)",
  "source": "string",
  "notes": "string (opcional)"
}
```

Documentación interactiva: abrir `/api/docs` con el servidor en ejecución.

## Despliegue

El proyecto incluye un pipeline de CI/CD en `.github/workflows/deploy.yml` que despliega automáticamente a **Cloudflare Pages** al hacer push a `main`.

```bash
pnpm preview     # Build + preview local de Cloudflare
pnpm deploy      # Build + deploy a Cloudflare Pages
```

## Documentación

- [Guía de Arquitectura](./docs/architecture.md)
- [Configuración de Desarrollo](./docs/development-setup.md)
- [Migraciones y Base de Datos](./docs/migrations-databases.md)

## Licencia

MIT
