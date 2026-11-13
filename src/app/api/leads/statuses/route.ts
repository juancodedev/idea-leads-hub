import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';
import { buildStatusCatalog } from '@/core/application/leads/leadStatuses';

export const runtime = 'nodejs';

/**
 * @openapi
 * /api/leads/statuses:
 *   get:
 *     summary: Catálogo de estados válidos de un lead
 *     description: >
 *       Publica los valores válidos de `status`. No son fijos: son las etapas
 *       del pipeline del usuario, así que el catálogo cambia si renombra o crea
 *       etapas. `doNotContact: true` marca los estados que significan "no
 *       escribirle más a este lead"; la integración corta su secuencia ahí.
 *     tags: [Leads]
 *     security:
 *       - supabaseAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Catálogo de estados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: "#/components/schemas/LeadStatusOption" }
 *       401: { description: "No autorizado" }
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, scopedUserId } = await withAuth(request, { allowApiKey: true });
  const repo = new SupabasePipelineRepository(supabase, scopedUserId);
  const pipelines = await repo.getAll();

  return NextResponse.json(buildStatusCatalog(pipelines), { status: 200 });
});