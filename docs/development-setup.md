# Configuración de Desarrollo (Idea Leads Hub)

## Objetivo

Estandarizar el desarrollo local y el despliegue del CRM Personal para asegurar que todos los entornos utilicen la misma arquitectura escalable (Hexagonal) y estén preparados para el despliegue en Cloudflare Pages.

## Baseline

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript (Strict mode)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de Datos & Auth**: Supabase
- **Gestor de Paquetes**: npm o pnpm

## Desarrollo Local

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   Copia el archivo `.env.example` a `.env.local` y completa los valores:
   ```bash
   cp .env.example .env.local
   ```
   Variables requeridas mínimas:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto en Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima de Supabase.

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

## Base de Datos (Supabase)

El proyecto utiliza las migraciones de Supabase ubicadas en `/supabase/migrations`. 

Para aplicar el esquema inicial:
1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ejecuta los scripts SQL de `supabase/migrations/` en el SQL Editor de Supabase o utiliza el CLI de Supabase si lo tienes configurado.
3. Asegúrate de que el **Row Level Security (RLS)** esté habilitado para todas las tablas.

## Arquitectura

El proyecto sigue una **Arquitectura Hexagonal** para garantizar el desacoplamiento:

- `src/core/domain`: Entidades puras y Value Objects. Sin dependencias externas.
- `src/core/ports`: Interfaces que definen los contratos para repositorios y servicios.
- `src/infrastructure`: Implementaciones concretas (Supabase, Auth, etc.) que inyectan las dependencias en el core.
- `src/modules`: Lógica de UI organizada por funcionalidad (Leads, Ideas, Pipeline).
- `src/ui`: Componentes base del sistema de diseño (shadcn/ui).

## Despliegue (Cloudflare Pages)

El proyecto está preparado para ejecutarse en el Edge de Cloudflare:

- Las variables de entorno deben configurarse en el panel de Cloudflare Pages.
- El build command recomendado es `npm run build`.
- El output directory es `.next`.

## Calidad de Código

- **Linting**: `npm run lint`
- **Formatting**: Prettier se utiliza para mantener la consistencia.
- **Hooks**: Husky y lint-staged están configurados para ejecutar validaciones antes de cada commit.
