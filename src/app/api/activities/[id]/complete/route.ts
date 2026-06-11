import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { CompleteActivity } from '@/modules/activities/application/use-cases/CompleteActivity';

export const runtime = 'nodejs';

export const PATCH = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabaseActivityRepository(supabase);
  const existing = await repo.getById(context.params.id);
  if (!existing) throw new NotFoundError('Activity not found');

  const useCase = new CompleteActivity(repo);
  const activity = await useCase.execute(context.params.id);
  return NextResponse.json(activity, { status: 200 });
});
