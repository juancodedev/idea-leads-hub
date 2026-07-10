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
        summary: "Crear nota",
        description: "Crea una nueva nota asociada a un lead o idea.",
        tags: ["Notes"],
        security: [{ supabaseAuth: [] }],
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
        summary: "Crear actividad",
        description: "Crea una nueva actividad (llamada, reunión, tarea, etc.).",
        tags: ["Activities"],
        security: [{ supabaseAuth: [] }],
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
        description: "Obtiene todos los leads con filtros opcionales por status y búsqueda por texto.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["Nuevo", "Contactado", "Interesado", "Propuesta", "Ganado", "Perdido"] },
            description: "Filtrar por estado",
          },
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Búsqueda por empresa, nombre, email o sitio web",
          },
        ],
        responses: {
          200: {
            description: "Lista de leads",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Lead" },
                },
              },
            },
          },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
      post: {
        summary: "Crear un nuevo lead",
        description: "Permite cargar un nuevo lead en el sistema con validación estricta y autenticación.",
        tags: ["Leads"],
        security: [{ supabaseAuth: [] }],
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
            description: "Lead creado exitosamente",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          400: { description: "Error de validación o datos incorrectos" },
          401: { description: "No autorizado" },
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/{id}": {
      get: {
        summary: "Obtener lead",
        description: "Obtiene un lead por su ID.",
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
        description: "Actualiza parcialmente un lead con campos en inglés.",
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
        description: "Elimina un lead por su ID.",
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
          500: { description: "Error interno del servidor" },
        },
      },
    },
    "/api/leads/{id}/status": {
      patch: {
        summary: "Cambiar estado de lead",
        description: "Cambia el estado de un lead.",
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
  },
  components: {
    securitySchemes: {
      supabaseAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Token de acceso (JWT) de Supabase Auth. Formato: Bearer <token>",
      },
    },
    schemas: {
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
        enum: ["CALL", "MEETING", "FOLLOW_UP", "EMAIL", "TASK", "NOTE", "REMINDER", "INVESTIGATION", "ACTION"],
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
          completed: { type: "boolean" },
          completedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/ActivityAttachment" },
            nullable: true,
          },
        },
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
          completed: { type: "boolean" },
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
      CreateLeadRequest: {
        type: "object",
        required: ["empresa", "email", "origen"],
        properties: {
          empresa: {
            type: "string",
            example: "Mi Empresa S.A.",
          },
          email: {
            type: "string",
            format: "email",
            example: "contacto@miempresa.com",
          },
          origen: {
            type: "string",
            example: "Campana Web 2024",
          },
          nombre: {
            type: "string",
            example: "Juan Pérez",
          },
          telefono: {
            type: "string",
            example: "+34 600000000",
          },
          direccion: {
            type: "string",
            description: "Dirección del lead",
            example: "Av. Corrientes 1234, CABA",
          },
          sitio_web: {
            type: "string",
            format: "uri",
            description: "Sitio web del lead",
            example: "https://miempresa.com",
          },
          notas: {
            type: "string",
            example: "Interesado en servicios de consultoría.",
          },
          status: {
            type: "string",
            enum: ["Nuevo", "Contactado", "Interesado", "Propuesta", "Ganado", "Perdido"],
            default: "Nuevo",
          },
        },
      },
      Lead: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          company: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string", nullable: true },
          address: { type: "string", nullable: true, description: "Dirección del lead" },
          website: { type: "string", format: "uri", nullable: true, description: "Sitio web del lead" },
          status: { type: "string", enum: ["Nuevo", "Contactado", "Interesado", "Propuesta", "Ganado", "Perdido"] },
          source: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          userId: { type: "string", format: "uuid" },
          pipelineId: { type: "string", format: "uuid", nullable: true },
          stageId: { type: "string", format: "uuid", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateLeadRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, description: "Nombre del contacto" },
          company: { type: "string", minLength: 1, description: "Empresa" },
          email: { type: "string", format: "email", description: "Email" },
          phone: { type: "string", description: "Teléfono" },
          address: { type: "string", description: "Dirección del lead" },
          website: { type: "string", format: "uri", description: "Sitio web del lead" },
          source: { type: "string", description: "Origen" },
          notes: { type: "string", description: "Notas" },
          pipelineId: { type: "string", format: "uuid", nullable: true, description: "ID del pipeline" },
          stageId: { type: "string", format: "uuid", nullable: true, description: "ID de la etapa" },
        },
      },
      ChangeLeadStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["Nuevo", "Contactado", "Interesado", "Propuesta", "Ganado", "Perdido"],
            description: "Nuevo estado del lead",
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
