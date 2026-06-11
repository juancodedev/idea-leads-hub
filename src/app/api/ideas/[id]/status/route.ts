import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseIdeaRepository } from '@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository';
import { MoveIdeaStatus } from '@/modules/ideas/application/use-cases/MoveIdeaStatus';
import { IdeaStatus } from '@/modules/ideas/domain/enums/IdeaEnums';

export const runtime = 'nodejs';

const ChangeStatusSchema = z.object({
  status: z.nativeEnum(IdeaStatus, { errorMap: () => ({ message: 'Invalid status value' }) }),
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const { status } = ChangeStatusSchema.parse(body);

  const repo = new SupabaseIdeaRepository(supabase);
  const existing = await repo.getById(context.params.id);
  if (!existing) throw new NotFoundError('Idea not found');

  const useCase = new MoveIdeaStatus(repo);
  const idea = await useCase.execute(context.params.id, status);
  return NextResponse.json(idea, { status: 200 });
});
