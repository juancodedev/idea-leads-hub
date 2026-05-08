# Tareas: CRM Personal (Idea Leads Hub) — Basado en Spec

## Fase 0: Setup Inicial
- [x] Inicializar repositorio (README, .gitignore, .env.example)
- [x] Configurar Next.js, TypeScript, ESLint, Tailwind
- [x] Configurar Alias de importación
- [x] Instalar dependencias (Zustand, Zod, RHF, dnd-kit)
- [x] Configurar ESLint, Prettier, Husky, lint-staged
- [x] Instalar componentes shadcn/ui
- [x] Configurar clientes Supabase (Browser/Server/Middleware)
- [ ] Configurar compatibilidad con Cloudflare Pages

## Fase 1: Diseño de Dominio
- [x] Crear entidades de dominio (Lead, Idea, Activity)
- [x] Crear Value Objects (Email, LeadStatus)
- [x] Crear interfaces de repositorio (Ports)
- [x] Implementar repositorios de Supabase (DI pattern)
- [x] Implementar Casos de Uso (CreateLead)
- [x] Estrategia de validación (Zod Schemas)

## Fase 2: Base de Datos
- [x] Diseñar schema de Supabase (SQL)
- [x] Crear migraciones iniciales
- [x] Configurar políticas de RLS
- [x] Preparar soporte multi-tenant (user_id)

## Fase 3: Autenticación
- [x] Implementar páginas de Login/Logout
- [x] Implementar middleware de protección de rutas
- [x] Crear layout autenticado (Sidebar/TopNav)

## Fase 4-8: Módulos de Funcionalidad
- [x] Módulo de Leads (CRUD, Tabla)
- [x] Pipeline (Kanban con dnd-kit)
- [x] Módulo de Ideas
- [ ] Módulo de Actividades
- [ ] Dashboard
