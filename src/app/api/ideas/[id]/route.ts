import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseIdeaRepository } from '@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository';
import { UpdateIdea } from '@/modules/ideas/application/use-cases/UpdateIdea';
import { DeleteIdea } from '@/modules/ideas/application/use-cases/DeleteIdea';
import { IdeaPriority, IdeaStatus } from '@/modules/ideas/domain/enums/IdeaEnums';

export const runtime = 'nodejs';

const UpdateIdeaSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(IdeaPriority).optional(),
  status: z.nativeEnum(IdeaStatus).optional(),
  leadIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const GET = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseIdeaRepository(supabase);
  const idea = await repo.getById(id);

  if (!idea) {
    return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
  }

  return NextResponse.json(idea, { status: 200 });
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = UpdateIdeaSchema.parse(body);

  const repo = new SupabaseIdeaRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Idea not found');

  const useCase = new UpdateIdea(repo);
  const idea = await useCase.execute({ id, ...data });
  return NextResponse.json(idea, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseIdeaRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Idea not found');

  const useCase = new DeleteIdea(repo);
  await useCase.execute(id);
  return new NextResponse(null, { status: 204 });
});
