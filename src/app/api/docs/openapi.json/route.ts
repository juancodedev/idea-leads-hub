import { NextRequest, NextResponse } from 'next/server';
import { handlePreflight, withCors } from '@/lib/api/cors';

const openapi = {
  openapi: "3.0.0",
  info: {
    title: "Idea Leads Hub API",
    version: "1.0.0",
    description: "API para la gestión de leads e ideas en la plataforma Idea Leads Hub.",
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      description: "Servidor principal",
    },
  ],
  paths: {
    "/api/auth/login": {
      post: {
        summary: "Autenticar usuario y obtener token",
        description: "Permite obtener un token de sesión (JWT) proporcionando email y contraseña.",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Autenticación exitosa",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginResponse",
                },
              },
            },
          },
          401: {
            description: "Credenciales incorrectas",
          },
        },
      },
    },
    "/api/auth/api-keys": {
      get: {
        summary: "Listar las API keys del usuario",
        description: "Devuelve las API keys propias (sin el valor en claro) para auditar cuáles están activas.",
        tags: ["Auth"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Lista de API keys",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } },
                  },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear una API key para integraciones",
        description:
          "Genera una API key de máquina para que una integración (por ejemplo el Prospector) no tenga que guardar la contraseña del usuario. El valor en claro se devuelve una sola vez; en la base sólo queda el hash.",
        tags: ["Auth"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateApiKeyRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "API key creada (el campo key no se puede recuperar después)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiKeyCreated" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/auth/api-keys/{id}": {
      delete: {
        summary: "Revocar una API key",
        description: "Marca la API key como revocada. Las integraciones que la usen reciben 401.",
        tags: ["Auth"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "API key revocada (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "API key no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/profile": {
      get: {
        summary: "Obtener perfil del usuario autenticado",
        description: "Retorna el perfil del usuario actual.",
        tags: ["Profile"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Perfil del usuario",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Profile" },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      put: {
        summary: "Actualizar perfil del usuario",
        description: "Actualiza los datos del perfil del usuario autenticado.",
        tags: ["Profile"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateProfileRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Perfil actualizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Profile" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/tags": {
      get: {
        summary: "Listar etiquetas",
        description: "Obtiene todas las etiquetas del usuario autenticado.",
        tags: ["Tags"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Lista de etiquetas",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Tag" },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear etiqueta",
        description: "Crea una nueva etiqueta.",
        tags: ["Tags"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTagRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Etiqueta creada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Tag" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/tags/{id}": {
      delete: {
        summary: "Eliminar etiqueta",
        description: "Elimina una etiqueta por su ID.",
        tags: ["Tags"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Etiqueta eliminada (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Etiqueta no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/tags/assign": {
      post: {
        summary: "Asignar etiqueta a entidad",
        description: "Asigna una etiqueta existente a un lead o idea.",
        tags: ["Tags"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AssignTagRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Etiqueta asignada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Etiqueta o entidad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/tags/remove": {
      post: {
        summary: "Remover etiqueta de entidad",
        description: "Remueve una etiqueta de un lead o idea.",
        tags: ["Tags"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AssignTagRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Etiqueta removida",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Etiqueta o entidad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/notes": {
      get: {
        summary: "Listar notas de una entidad",
        description: "Obtiene las notas asociadas a un lead o idea. Requiere los parámetros entityId y entityType.",
        tags: ["Notes"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "entityId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID de la entidad (lead o idea)",
          },
          {
            name: "entityType",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["lead", "idea"] },
            description: "Tipo de entidad",
          },
        ],
        responses: {
          200: {
            description: "Lista de notas",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Note" },
                },
              },
            },
          },
          400: { description: "Error de validación (entityId y entityType requeridos)" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear o actualizar (upsert) una nota",
        description: "Crea una nota asociada a un lead o idea. Con `externalId`, si ya existe una nota del mismo usuario con ese id la actualiza y responde 200; si no, la crea y responde 201. Acepta API key.",
        tags: ["Notes"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateNoteRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Nota creada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Note" },
              },
            },
          },
          200: {
            description: "Nota existente actualizada por externalId (upsert)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Note" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/notes/{id}": {
      patch: {
        summary: "Actualizar nota",
        description: "Actualiza el contenido de una nota existente.",
        tags: ["Notes"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateNoteRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Nota actualizada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Note" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Nota no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar nota",
        description: "Elimina una nota por su ID.",
        tags: ["Notes"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Nota eliminada (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Nota no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/ideas": {
      get: {
        summary: "Listar ideas",
        description: "Obtiene todas las ideas, con filtros opcionales por status y leadId.",
        tags: ["Ideas"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { $ref: "#/components/schemas/IdeaStatus" },
            description: "Filtrar por estado",
          },
          {
            name: "leadId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Filtrar por lead asociado",
          },
        ],
        responses: {
          200: {
            description: "Lista de ideas",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Idea" },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear idea",
        description: "Crea una nueva idea.",
        tags: ["Ideas"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateIdeaRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Idea creada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Idea" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/ideas/{id}": {
      get: {
        summary: "Obtener idea",
        description: "Obtiene una idea por su ID.",
        tags: ["Ideas"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Idea encontrada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Idea" },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Idea no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
      patch: {
        summary: "Actualizar idea",
        description: "Actualiza parcialmente una idea.",
        tags: ["Ideas"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateIdeaRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Idea actualizada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Idea" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Idea no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar idea",
        description: "Elimina una idea por su ID.",
        tags: ["Ideas"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Idea eliminada (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Idea no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/ideas/{id}/status": {
      patch: {
        summary: "Cambiar estado de idea",
        description: "Cambia el estado de una idea (transición de estado).",
        tags: ["Ideas"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangeIdeaStatusRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Estado actualizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Idea" },
              },
            },
          },
          400: { description: "Error de validación o transición inválida" },
          401: { description: "No autorizado" },
          404: { description: "Idea no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/activities": {
      get: {
        summary: "Listar actividades",
        description: "Obtiene actividades filtradas por leadId o ideaId (al menos uno requerido).",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "leadId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Filtrar por lead",
          },
          {
            name: "ideaId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Filtrar por idea",
          },
        ],
        responses: {
          200: {
            description: "Lista de actividades",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Activity" },
                },
              },
            },
          },
          400: { description: "Error de validación (leadId o ideaId requerido)" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear o actualizar (upsert) una actividad",
        description: "Crea una actividad (llamada, reunión, email enviado, tarea…). Con `externalId`, si ya existe una actividad del mismo usuario con ese id la actualiza y responde 200; si no, la crea y responde 201. Acepta API key.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateActivityRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Actividad creada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          200: {
            description: "Actividad existente actualizada por externalId (upsert)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/activities/{id}": {
      get: {
        summary: "Obtener actividad",
        description: "Obtiene una actividad por su ID.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Actividad encontrada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Actividad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
      patch: {
        summary: "Actualizar actividad",
        description: "Actualiza parcialmente una actividad.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateActivityRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Actividad actualizada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Actividad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar actividad",
        description: "Elimina una actividad por su ID.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Actividad eliminada (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Actividad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/activities/{id}/complete": {
      patch: {
        summary: "Completar actividad",
        description: "Marca una actividad como completada.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Actividad completada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Actividad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/activities/{id}/status": {
      patch: {
        summary: "Cambiar estado de actividad",
        description: "Transición libre de estado (PENDING | IN_PROGRESS | COMPLETED). Escribe el delta de auditoría.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangeActivityStatusRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Actividad con el nuevo estado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          400: { description: "Error de validación (status fuera del enum)" },
          401: { description: "No autorizado" },
          404: { description: "Actividad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/activities/{id}/read": {
      patch: {
        summary: "Marcar actividad como leída",
        description: "Establece read_at. No toca status ni completed (BR-3).",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Actividad marcada como leída",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Activity" },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Actividad no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/activities/unread": {
      get: {
        summary: "Contar mensajes de Instagram no leídos",
        description:
          "Badge de no leídos: suma de conversations.unread_count de las conversaciones del usuario. Las transiciones de estado de actividades no lo modifican.",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Cantidad de mensajes no leídos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/pipelines": {
      get: {
        summary: "Listar pipelines",
        description: "Obtiene todos los pipelines del usuario autenticado.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Lista de pipelines",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Pipeline" },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear pipeline",
        description: "Crea un nuevo pipeline de ventas.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePipelineRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Pipeline creado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pipeline" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/pipelines/{id}": {
      get: {
        summary: "Obtener pipeline con etapas",
        description: "Obtiene un pipeline por su ID, incluyendo sus etapas.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Pipeline encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pipeline" },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Pipeline no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
      patch: {
        summary: "Actualizar pipeline",
        description: "Actualiza parcialmente un pipeline.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePipelineRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Pipeline actualizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pipeline" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Pipeline no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar pipeline",
        description: "Elimina un pipeline por su ID.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Pipeline eliminado (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Pipeline no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/pipelines/{id}/stages": {
      get: {
        summary: "Listar etapas de un pipeline",
        description: "Obtiene todas las etapas de un pipeline.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID del pipeline",
          },
        ],
        responses: {
          200: {
            description: "Lista de etapas",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PipelineStage" },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Pipeline no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear etapa en pipeline",
        description: "Crea una nueva etapa en un pipeline.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID del pipeline",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateStageRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Etapa creada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PipelineStage" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Pipeline no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/pipelines/{id}/stages/reorder": {
      put: {
        summary: "Reordenar etapas",
        description: "Reordena las etapas de un pipeline. El orden se define por la posición en el arreglo.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID del pipeline",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReorderStagesRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Etapas reordenadas",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Pipeline no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/pipelines/{id}/stages/{stageId}": {
      patch: {
        summary: "Actualizar etapa",
        description: "Actualiza parcialmente una etapa de pipeline.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID del pipeline",
          },
          {
            name: "stageId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID de la etapa",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateStageRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Etapa actualizada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PipelineStage" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Etapa no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar etapa",
        description: "Elimina una etapa de pipeline por su ID.",
        tags: ["Pipelines"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID del pipeline",
          },
          {
            name: "stageId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID de la etapa",
          },
        ],
        responses: {
          204: { description: "Etapa eliminada (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Etapa no encontrada" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads": {
      get: {
        summary: "Listar leads",
        description: "Lista paginada de leads. Acepta sesión de usuario o API key del CRM.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", example: "Nuevo" },
            description: "Filtrar por estado",
          },
          {
            name: "source",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrar por origen",
          },
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Búsqueda por nombre, empresa, email o externalId",
          },
          {
            name: "sort",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["name", "company", "email", "status", "createdAt", "updatedAt", "estimatedValue", "opportunityScore", "rating"],
            },
            description: "Campo de ordenamiento",
          },
          {
            name: "order",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 25 },
          },
        ],
        responses: {
          200: {
            description: "Lista paginada de leads",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Lead" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    totalPages: { type: "integer" },
                  },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear o actualizar (upsert) un lead",
        description:
          "Crea un lead. Si se envía `externalId` y ya existe un lead del mismo usuario con ese identificador, actualiza ese lead y responde 200; si no existe, lo crea y responde 201. Un reintento del envío o un backfill repetido nunca duplica leads.\n\n"
          + "**Actualización parcial:** en el upsert solo se escriben los campos que enviaste. Los defaults (`status: \"Nuevo\"`, `name` = compañía) se aplican únicamente al crear. `null` o campo ausente = conservar el valor guardado; `\"\"` = borrarlo. Así un `POST` de actualización nunca pisa el estado que el usuario cambió en el CRM.\n\n"
          + "**Números tolerantes:** `rating`, `reviewsCount`, `opportunityScore` y `estimatedValue` aceptan número o string numérico (`\"4.9\"`).\n\n"
          + "**Errores:** un 400 devuelve `{ error, fields }`, con un mensaje por campo (`{\"rating\": \"Expected number\"}`).\n\n"
          + "English camelCase es el contrato canónico; los campos en español (empresa, origen, nombre, teléfono, dirección, sitio_web, notas) se aceptan como alias deprecated.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateLeadRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Lead creado exitosamente. Siempre incluye `id`",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          200: {
            description: "Lead existente actualizado por externalId (upsert). Siempre incluye `id`",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          400: {
            description: "Error de validación; `fields` trae un mensaje por campo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/search": {
      get: {
        summary: "Búsqueda ligera de leads",
        description:
          "Devuelve id, nombre, empresa y estado de los leads que coinciden con `q` (nombre, empresa, email o externalId). Acepta sesión o API key del CRM.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Texto a buscar (mínimo uno)",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "source",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1 },
          },
        ],
        responses: {
          200: {
            description: "Coincidencias",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      name: { type: "string" },
                      company: { type: "string" },
                      status: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Falta el parámetro q" },
          401: { description: "No autorizado" },
        },
      },
    },
    "/api/leads/{id}": {
      get: {
        summary: "Obtener lead",
        description: "Obtiene un lead por su ID. Acepta sesión o API key del CRM.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Lead encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          401: { description: "No autorizado" },
          404: { description: "Lead no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
      patch: {
        summary: "Actualizar lead",
        description: "Actualiza parcialmente un lead con campos en inglés (contrato canónico). Acepta sesión o API key del CRM. Un string vacío limpia el valor.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateLeadRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Lead actualizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Lead no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar lead",
        description:
          "Elimina un lead por su ID. Se rechaza con 409 si el lead tiene conversaciones de Instagram asociadas.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Lead eliminado (sin contenido)" },
          401: { description: "No autorizado" },
          404: { description: "Lead no encontrado" },
          409: {
            description: "El lead tiene conversaciones de Instagram asociadas y no se puede eliminar",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                  required: ["error"],
                },
              },
            },
          },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/statuses": {
      get: {
        summary: "Catálogo de estados válidos de un lead",
        description:
          "Publica los valores válidos de `status`. No son fijos: son las etapas del pipeline del usuario, así que el catálogo cambia si renombra, crea o borra etapas. `PATCH /api/leads/{id}/status` valida contra esta misma lista.\\n\\n" +
          "**Mapa de estados del Prospector.** Las etapas por defecto del CRM son `Nuevo`, `Contactado`, `Interesado`, `Propuesta`, `Ganado`, `Perdido`. Mapeo recomendado: `Nuevo`→`Nuevo`, `Contactado`→`Contactado`, `Respondió`→`Interesado`, `Interesado`→`Interesado`, `Retomar`→`Contactado`, `Descartado`→`Perdido`, `Rebotó`→`Perdido`. Si querés 1:1, creá las etapas faltantes en el pipeline y este endpoint las devuelve solas.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: {
            description: "Catálogo de estados del usuario",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LeadStatusCatalog" },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/{id}/status": {
      patch: {
        summary: "Cambiar estado de lead",
        description: "Cambia el estado de un lead. Acepta API key, para que la integración marque \"Interesado\", \"Retomar\" o \"Descartado\" cuando el usuario responde.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangeLeadStatusRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Estado actualizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          404: { description: "Lead no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },

    // ── Instagram ──────────────────────────────────────────
    "/api/instagram/auth": {
      get: {
        summary: "Iniciar conexión OAuth con Instagram",
        description: "Redirige al usuario a Facebook para autorizar la conexión de Instagram Business. Requiere META_APP_ID configurada.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        responses: {
          302: { description: "Redirección a Facebook OAuth" },
          400: { description: "META_APP_ID no configurada" },
          401: { description: "No autorizado" },
        },
      },
      delete: {
        summary: "Desconectar Instagram",
        description: "Elimina los tokens de Instagram del usuario autenticado.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Desconectado exitosamente",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/instagram/auth/callback": {
      get: {
        summary: "Callback OAuth de Instagram",
        description: "Endpoint interno que recibe el código de autorización de Facebook, intercambia por tokens y almacena la conexión.",
        tags: ["Instagram"],
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Código de autorización de Facebook",
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Estado CSRF para verificación",
          },
        ],
        responses: {
          302: { description: "Redirección a /settings/profile con resultado" },
          400: { description: "Error de validación (state inválido o parámetros faltantes)" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/instagram/status": {
      get: {
        summary: "Estado de conexión Instagram",
        description: "Obtiene el estado de conexión de Instagram Business del usuario autenticado.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Estado de conexión",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    connected: { type: "boolean" },
                    igId: { type: "string", nullable: true },
                    expiresAt: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/{id}/instagram/send": {
      post: {
        summary: "Enviar mensaje de Instagram a un lead",
        description:
          "Envía un DM de Instagram a un lead por la ruta única de entrega (DeliverMessage), en la conversación del lead (se crea si no existe). Requiere Instagram conectado.",
        tags: ["Leads", "Instagram"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string", minLength: 1, description: "Texto del mensaje" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Mensaje enviado (estado sent)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SendSuccess" } } },
          },
          400: {
            description:
              "Error de validación, lead sin identificador de Instagram, o handle no resoluble (needsManualId: true)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    tip: { type: "string" },
                    needsManualId: { type: "boolean" },
                  },
                },
              },
            },
          },
          404: { description: "Lead no encontrado" },
          401: { description: "No autorizado" },
          502: {
            description: "Instagram rechazó el envío; el mensaje queda en la conversación con estado failed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SendFailure" } } },
          },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/{id}/instagram/conversation": {
      get: {
        summary: "Obtener conversación de Instagram",
        description:
          "Mensajes de todas las conversaciones del lead (tabla messages), ordenados del más antiguo al más reciente.",
        tags: ["Leads", "Instagram"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Lista de mensajes",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Message" },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/webhook/instagram": {
      get: {
        summary: "Verificación de webhook de Meta",
        description: "Endpoint de verificación utilizado por Meta para confirmar el webhook durante la configuración.",
        tags: ["Instagram"],
        parameters: [
          {
            name: "hub.mode",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "hub.verify_token",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "hub.challenge",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Challenge verificado, devuelve el challenge" },
          403: { description: "Verificación fallida" },
        },
      },
      post: {
        summary: "Recibir evento de webhook de Instagram",
        description:
          "Verifica X-Hub-Signature-256, registra el evento en webhook_events (idempotente), responde 200 y procesa en segundo plano.",
        tags: ["Instagram"],
        responses: {
          200: { description: "Evento recibido (status: received) o duplicado (status: duplicate)" },
          400: { description: "Payload inválido" },
          401: { description: "Firma ausente o inválida, o secreto de la app no configurado" },
          500: { description: "No se pudo registrar el evento; Meta reintenta" },
        },
      },
    },
    "/api/webhook/instagram/sweep": {
      get: {
        summary: "Reprocesar eventos de webhook pendientes",
        description:
          "Reintenta hasta 5 eventos en estado received con más de 2 minutos y menos de 3 intentos. Protegido con Authorization: Bearer <CRON_SECRET>.",
        tags: ["Instagram"],
        responses: {
          200: { description: "Resumen del barrido" },
          401: { description: "Secreto ausente o inválido" },
          500: { description: "Error de configuración o del barrido" },
        },
      },
    },
    "/api/instagram/send": {
      post: {
        summary: "Enviar mensaje de Instagram a un participante",
        description: "Envía un DM a un IGSID por la ruta única de entrega (DeliverMessage).",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text", "recipientId"],
                properties: {
                  text: { type: "string", minLength: 1 },
                  recipientId: { type: "string", minLength: 1, description: "IGSID del destinatario" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Mensaje enviado (estado sent)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SendSuccess" } } },
          },
          400: { description: "Error de validación" },
          401: { description: "No autorizado" },
          502: {
            description: "Instagram rechazó el envío; el mensaje queda en la conversación con estado failed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SendFailure" } } },
          },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/instagram/conversations": {
      get: {
        summary: "Bandeja de conversaciones de Instagram",
        description:
          "Una entrada por clave (lead:<leadId> o unlinked:<igsid>), con unreadCount sumado sobre sus conversaciones, ordenadas por último mensaje.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        responses: {
          200: {
            description: "Conversaciones",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conversations: { type: "array", items: { $ref: "#/components/schemas/Conversation" } },
                  },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/messages": {
      get: {
        summary: "Mensajes de una clave de bandeja",
        description: "Mensajes de todas las conversaciones de la clave, del más antiguo al más reciente.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/InboxKeyQuery" }],
        responses: {
          200: {
            description: "Mensajes",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Message" } },
              },
            },
          },
          400: { description: "Falta key o formato inválido" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      delete: {
        summary: "Eliminar una conversación de la bandeja",
        description:
          "Elimina las actividades legacy de Instagram de la clave y sus conversaciones (los mensajes se eliminan en cascada).",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/InboxKeyQuery" }],
        responses: {
          200: {
            description: "Eliminada",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } },
          },
          400: { description: "Falta key o formato inválido" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      patch: {
        summary: "Vincular una conversación a un lead",
        description:
          "Asigna lead_id a las conversaciones unlinked:<igsid> y a sus actividades legacy. Una clave lead: devuelve alreadyLinked: true.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key", "leadId"],
                properties: {
                  key: { type: "string", example: "unlinked:17841400000000000" },
                  leadId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Vinculada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" }, alreadyLinked: { type: "boolean" } },
                },
              },
            },
          },
          400: { description: "Faltan parámetros o formato inválido" },
          401: { description: "No autorizado" },
          404: { description: "Lead no encontrado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/messages/read": {
      patch: {
        summary: "Marcar una conversación como leída",
        description:
          "Pone unread_count = 0 en todas las conversaciones de la clave y read_at en sus actividades legacy no leídas.",
        tags: ["Instagram"],
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key"],
                properties: { key: { type: "string", example: "lead:3f1c2a9e-0000-0000-0000-000000000000" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Marcada como leída",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } },
          },
          400: { description: "Falta key o formato inválido" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      supabaseAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Token de acceso (JWT) de Supabase Auth. Formato: Bearer <token>",
      },
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description:
          "API key del CRM para integraciones (formato crm_...). También se acepta como Authorization: Bearer crm_.... Se crea en POST /api/auth/api-keys y se revoca en DELETE /api/auth/api-keys/{id}.",
      },
    },
    parameters: {
      InboxKeyQuery: {
        name: "key",
        in: "query",
        required: true,
        description: 'Clave de bandeja: "lead:<leadId>" o "unlinked:<igsid>"; resuelve a un conjunto de conversaciones.',
        schema: { type: "string" },
      },
    },
    schemas: {
      // ── Messaging ─────────────────────────────────────────
      Conversation: {
        type: "object",
        description: "Entrada de la bandeja: el conjunto de conversaciones detrás de una clave.",
        properties: {
          id: { type: "string", description: 'Clave: "lead:<leadId>" o "unlinked:<igsid>"' },
          conversationIds: { type: "array", items: { type: "string", format: "uuid" } },
          leadId: { type: "string", format: "uuid", nullable: true },
          leadName: { type: "string" },
          instagramHandle: { type: "string", nullable: true },
          instagramScopedId: { type: "string", nullable: true },
          lastMessage: {
            type: "object",
            properties: {
              text: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              direction: { type: "string", enum: ["inbound", "outbound"] },
            },
          },
          unreadCount: { type: "integer", minimum: 0 },
          isConnected: { type: "boolean" },
          isLinked: { type: "boolean" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          text: { type: "string" },
          direction: { type: "string", enum: ["inbound", "outbound"] },
          timestamp: { type: "string", format: "date-time" },
          status: {
            type: "string",
            enum: ["received", "pending", "sent", "delivered", "read", "failed"],
          },
          errorMessage: { type: "string", nullable: true },
          hint: { type: "string", nullable: true, description: "Sugerencia accionable cuando el envío falló" },
        },
      },
      SendSuccess: {
        type: "object",
        required: ["messageId"],
        properties: { messageId: { type: "string", nullable: true, description: "Id del mensaje en Instagram (mid); null si Meta no lo devolvió" } },
      },
      SendFailure: {
        type: "object",
        required: ["error", "hint"],
        properties: {
          error: { type: "string" },
          hint: { type: "string", nullable: true, example: "Token vencido: reconectá Instagram" },
        },
      },
      SendOutcome: {
        description: "Resultado del canal al enviar: ok con el id externo, o error con hint.",
        oneOf: [
          {
            type: "object",
            required: ["ok", "externalId"],
            properties: { ok: { type: "boolean", enum: [true] }, externalId: { type: "string" } },
          },
          {
            type: "object",
            required: ["ok", "error", "hint"],
            properties: {
              ok: { type: "boolean", enum: [false] },
              error: { type: "string" },
              hint: { type: "string" },
            },
          },
        ],
      },
      // ── Auth ──────────────────────────────────────────────
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "usuario@ejemplo.com" },
          password: { type: "string", format: "password", example: "contrasena123" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          access_token: { type: "string" },
          expires_in: { type: "number" },
          refresh_token: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
            },
          },
        },
      },

      // ── Common ────────────────────────────────────────────
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "Mensaje de error" },
          details: { description: "Detalles adicionales del error (opcional)" },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
        },
      },

      // ── Profile ───────────────────────────────────────────
      Profile: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", nullable: true },
          avatarUrl: { type: "string", format: "uri", nullable: true },
          companyName: { type: "string", nullable: true },
          jobTitle: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          bio: { type: "string", nullable: true },
          website: { type: "string", format: "uri", nullable: true },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          fullName: { type: "string", description: "Nombre completo" },
          avatarUrl: { type: "string", format: "uri", description: "URL del avatar" },
          companyName: { type: "string", description: "Nombre de la empresa" },
          jobTitle: { type: "string", description: "Cargo" },
          phone: { type: "string", description: "Teléfono" },
          bio: { type: "string", description: "Biografía" },
          website: { type: "string", format: "uri", description: "Sitio web" },
        },
      },

      // ── Tags ──────────────────────────────────────────────
      Tag: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          color: { type: "string" },
          userId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateTagRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, example: "Cliente VIP" },
          color: { type: "string", example: "#FF5733" },
        },
      },
      AssignTagRequest: {
        type: "object",
        required: ["tagId", "entityId", "entityType"],
        properties: {
          tagId: { type: "string", format: "uuid" },
          entityId: { type: "string", format: "uuid" },
          entityType: { type: "string", enum: ["lead", "idea"] },
        },
      },

      // ── Notes ─────────────────────────────────────────────
      Note: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          entityId: { type: "string", format: "uuid" },
          entityType: { type: "string", enum: ["lead", "idea"] },
          content: { type: "string" },
          externalId: { type: "string", maxLength: 200, description: "Identificador del cliente (ej. \"cafe-lindo.cl#investigacion\"). Único por usuario: permite upsert" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateNoteRequest: {
        type: "object",
        required: ["content", "entityId", "entityType"],
        properties: {
          content: { type: "string", minLength: 1, description: "Contenido de la nota" },
          entityId: { type: "string", format: "uuid", description: "ID de la entidad (lead o idea)" },
          entityType: { type: "string", enum: ["lead", "idea"], description: "Tipo de entidad" },
          externalId: { type: "string", maxLength: 200, nullable: true, description: "Identificador del cliente. Único por usuario: reenviarlo actualiza en vez de duplicar" },
        },
      },
      UpdateNoteRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, description: "Nuevo contenido de la nota" },
        },
      },

      // ── Ideas ─────────────────────────────────────────────
      IdeaStatus: {
        type: "string",
        enum: ["BACKLOG", "RESEARCHING", "PLANNED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"],
      },
      IdeaPriority: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      },
      Idea: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          priority: { $ref: "#/components/schemas/IdeaPriority" },
          status: { $ref: "#/components/schemas/IdeaStatus" },
          leadId: { type: "string", format: "uuid", nullable: true },
          createdBy: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          archivedAt: { type: "string", format: "date-time", nullable: true },
          tags: {
            type: "array",
            items: { $ref: "#/components/schemas/Tag" },
            nullable: true,
          },
        },
      },
      CreateIdeaRequest: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 1, description: "Título de la idea" },
          description: { type: "string", description: "Descripción" },
          priority: { $ref: "#/components/schemas/IdeaPriority", default: "MEDIUM" },
          status: { $ref: "#/components/schemas/IdeaStatus", default: "BACKLOG" },
          leadId: { type: "string", format: "uuid", nullable: true, description: "ID del lead asociado" },
          tagIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            description: "IDs de etiquetas a asignar",
          },
        },
      },
      UpdateIdeaRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          priority: { $ref: "#/components/schemas/IdeaPriority" },
          status: { $ref: "#/components/schemas/IdeaStatus" },
          leadId: { type: "string", format: "uuid", nullable: true },
          tagIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      ChangeIdeaStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { $ref: "#/components/schemas/IdeaStatus" },
        },
      },

      // ── Activities ────────────────────────────────────────
      ActivityType: {
        type: "string",
        enum: ["CALL", "MEETING", "FOLLOW_UP", "EMAIL", "TASK", "NOTE", "REMINDER", "INVESTIGATION", "ACTION", "INSTAGRAM_MESSAGE"],
      },
      Activity: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          leadId: { type: "string", format: "uuid", nullable: true },
          ideaId: { type: "string", format: "uuid", nullable: true },
          userId: { type: "string", format: "uuid" },
          type: { $ref: "#/components/schemas/ActivityType" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          dueDate: { type: "string", format: "date-time", nullable: true },
          completed: { type: "boolean", deprecated: true, description: "Obsoleto: deriva de status (status='COMPLETED'). Se eliminará junto al drop de la columna." },
          completedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/ActivityAttachment" },
            nullable: true,
          },
          status: { $ref: "#/components/schemas/ActivityStatus" },
          readAt: { type: "string", format: "date-time", nullable: true },
          externalId: { type: "string", maxLength: 200, description: "Identificador del cliente (ej. \"cafe-lindo.cl#correo-1\"). Único por usuario: permite upsert" },
        },
      },
      ActivityStatus: {
        type: "string",
        enum: ["PENDING", "IN_PROGRESS", "COMPLETED"],
        description: "Estado de la actividad (transiciones libres)",
      },
      ActivityAttachment: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string", format: "uri" },
          path: { type: "string" },
          size: { type: "number" },
          type: { type: "string" },
        },
      },
      CreateActivityRequest: {
        type: "object",
        required: ["title", "type"],
        properties: {
          title: { type: "string", minLength: 1, description: "Título de la actividad" },
          type: { $ref: "#/components/schemas/ActivityType" },
          description: { type: "string", description: "Descripción" },
          dueDate: { type: "string", format: "date-time", description: "Fecha de vencimiento" },
          leadId: { type: "string", format: "uuid", description: "ID del lead asociado" },
          ideaId: { type: "string", format: "uuid", description: "ID de la idea asociada" },
          status: { $ref: "#/components/schemas/ActivityStatus", description: "Estado inicial (default PENDING). Usar COMPLETED para un email ya enviado" },
          completedAt: { type: "string", format: "date-time", description: "Cuándo ocurrió (fecha del email enviado), no cuándo vence" },
          externalId: { type: "string", maxLength: 200, nullable: true, description: "Identificador del cliente. Único por usuario: reenviarlo actualiza en vez de duplicar" },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/ActivityAttachment" },
            description: "Archivos adjuntos",
          },
        },
      },
      UpdateActivityRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          type: { $ref: "#/components/schemas/ActivityType" },
          description: { type: "string" },
          dueDate: { type: "string", format: "date-time" },
          leadId: { type: "string", format: "uuid" },
          ideaId: { type: "string", format: "uuid" },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/ActivityAttachment" },
          },
        },
      },
      ChangeActivityStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { $ref: "#/components/schemas/ActivityStatus", description: "Nuevo estado de la actividad" },
        },
      },

      // ── Pipelines ─────────────────────────────────────────
      Pipeline: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          userId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          stages: {
            type: "array",
            items: { $ref: "#/components/schemas/PipelineStage" },
            nullable: true,
            description: "Etapas del pipeline (incluidas en GET por ID)",
          },
        },
      },
      CreatePipelineRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, description: "Nombre del pipeline" },
          description: { type: "string", description: "Descripción" },
        },
      },
      UpdatePipelineRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
        },
      },
      PipelineStage: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          pipelineId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          name: { type: "string" },
          position: { type: "integer" },
          color: { type: "string" },
          isClosed: { type: "boolean" },
          isWon: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateStageRequest: {
        type: "object",
        required: ["name", "position"],
        properties: {
          name: { type: "string", minLength: 1, description: "Nombre de la etapa" },
          position: { type: "integer", minimum: 0, description: "Posición en el pipeline" },
          color: { type: "string", description: "Color (hex)" },
          isClosed: { type: "boolean", description: "Indica si la etapa es de cierre" },
          isWon: { type: "boolean", description: "Indica si la etapa es de ganado" },
        },
      },
      UpdateStageRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          position: { type: "integer", minimum: 0 },
          color: { type: "string" },
          isClosed: { type: "boolean" },
          isWon: { type: "boolean" },
        },
      },
      ReorderStagesRequest: {
        type: "object",
        required: ["stageIds"],
        properties: {
          stageIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            description: "IDs de las etapas en el nuevo orden",
          },
        },
      },

      // ── Leads ─────────────────────────────────────────────
      ValidationError: {
        type: "object",
        description: "Error de validación con un mensaje por campo, para mostrarlo en la UI del cliente",
        properties: {
          error: { type: "string", example: "Error de validación" },
          fields: {
            type: "object",
            additionalProperties: { type: "string" },
            example: { rating: "Expected number" },
          },
        },
      },
      CreateLeadRequest: {
        type: "object",
        description:
          "Contrato canónico en inglés. company y source son obligatorios; email es opcional. Los campos en español son alias deprecated que se seguirán aceptando por compatibilidad. Si se envía externalId, el POST hace upsert (201 al crear, 200 al actualizar) y en la actualización solo se escriben los campos enviados: `null` o ausente = conservar, `\"\"` = borrar. Los campos numéricos aceptan también string numérico.",
        properties: {
          company: {
            type: "string",
            minLength: 1,
            description: "Empresa (canónico)",
            example: "Mi Empresa S.A.",
          },
          source: {
            type: "string",
            minLength: 1,
            description: "Origen del lead (canónico)",
            example: "Campana Web 2024",
          },
          email: {
            type: "string",
            format: "email",
            description: "Opcional: los leads que sólo tienen WhatsApp o Instagram no tienen email.",
            example: "contacto@miempresa.com",
          },
          name: {
            type: "string",
            description: "Nombre del contacto. Si falta, se usa la empresa.",
            example: "Juan Pérez",
          },
          phone: {
            type: "string",
            example: "+54 9 341 555 5555",
          },
          address: {
            type: "string",
            description: "Dirección del lead",
            example: "Av. Corrientes 1234, CABA",
          },
          website: {
            type: "string",
            format: "uri",
            description: "Sitio web del lead",
            example: "https://miempresa.com",
          },
          notes: {
            type: "string",
            example: "Interesado en servicios de consultoría.",
          },
          status: {
            type: "string",
            example: "Nuevo",
            default: "Nuevo",
          },
          externalId: {
            type: "string",
            maxLength: 200,
            description:
              "Identificador propio del cliente (por ejemplo el dominio). Único por usuario; habilita el upsert idempotente.",
            example: "miempresa.com",
          },
          city: {
            type: "string",
            description: "Ciudad o comuna",
            example: "Rosario",
          },
          industry: {
            type: "string",
            description: "Rubro",
            example: "Retail",
          },
          opportunityScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            nullable: true,
            description: "Puntaje de oportunidad importado (0-100). Acepta `\"87\"`",
            example: 87,
          },
          rating: {
            type: "number",
            format: "float",
            minimum: 0,
            maximum: 5,
            nullable: true,
            description: "Rating de reseñas (0-5). Acepta `\"4.9\"`",
            example: 4.5,
          },
          reviewsCount: {
            type: "integer",
            minimum: 0,
            nullable: true,
            description: "Cantidad de reseñas. Acepta `\"132\"`",
            example: 132,
          },

          instagramHandle: {
            type: "string",
            description: "Handle de Instagram (ej. @usuario)",
            example: "@usuario",
          },
          instagramScopedId: {
            type: "string",
            description: "ID numérico de Instagram del lead (para enviar DMs)",
            example: "17841445859210403",
          },
          jobTitle: {
            type: "string",
            description: "Cargo del contacto",
            example: "CEO",
          },
          linkedinUrl: {
            type: "string",
            format: "uri",
            description: "URL del perfil de LinkedIn",
            example: "https://linkedin.com/in/juanperez",
          },
          estimatedValue: {
            type: "number",
            format: "float",
            nullable: true,
            description: "Valor estimado de la oportunidad (para priorización). Acepta `\"25000\"`",
            example: 25000.00,
          },
          nextFollowUp: {
            type: "string",
            format: "date-time",
            description: "Próxima fecha de seguimiento",
            example: "2026-08-15T10:00:00Z",
          },
          empresa: {
            type: "string",
            deprecated: true,
            description: "Alias deprecated de company",
            example: "Mi Empresa S.A.",
          },
          origen: {
            type: "string",
            deprecated: true,
            description: "Alias deprecated de source",
            example: "Campana Web 2024",
          },
          nombre: {
            type: "string",
            deprecated: true,
            description: "Alias deprecated de name",
          },
          telefono: {
            type: "string",
            deprecated: true,
            description: "Alias deprecated de phone",
          },
          direccion: {
            type: "string",
            deprecated: true,
            description: "Alias deprecated de address",
          },
          sitio_web: {
            type: "string",
            format: "uri",
            deprecated: true,
            description: "Alias deprecated de website",
          },
          notas: {
            type: "string",
            deprecated: true,
            description: "Alias deprecated de notes",
          },
        },
      },
      ApiKey: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Prospector" },
          key_prefix: { type: "string", description: "Primeros caracteres, para reconocer la key", example: "crm_AbCdEfGh" },
          last_used_at: { type: "string", format: "date-time", nullable: true },
          revoked_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      CreateApiKeyRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 80, example: "Prospector" },
        },
      },
      ApiKeyCreated: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Prospector" },
          prefix: { type: "string", example: "crm_AbCdEfGh" },
          key: {
            type: "string",
            description: "Valor en claro. Se muestra una sola vez; no se puede recuperar después.",
            example: "crm_AbCdEfGh...",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Lead: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          company: { type: "string" },
          email: { type: "string", format: "email", nullable: true, description: "Opcional" },
          phone: { type: "string", nullable: true },
          address: { type: "string", nullable: true, description: "Dirección del lead" },
          website: { type: "string", format: "uri", nullable: true, description: "Sitio web del lead" },
          status: { type: "string", example: "Nuevo" },
          source: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          userId: { type: "string", format: "uuid" },
          pipelineId: { type: "string", format: "uuid", nullable: true },
          stageId: { type: "string", format: "uuid", nullable: true },
          instagramHandle: { type: "string", nullable: true, description: "Handle de Instagram" },
          instagramScopedId: { type: "string", nullable: true, description: "ID numérico de Instagram del lead" },
          jobTitle: { type: "string", nullable: true, description: "Cargo del contacto" },
          linkedinUrl: { type: "string", format: "uri", nullable: true, description: "URL de LinkedIn" },
          estimatedValue: { type: "number", format: "float", nullable: true, description: "Valor estimado" },
          nextFollowUp: { type: "string", format: "date-time", nullable: true, description: "Próximo seguimiento" },
          externalId: { type: "string", nullable: true, description: "Identificador externo (único por usuario)" },
          city: { type: "string", nullable: true, description: "Ciudad o comuna" },
          industry: { type: "string", nullable: true, description: "Rubro" },
          opportunityScore: { type: "integer", minimum: 0, maximum: 100, nullable: true, description: "Puntaje de oportunidad importado" },
          rating: { type: "number", format: "float", minimum: 0, maximum: 5, nullable: true, description: "Rating de reseñas" },
          reviewsCount: { type: "integer", minimum: 0, nullable: true, description: "Cantidad de reseñas" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateLeadRequest: {
        type: "object",
        description: "Todos los campos son opcionales. Un string vacío limpia el valor.",
        properties: {
          name: { type: "string", minLength: 1, description: "Nombre del contacto" },
          company: { type: "string", minLength: 1, description: "Empresa" },
          email: { type: "string", format: "email", nullable: true, description: "Email (opcional; '' o null lo limpia)" },
          phone: { type: "string", description: "Teléfono" },
          address: { type: "string", description: "Dirección del lead" },
          website: { type: "string", format: "uri", description: "Sitio web del lead" },
          source: { type: "string", description: "Origen" },
          notes: { type: "string", description: "Notas" },
          status: { type: "string", description: "Estado del lead", example: "Nuevo" },
          pipelineId: { type: "string", format: "uuid", nullable: true, description: "ID del pipeline" },
          stageId: { type: "string", format: "uuid", nullable: true, description: "ID de la etapa" },
          instagramHandle: { type: "string", description: "Handle de Instagram (ej. @usuario)" },
          instagramScopedId: { type: "string", description: "ID numérico de Instagram del lead" },
          jobTitle: { type: "string", description: "Cargo del contacto" },
          linkedinUrl: { type: "string", format: "uri", description: "URL del perfil de LinkedIn" },
          estimatedValue: { type: "number", format: "float", nullable: true, description: "Valor estimado de la oportunidad" },
          nextFollowUp: { type: "string", format: "date-time", nullable: true, description: "Próxima fecha de seguimiento" },
          externalId: { type: "string", maxLength: 200, description: "Identificador externo (único por usuario)" },
          city: { type: "string", description: "Ciudad o comuna" },
          industry: { type: "string", description: "Rubro" },
          opportunityScore: { type: "integer", minimum: 0, maximum: 100, nullable: true, description: "Puntaje de oportunidad" },
          rating: { type: "number", format: "float", minimum: 0, maximum: 5, nullable: true, description: "Rating de reseñas" },
          reviewsCount: { type: "integer", minimum: 0, nullable: true, description: "Cantidad de reseñas" },
        },
      },
      LeadStatusCatalog: {
        type: "object",
        properties: {
          statuses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", example: "Interesado" },
                stageId: { type: "string", format: "uuid" },
                pipelineId: { type: "string", format: "uuid" },
                pipelineName: { type: "string", example: "Pipeline de Ventas" },
                position: { type: "integer", example: 3 },
                color: { type: "string", example: "#f59e0b" },
                isClosed: { type: "boolean" },
                isWon: { type: "boolean" },
              },
            },
          },
          names: {
            type: "array",
            description: "Atajo plano del catálogo, en orden de etapa",
            items: { type: "string" },
            example: ["Nuevo", "Contactado", "Interesado", "Propuesta", "Ganado", "Perdido"],
          },
          default: {
            type: "string",
            description: "Estado que se aplica al crear un lead sin `status`",
            example: "Nuevo",
          },
        },
      },
      ChangeLeadStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            example: "Nuevo",
            description: "Nuevo estado del lead. Debe ser una de las etapas publicadas por `GET /api/leads/statuses`",
          },
        },
      },
    },
  },
};

export const runtime = 'nodejs';

// CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request) ?? new Response(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  return withCors(NextResponse.json(openapi), origin);
}
