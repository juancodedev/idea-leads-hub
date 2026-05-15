import { NextResponse } from 'next/server';

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
    "/api/leads": {
      post: {
        summary: "Crear un nuevo lead",
        description: "Permite cargar un nuevo lead en el sistema con validación estricta y autenticación.",
        tags: ["Leads"],
        security: [
          {
            supabaseAuth: [],
          },
        ],
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
                schema: {
                  $ref: "#/components/schemas/Lead",
                },
              },
            },
          },
          400: {
            description: "Error de validación o datos incorrectos",
          },
          401: {
            description: "No autorizado",
          },
          500: {
            description: "Error interno del servidor",
          },
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
          email: { type: "string" },
          status: { type: "string" },
          source: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json(openapi);
}
