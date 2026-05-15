# Idea Leads Hub

Idea Leads Hub es un CRM personal diseñado para gestionar leads e ideas de negocio de manera eficiente. La plataforma permite organizar el flujo de ventas, realizar el seguimiento de actividades y transformar ideas en oportunidades reales, todo bajo una arquitectura sólida y escalable.

## 🚀 Características Principales

-   **Gestión de Leads**: Registro y seguimiento detallado de prospectos.
-   **Pipeline de Ventas**: Visualización del estado de tus leads en un tablero Kanban.
-   **Gestión de Ideas**: Repositorio para capturar y validar ideas de negocio, vinculándolas a leads si es necesario.
-   **Seguimiento de Actividades**: Registro de llamadas, correos, reuniones y tareas pendientes.
-   **API Privada**: Endpoint seguro para la carga automatizada de leads desde fuentes externas.
-   **Documentación Interactiva**: Documentación de la API integrada con Swagger UI.

## 🏗️ Arquitectura

El proyecto está construido siguiendo los principios de **Arquitectura Hexagonal** y **Clean Architecture**, lo que permite:
-   Independencia de la base de datos (Supabase por defecto).
-   Lógica de negocio aislada y testeable.
-   Fácil mantenimiento y escalabilidad.

Para más detalles, consulta la [Guía de Arquitectura](./docs/architecture.md).

## 🛠️ Tecnologías

-   **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
-   **Lenguaje**: TypeScript
-   **Base de Datos & Auth**: [Supabase](https://supabase.com/)
-   **Estilos**: Tailwind CSS + shadcn/ui
-   **Validación**: Zod
-   **Estado**: Zustand

## 📋 Requisitos Previos

-   Node.js 18+ 
-   npm o pnpm
-   Una cuenta en Supabase

## 🔧 Instalación y Configuración

1.  **Clonar el repositorio**:
    ```bash
    git clone <url-del-repositorio>
    cd idea-leads-hub
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    # o si usas pnpm
    pnpm install
    ```

3.  **Configurar variables de entorno**:
    Copia el archivo de ejemplo y rellena tus credenciales de Supabase:
    ```bash
    cp .env.example .env.local
    ```
    Variables necesarias:
    -   `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase.
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima para el cliente.
    -   `NEXT_PUBLIC_APP_URL`: URL base de la aplicación (ej: `http://localhost:3000`).

4.  **Preparar la Base de Datos**:
    Ejecuta las migraciones de la carpeta `supabase/migrations` en el SQL Editor de tu proyecto Supabase para crear las tablas, políticas de RLS y funciones necesarias.

5.  **Iniciar el servidor de desarrollo**:
    ```bash
    npm run dev
    ```

## 🔌 API de Leads

El sistema incluye una API para cargar leads externamente:
-   **Endpoint**: `POST /api/leads`
-   **Autenticación**: Requiere Token JWT de Supabase en el header `Authorization`.
-   **Documentación**: Visita `/api/docs` en tu navegador con el servidor en ejecución para ver la especificación completa y probar el endpoint.

## 🧪 Pruebas

Para ejecutar las pruebas unitarias:
```bash
npm test
```

## 📖 Documentación Adicional

-   [Configuración de Desarrollo](./docs/development-setup.md)
-   [Migraciones y Base de Datos](./docs/migrations-databases.md)
-   [Guía de Arquitectura](./docs/architecture.md)
