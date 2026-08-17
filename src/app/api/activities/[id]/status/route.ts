import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { MoveActivityStatus } from '@/modules/activities/application/use-cases/MoveActivityStatus';
import { ActivityStatus } from '@/modules/activities/domain/enums/ActivityStatus';
import { createAuditLog } from '@/modules/shared/infrastructure/actions/auditActions';

export const runtime = 'nodejs';

const ChangeStatusSchema = z.object({
  status: z.nativeEnum(ActivityStatus, { errorMap: () => ({ message: 'Invalid status value' }) }),
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const { status } = ChangeStatusSchema.parse(body);

  const repo = new SupabaseActivityRepository(supabase);
  // getById-first: load the current row to compute the audit delta before
  // the transition (MoveActivityStatus stays pure — no logging).
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Activity not found');

  const useCase = new MoveActivityStatus(repo);
  const activity = await useCase.execute(id, status);

  // Audit exactly once, with changes.status.{old,new} (CF-2). A same-status
  // transition is a no-op (use case returned existing): no write happened,
  // so no audit row (old === new would be noise) — still a 200 idempotent
  // success.
  if (existing.status !== activity.status) {
    await createAuditLog({
      entityType: 'ACTIVITY',
      entityId: activity.id,
      parentId: activity.leadId ?? null,
      action: 'UPDATE',
      changes: {
        status: { old: existing.status, new: status },
      },
    });
  }

  return NextResponse.json(activity, { status: 200 });
});
