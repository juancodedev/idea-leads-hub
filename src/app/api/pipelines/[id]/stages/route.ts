import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';

export const runtime = 'nodejs';

const CreateStageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.number().int().min(0, 'Position is required'),
  color: z.string().optional(),
  isClosed: z.boolean().optional(),
  isWon: z.boolean().optional(),
});

export const GET = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabasePipelineRepository(supabase);
  const stages = await repo.getStages(context.params.id);
  return NextResponse.json(stages, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = CreateStageSchema.parse(body);

  const repo = new SupabasePipelineRepository(supabase);
  const stage = await repo.createStage({
    pipelineId: context.params.id,
    name: data.name,
    position: data.position,
    color: data.color,
    isClosed: data.isClosed,
    isWon: data.isWon,
  });
  return NextResponse.json(stage, { status: 201 });
});
