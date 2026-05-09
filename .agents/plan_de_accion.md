# Plan de Acción: CRM Personal (Idea Leads Hub)

Este documento detalla la estrategia para construir un CRM personal moderno, minimalista y escalable, utilizando Next.js, TypeScript, Supabase y Arquitectura Hexagonal.

## Decisiones Arquitectónicas

1.  **Arquitectura Hexagonal (Ports & Adapters)**:
    *   **Core (Dominio y Aplicación)**: Contendrá la lógica de negocio pura, entidades y casos de uso. No tendrá dependencias externas.
    *   **Infrastructure**: Implementaciones concretas de los puertos (Supabase, Auth, Email, etc.).
    *   **UI (Primary Adapters)**: Componentes de React y lógica de presentación (Next.js App Router).
2.  **Separación de Capas**: Garantizamos que el cambio de una herramienta (ej. cambiar Supabase por otro servicio) solo afecte a la capa de infraestructura.
3.  **SOLID & Clean Code**: Interfaces claras, responsabilidad única por archivo y tipado estricto con TypeScript.
4.  **Estética Premium**: Inspirado en Linear y Notion, utilizando Tailwind CSS y shadcn/ui con un enfoque minimalista.

## Estructura de Carpetas Definitiva

```txt
src/
├── app/                  # Rutas de Next.js (App Router)
├── core/                 # El "Corazón" de la aplicación
│   ├── domain/           # Entidades, Value Objects y Errores de dominio
│   ├── application/      # Casos de uso (Orquestadores)
│   ├── ports/            # Interfaces (Contratos para Repositorios y Servicios)
│   └── shared/           # Tipos y utilidades transversales al core
├── infrastructure/       # Implementaciones técnicas (Detalle)
│   ├── database/         # Configuración de clientes (Supabase)
│   ├── repositories/     # Implementación de interfaces del core
│   ├── services/         # Adaptadores para servicios externos (Auth, etc.)
│   └── auth/             # Configuración específica de Supabase Auth
├── modules/              # Funcionalidades agrupadas por dominio (UI Logic)
│   ├── leads/            # Componentes, hooks y lógica local de Leads
│   ├── ideas/            # Componentes, hooks y lógica local de Ideas
│   ├── activities/       # Actividades y tareas
│   ├── dashboard/        # Vistas del dashboard
│   └── auth/             # Componentes de login/signup
├── ui/                   # Diseño del sistema (UI Kit)
│   ├── components/       # Componentes shadcn/ui y base reutilizables
│   ├── layouts/          # Estructuras de página compartidas
│   └── providers/        # Context Providers (Themes, Auth, etc.)
└── lib/                  # Configuraciones de librerías externas
```

## Tareas Iniciales

### 1. Setup de Dependencias y Herramientas
- [ ] Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] Configurar variables de entorno en `.env.local`.
- [ ] Ejecutar `npx skills add supabase/agent-skills`.
- [ ] Configurar ESLint, Prettier, Husky y lint-staged (Ajustar si ya existen).
- [ ] Instalar componentes de shadcn necesarios.

### 2. Diseño de Base de Datos y Dominio
- [ ] Definir entidades `Lead`, `Idea`, `Activity` en `src/core/domain`.
- [ ] Diseñar el Schema de Supabase (SQL).
- [ ] Configurar Row Level Security (RLS) básico.

### 3. Autenticación
- [ ] Implementar repositorio de Auth en `infrastructure`.
- [ ] Crear componentes de login y protección de rutas.

### 4. UI/UX Base
- [ ] Configurar tema (Oscuro/Claro) y tipografía (Inter/Outfit).
- [ ] Crear Layout principal (Sidebar, Header).

## Estrategia de Escalabilidad
*   **Multi-tenant ready**: El schema incluirá `user_id` en todas las tablas para filtrar datos por usuario, permitiendo evolución a multi-usuario fácilmente.
*   **Desacoplamiento**: El uso de interfaces en el `core` permite que los casos de uso no sepan que Supabase existe, facilitando pruebas y cambios futuros.
*   **Cloudflare Pages**: Configuración para despliegue optimizado en el edge.

## Verificación Plan
### Pruebas Automatizadas
- [ ] Linting y formateo consistente.
- [ ] Pruebas unitarias para los casos de uso del Core.
### Verificación Manual
- [ ] Validar flujo de autenticación.
- [ ] Probar CRUD inicial de Leads.
