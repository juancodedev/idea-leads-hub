import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { generateApiKey } from '@/lib/api/api-key';

export const runtime = 'nodejs';

const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
}).strict();

/**
 * @openapi
 * /api/auth/api-keys:
 *   get:
 *     summary: Listar las API keys del usuario
 *     description: Devuelve las API keys propias (sin el valor en claro) para auditar cuáles están activas.
 *     security:
 *       - supabaseAuth: []
 *     responses:
 *       200:
 *         description: Lista de API keys
 *       401:
 *         description: No autorizado
 *   post:
 *     summary: Crear una API key para integraciones
 *     description: Genera una API key de máquina. El valor en claro se devuelve una sola vez; en la base solo queda el hash.
 *     security:
 *       - supabaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Prospector"
 *     responses:
 *       201:
 *         description: API key creada (el campo key no se puede recuperar después)
 *       400:
 *         description: Error de validación
 *       401:
 *         description: No autorizado
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);

  const body = await request.json();
  const validation = CreateApiKeySchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Error de validación', details: validation.error.format() },
      { status: 400 }
    );
  }

  const generated = generateApiKey();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name: validation.data.name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
    } as never)
    .select('id, name, key_prefix, created_at')
    .single();

  const created = data as unknown as {
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
  } | null;

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo crear la API key' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      prefix: created.key_prefix,
      key: generated.key,
      createdAt: created.created_at,
    },
    { status: 201 }
  );
});
