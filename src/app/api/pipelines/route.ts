import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';

export const runtime = 'nodejs';

const CreatePipelineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabasePipelineRepository(supabase);
  const pipelines = await repo.getAll();
  return NextResponse.json(pipelines, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = CreatePipelineSchema.parse(body);

  const repo = new SupabasePipelineRepository(supabase);
  const pipeline = await repo.create(data);
  return NextResponse.json(pipeline, { status: 201 });
});
