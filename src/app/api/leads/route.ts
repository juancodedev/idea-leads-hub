import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { CreateLead } from '@/core/application/leads/CreateLead';
import { ApiCreateLeadSchema } from '@/core/domain/LeadSchema';

/**
 * @openapi
 * /api/leads:
 *   get:
 *     summary: Listar leads
 *     description: Lista paginada de leads. Acepta sesión o API key del CRM.
 *     security:
 *       - supabaseAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         schema: { type: string }
 *         description: Busca por nombre, empresa, email o externalId.
 *       - name: status
 *         in: query
 *         schema: { type: string }
 *       - name: source
 *         in: query
 *         schema: { type: string }
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [name, company, email, status, createdAt, updatedAt, estimatedValue, opportunityScore, rating]
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 25 }
 *     responses:
 *       200:
 *         description: Lista paginada de leads
 *       401:
 *         description: No autorizado
 *   post:
 *     summary: Crear o actualizar (upsert) un lead
 *     description: >
 *       Crea un lead con validación estricta. Si se envía `externalId` y ya existe
 *       un lead del mismo usuario con ese identificador, se actualiza y responde 200;
 *       si no existe, se crea y responde 201. Así un reintento o un backfill repetido
 *       no duplica leads.
 *     security:
 *       - supabaseAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLeadRequest'
 *     responses:
 *       201:
 *         description: Lead creado
 *       200:
 *         description: Lead existente actualizado por externalId
 *       400:
 *         description: Error de validación
 *       401:
 *         description: No autorizado
 */

export const runtime = 'nodejs';

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, scopedUserId } = await withAuth(request, { allowApiKey: true });
  const { searchParams } = new URL(request.url);

  const repo = new SupabaseLeadRepository(supabase, scopedUserId);
  const result = await repo.search({
    query: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    order: (searchParams.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    page: parseInt(searchParams.get('page') || '1', 10) || 1,
    limit: parseInt(searchParams.get('limit') || '25', 10) || 25,
  });

  return NextResponse.json({
    data: result.data,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    limit: result.limit,
  }, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase, scopedUserId } = await withAuth(request, { allowApiKey: true });

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
  const repository = new SupabaseLeadRepository(supabase, scopedUserId);

  // English is the canonical contract; Spanish aliases stay for backward compat.
  const dto = {
    company: data.company || data.empresa!,
    email: data.email,
    source: data.source || data.origen!,
    name: data.name || data.nombre || data.company || data.empresa!,
    phone: data.phone || data.telefono,
    address: data.address || data.direccion,
    website: data.website || data.sitio_web,
    notes: data.notes || data.notas,
    status: data.status || 'Nuevo',
    instagramHandle: data.instagramHandle,
    instagramScopedId: data.instagramScopedId,
    jobTitle: data.jobTitle,
    linkedinUrl: data.linkedinUrl,
    estimatedValue: data.estimatedValue,
    nextFollowUp: data.nextFollowUp,
    externalId: data.externalId,
    city: data.city,
    industry: data.industry,
    opportunityScore: data.opportunityScore,
    rating: data.rating,
    reviewsCount: data.reviewsCount,
  };

  if (dto.externalId) {
    const { lead, created } = await repository.upsertByExternalId({
      ...dto,
      externalId: dto.externalId,
    });
    return NextResponse.json(lead, { status: created ? 201 : 200 });
  }

  const useCase = new CreateLead(repository);
  const lead = await useCase.execute(dto);

  return NextResponse.json(lead, { status: 201 });
});
