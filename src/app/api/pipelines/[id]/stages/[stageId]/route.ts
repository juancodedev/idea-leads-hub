import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';

export const runtime = 'nodejs';

const UpdateStageSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
  color: z.string().optional(),
  isClosed: z.boolean().optional(),
  isWon: z.boolean().optional(),
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string; stageId: string }> }) => {
  const { stageId } = await context.params;
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = UpdateStageSchema.parse(body);

  const repo = new SupabasePipelineRepository(supabase);
  const stage = await repo.updateStage(stageId, data);
  return NextResponse.json(stage, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string; stageId: string }> }) => {
  const { stageId } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabasePipelineRepository(supabase);
  await repo.deleteStage(stageId);
  return new NextResponse(null, { status: 204 });
});
