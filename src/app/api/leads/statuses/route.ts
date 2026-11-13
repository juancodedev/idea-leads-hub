import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';
import { DEFAULT_LEAD_STATUS } from '@/core/domain/Lead';

export const runtime = 'nodejs';

/**
 * @openapi
 * /api/leads/statuses:
 *   get:
 *     summary: Catálogo de estados válidos de un lead
 *     description: >
 *       Publica los valores válidos de `status`. No son fijos: son las etapas
 *       del pipeline del usuario, así que el catálogo cambia si renombra o crea
 *       etapas. `PATCH /api/leads/{id}/status` valida contra esta misma lista.
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
 *               type: object
 *               properties:
 *                 statuses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string, example: "Interesado" }
 *                       stageId: { type: string, format: uuid }
 *                       pipelineId: { type: string, format: uuid }
 *                       pipelineName: { type: string, example: "Pipeline de Ventas" }
 *                       position: { type: integer, example: 3 }
 *                       color: { type: string, example: "#f59e0b" }
 *                       isClosed: { type: boolean }
 *                       isWon: { type: boolean }
 *                 names:
 *                   type: array
 *                   description: Atajo plano del catálogo, en orden de etapa
 *                   items: { type: string }
 *                   example: ["Nuevo", "Contactado", "Interesado", "Propuesta", "Ganado", "Perdido"]
 *                 default:
 *                   type: string
 *                   description: Estado que se aplica al crear un lead sin `status`
 *                   example: "Nuevo"
 *       401: { description: "No autorizado" }
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, scopedUserId } = await withAuth(request, { allowApiKey: true });
  const repo = new SupabasePipelineRepository(supabase, scopedUserId);
  const pipelines = await repo.getAll();

  const statuses = pipelines.flatMap((pipeline) =>
    (pipeline.stages ?? []).map((stage) => ({
      name: stage.name,
      stageId: stage.id,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      position: stage.position,
      color: stage.color,
      isClosed: stage.isClosed,
      isWon: stage.isWon,
    }))
  );

  return NextResponse.json(
    {
      statuses,
      names: statuses.map((s) => s.name),
      /** The create default, even when no stage carries that name anymore. */
      default: DEFAULT_LEAD_STATUS,
    },
    { status: 200 }
  );
});