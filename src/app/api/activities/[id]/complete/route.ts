import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { CompleteActivity } from '@/modules/activities/application/use-cases/CompleteActivity';
import { createAuditLog } from '@/modules/shared/infrastructure/actions/auditActions';

export const runtime = 'nodejs';

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseActivityRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Activity not found');

  const useCase = new CompleteActivity(repo);
  const activity = await useCase.execute(id);

  // CF-2: complete is a status transition — audit the delta exactly once
  // (getById-first above; CompleteActivity stays pure — no logging).
  // Already-COMPLETED re-PATCH is a no-op (no write), so no audit row.
  if (existing.status !== activity.status) {
    await createAuditLog({
      entityType: 'ACTIVITY',
      entityId: activity.id,
      parentId: activity.leadId ?? null,
      action: 'UPDATE',
      changes: {
        status: { old: existing.status, new: activity.status },
      },
    });
  }

  return NextResponse.json(activity, { status: 200 });
});