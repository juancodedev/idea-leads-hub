import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseIdeaRepository } from '@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository';
import { GetIdeas } from '@/modules/ideas/application/use-cases/GetIdeas';
import { CreateIdea } from '@/modules/ideas/application/use-cases/CreateIdea';
import { IdeaStatus, IdeaPriority } from '@/modules/ideas/domain/enums/IdeaEnums';

export const runtime = 'nodejs';

const CreateIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.nativeEnum(IdeaPriority).optional().default(IdeaPriority.MEDIUM),
  status: z.nativeEnum(IdeaStatus).optional().default(IdeaStatus.BACKLOG),
  leadId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get('status');
  const leadIdParam = searchParams.get('leadId');

  const filters: { status?: IdeaStatus; leadId?: string } = {};
  if (statusParam && Object.values(IdeaStatus).includes(statusParam as IdeaStatus)) {
    filters.status = statusParam as IdeaStatus;
  }
  if (leadIdParam) {
    filters.leadId = leadIdParam;
  }

  const repo = new SupabaseIdeaRepository(supabase);
  const useCase = new GetIdeas(repo);
  const ideas = await useCase.execute(filters);
  return NextResponse.json(ideas, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = CreateIdeaSchema.parse(body);

  const repo = new SupabaseIdeaRepository(supabase);
  const useCase = new CreateIdea(repo);
  const idea = await useCase.execute(data);
  return NextResponse.json(idea, { status: 201 });
});
