import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { MarkActivityRead } from '@/modules/activities/application/use-cases/MarkActivityRead';

export const runtime = 'nodejs';

// PATCH marks the read marker (`read_at`) only — status/completed are never
// touched (BR-3: read never implies completion).
export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseActivityRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Activity not found');

  const useCase = new MarkActivityRead(repo);
  const activity = await useCase.execute(id);
  return NextResponse.json(activity, { status: 200 });
});