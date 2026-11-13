import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { assertKnownStatus } from '@/core/application/leads/leadStatuses';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';
import { InstagramAuthService } from '@/infrastructure/services/InstagramAuthService';
import { InstagramAutoTrigger } from '@/modules/instagram/InstagramAutoTrigger';
import { messagingModule } from '@/modules/messaging';

export const runtime = 'nodejs';

const ChangeStatusSchema = z.object({
  status: z.string().min(1, 'El estado no puede estar vacío'),
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase, user, scopedUserId } = await withAuth(request, { allowApiKey: true });
  const body = await request.json();
  const { status } = ChangeStatusSchema.parse(body);

  const repo = new SupabaseLeadRepository(supabase, scopedUserId);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Lead not found');

  const pipelineRepo = new SupabasePipelineRepository(supabase, scopedUserId);
  await assertKnownStatus(status, pipelineRepo, existing.pipelineId);

  const lead = await repo.updateStatus(id, status);

  // Audit log for status change (non-blocking, best-effort)
  try {
    await createAuditLogFromApi(supabase, {
      entityType: 'LEAD',
      entityId: id,
      action: 'UPDATE',
      changes: { status: { old: existing.status, new: status } },
    }, scopedUserId ?? user.id);
  } catch (err) {
    console.error('Audit log failed:', err);
  }

  // Fire-and-forget: auto-DM on status transition (non-blocking)
  try {
    const authService = new InstagramAuthService(supabase);
    const trigger = new InstagramAutoTrigger(messagingModule(supabase).sendToParticipant);
    const sent = await trigger.maybeSendAutoDm(existing, status, authService);
    if (sent) {
      console.info(`Instagram auto-DM sent for lead ${existing.id}`);
    }
  } catch (err) {
    console.error('Instagram auto-DM failed:', err);
  }

  return NextResponse.json(lead, { status: 200 });
});

async function createAuditLogFromApi(
  supabase: any,
  log: { entityType: string; entityId: string; action: string; changes: Record<string, any> },
  actorUserId: string
) {
  await supabase.from('audit_logs').insert({
    entity_type: log.entityType,
    entity_id: log.entityId,
    action: log.action,
    changes: log.changes,
    user_id: actorUserId,
  });
}
