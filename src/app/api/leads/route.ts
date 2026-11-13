import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { CreateLead } from '@/core/application/leads/CreateLead';
import { buildLeadCreateDTO, buildLeadPatch } from '@/core/application/leads/leadPayload';
import { ApiCreateLeadSchema } from '@/core/domain/LeadSchema';
import { fieldErrors } from '@/lib/api/validation';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';
import { assertKnownStatus } from '@/core/application/leads/leadStatuses';

/** `updatedSince` accepts an ISO-8601 instant with a Z or a numeric offset. */
const IsoInstant = z.string().datetime({ offset: true });

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

  const updatedSinceParam = searchParams.get('updatedSince');
  if (updatedSinceParam !== null) {
    const parsed = IsoInstant.safeParse(updatedSinceParam);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', fields: { updatedSince: 'Expected ISO-8601 date' } },
        { status: 400 }
      );
    }
  }

  const orderParam = searchParams.get('order');
  // Captured before the query so anything that changes during it is still newer
  // than the cursor the client will use next.
  const serverTime = new Date().toISOString();
  const repo = new SupabaseLeadRepository(supabase, scopedUserId);
  const result = await repo.search({
    query: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    order: orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined,
    updatedSince: updatedSinceParam ?? undefined,
    page: parseInt(searchParams.get('page') || '1', 10) || 1,
    limit: parseInt(searchParams.get('limit') || '25', 10) || 25,
  });

  return NextResponse.json({
    data: result.data,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    limit: result.limit,
    /** Use as the next `updatedSince` instead of the client's own clock. */
    serverTime,
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
        fields: fieldErrors(validation.error),
      },
      { status: 400 }
    );
  }

  const data = validation.data;

  if (data.status) {
    // No pipeline in the payload: the whole catalog is valid.
    await assertKnownStatus(data.status, new SupabasePipelineRepository(supabase, scopedUserId));
  }

  // Dependency Injection (Hexagonal Architecture)
  const repository = new SupabaseLeadRepository(supabase, scopedUserId);

  if (data.externalId) {
    // Defaults (status 'Nuevo', name = company) are applied only when the lead
    // is actually created. On update, only the fields the client sent are
    // written, so a re-send cannot reset what the user changed in the CRM.
    const { lead, created } = await repository.upsertByExternalId(
      data.externalId,
      buildLeadCreateDTO(data),
      buildLeadPatch(data)
    );
    return NextResponse.json(lead, { status: created ? 201 : 200 });
  }

  const useCase = new CreateLead(repository);
  const lead = await useCase.execute(buildLeadCreateDTO(data));

  return NextResponse.json(lead, { status: 201 });
});
