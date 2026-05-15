import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
}).strict();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Autenticar usuario y obtener token
 *     description: Permite obtener un token de sesión (JWT) proporcionando email y contraseña.
 *     tags: ["Auth"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "usuario@ejemplo.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "mi-contrasena-segura"
 *     responses:
 *       200:
 *         description: Autenticación exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: Credenciales incorrectas
 *       500:
 *         description: Error interno del servidor
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Parse and validate body
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Error de validación', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Credenciales inválidas', message: error.message },
        { status: 401 }
      );
    }

    // Return the session data (includes access_token)
    return NextResponse.json({
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      }
    });

  } catch (error: any) {
    console.error('API Login Error:', error);
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
