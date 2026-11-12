import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';

export const runtime = 'nodejs';

/**
 * @openapi
 * /api/auth/api-keys/{id}:
 *   delete:
 *     summary: Revocar una API key
 *     description: Marca la API key como revocada. Las integraciones que la usen reciben 401.
 *     security:
 *       - supabaseAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: API key revocada
 *       401:
 *         description: No autorizado
 *       404:
 *         description: API key no encontrada
 */
export const DELETE = apiHandler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const { supabase, user } = await withAuth(request);

    const { data, error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();

    const revoked = data as unknown as { id: string } | null;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!revoked) throw new NotFoundError('API key no encontrada');

    return new NextResponse(null, { status: 204 });
  }
);
