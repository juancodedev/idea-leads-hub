import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { CreateLead } from '@/core/application/leads/CreateLead';
import { ApiCreateLeadSchema } from '@/core/domain/LeadSchema';

/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Crear un nuevo lead
 *     description: Permite cargar un nuevo lead en el sistema con validación estricta y autenticación.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - empresa
 *               - email
 *               - origen
 *             properties:
 *               empresa:
 *                 type: string
 *                 example: "Mi Empresa S.A."
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contacto@miempresa.com"
 *               origen:
 *                 type: string
 *                 example: "Campana Web 2024"
 *               nombre:
 *                 type: string
 *                 example: "Juan Pérez"
 *               telefono:
 *                 type: string
 *                 example: "+34 600000000"
 *               notas:
 *                 type: string
 *                 example: "Interesado en servicios de consultoría."
 *               status:
 *                 type: string
 *                 enum: [Nuevo, Contactado, Interesado, Propuesta, Ganado, Perdido]
 *                 default: Nuevo
 *     responses:
 *       201:
 *         description: Lead creado exitosamente
 *       400:
 *         description: Error de validación o datos incorrectos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere una sesión válida.' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = ApiCreateLeadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Error de validación', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Dependency Injection (Hexagonal Architecture)
    const repository = new SupabaseLeadRepository(supabase);
    const useCase = new CreateLead(repository);

    // Map API fields to DTO
    const lead = await useCase.execute({
      company: data.empresa,
      email: data.email,
      source: data.origen,
      name: data.nombre || data.empresa, // Default name to company if not provided
      phone: data.telefono,
      notes: data.notas,
      status: data.status || 'Nuevo'
    });

    return NextResponse.json(lead, { status: 201 });

  } catch (error: any) {
    console.error('API Lead Error:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Cuerpo de la solicitud mal formado (JSON inválido)' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', message: error.message },
      { status: 500 }
    );
  }
}
