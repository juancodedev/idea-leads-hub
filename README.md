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

## 🔌 API REST

La plataforma expone una API REST privada para integración con sistemas externos. La especificación completa sigue el estándar **OpenAPI 3.0** y está disponible en el endpoint `/api/docs/openapi.json`.

### Endpoints

#### `POST /api/auth/login`
Autenticación de usuario. Devuelve un token JWT necesario para acceder al resto de los endpoints protegidos.

- **Autenticación**: No requiere
- **Cuerpo** (`application/json`):

| Campo      | Tipo   | Obligatorio | Descripción              |
|------------|--------|-------------|--------------------------|
| `email`    | string | ✅          | Email del usuario        |
| `password` | string | ✅          | Contraseña del usuario   |

- **Respuesta 200**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { "id": "uuid", "email": "usuario@ejemplo.com" }
}
```

- **Errores**: `400` (validación), `401` (credenciales inválidas), `500` (error interno)

---

#### `POST /api/leads`
Crear un nuevo lead en el sistema.

- **Autenticación**: Requiere header `Authorization: Bearer <token>` (JWT de Supabase)
- **Cuerpo** (`application/json`):

| Campo      | Tipo   | Obligatorio | Descripción                                              |
|------------|--------|-------------|----------------------------------------------------------|
| `empresa`  | string | ✅          | Nombre de la empresa                                     |
| `email`    | string | ✅          | Email de contacto                                        |
| `origen`   | string | ✅          | Fuente del lead (ej: "Campaña Web 2024")                 |
| `nombre`   | string | ❌          | Nombre del contacto (default: valor de `empresa`)        |
| `telefono` | string | ❌          | Teléfono de contacto                                     |
| `notas`    | string | ❌          | Notas adicionales                                        |
| `status`   | enum   | ❌          | Estado: `Nuevo` \| `Contactado` \| `Interesado` \| `Propuesta` \| `Ganado` \| `Perdido` (default: `Nuevo`) |

- **Ejemplo**:
```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "empresa": "TechCorp S.A.",
    "email": "contacto@techcorp.com",
    "origen": "Landing Page",
    "nombre": "Carlos López",
    "telefono": "+54 11 5555-1234",
    "notas": "Cliente interesado en consultoría",
    "status": "Nuevo"
  }'
```

- **Respuesta 201**: Objeto `Lead` creado (id, name, company, email, status, source, createdAt)
- **Errores**: `400` (validación), `401` (no autorizado), `500` (error interno)

---

### Documentación Interactiva (Swagger UI)

Con el servidor en ejecución, visitá `/api/docs` para explorar y probar los endpoints desde el navegador con Swagger UI. La especificación OpenAPI raw está disponible en `/api/docs/openapi.json`.

## 🧪 Pruebas

Para ejecutar las pruebas unitarias:
```bash
npm test
```

## 📖 Documentación Adicional

-   [Configuración de Desarrollo](./docs/development-setup.md)
-   [Migraciones y Base de Datos](./docs/migrations-databases.md)
-   [Guía de Arquitectura](./docs/architecture.md)

--
