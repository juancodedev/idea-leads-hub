import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';

export const runtime = 'nodejs';

const UpdatePipelineSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const GET = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabasePipelineRepository(supabase);
  const pipeline = await repo.getById(context.params.id);

  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }

  return NextResponse.json(pipeline, { status: 200 });
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = UpdatePipelineSchema.parse(body);

  const repo = new SupabasePipelineRepository(supabase);
  const existing = await repo.getById(context.params.id);
  if (!existing) throw new NotFoundError('Pipeline not found');

  const pipeline = await repo.update(context.params.id, data);
  return NextResponse.json(pipeline, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabasePipelineRepository(supabase);
  const existing = await repo.getById(context.params.id);
  if (!existing) throw new NotFoundError('Pipeline not found');

  await repo.delete(context.params.id);
  return new NextResponse(null, { status: 204 });
});
