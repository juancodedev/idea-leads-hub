import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { UpdateActivity } from '@/core/application/activities/UpdateActivity';
import { DeleteActivity } from '@/core/application/activities/DeleteActivity';
import { ActivityType } from '@/modules/activities/domain/enums/ActivityType';

export const runtime = 'nodejs';

const UpdateActivitySchema = z.object({
  title: z.string().min(1).optional(),
  type: z.nativeEnum(ActivityType).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().transform((s) => new Date(s)).optional(),
  leadId: z.string().uuid().optional(),
  ideaId: z.string().uuid().optional(),
  // Rollout: `completed` dropped — status transitions go through the status
  // surface (PATCH /status / repo.moveStatus), which dual-writes `completed`.
});

export const GET = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseActivityRepository(supabase);
  const activity = await repo.getById(id);

  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  return NextResponse.json(activity, { status: 200 });
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = UpdateActivitySchema.parse(body);

  const repo = new SupabaseActivityRepository(supabase);
  const useCase = new UpdateActivity(repo);
  const activity = await useCase.execute(id, data);
  return NextResponse.json(activity, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseActivityRepository(supabase);
  const useCase = new DeleteActivity(repo);
  await useCase.execute(id);
  return new NextResponse(null, { status: 204 });
});
