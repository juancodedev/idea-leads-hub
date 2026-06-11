import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';

export const runtime = 'nodejs';

const ReorderStagesSchema = z.object({
  stageIds: z.array(z.string()).min(1, 'At least one stage ID is required'),
});

export const PUT = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const { stageIds } = ReorderStagesSchema.parse(body);

  const repo = new SupabasePipelineRepository(supabase);
  const stages = stageIds.map((id, index) => ({ id, position: index }));
  await repo.reorderStages(stages);
  return NextResponse.json({ success: true }, { status: 200 });
});
