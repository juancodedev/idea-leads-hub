import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { createAuditLog } from '@/modules/shared/infrastructure/actions/auditActions';
import { InstagramAuthService } from '@/infrastructure/services/InstagramAuthService';
import { InstagramMessagingService } from '@/infrastructure/services/InstagramMessagingService';
import { InstagramAutoTrigger } from '@/modules/instagram/InstagramAutoTrigger';

export const runtime = 'nodejs';

const ChangeStatusSchema = z.object({
  status: z.string().min(1, 'El estado no puede estar vacío'),
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const { status } = ChangeStatusSchema.parse(body);

  const repo = new SupabaseLeadRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Lead not found');

  // ── Validate status against pipeline stage names ──────────────
  const pipelineRepo = new SupabasePipelineRepository(supabase);
  let validStageNames: string[] = [];

  if (existing.pipelineId) {
    const stages = await pipelineRepo.getStages(existing.pipelineId);
    validStageNames = stages.map(s => s.name);
  } else {
    const pipelines = await pipelineRepo.getAll();
    validStageNames = pipelines.flatMap(p => p.stages?.map(s => s.name) ?? []);
  }

  if (validStageNames.length > 0 && !validStageNames.includes(status)) {
    throw new ZodError([{
      code: 'invalid_enum_value',
      path: ['status'],
      message: `Estado inválido. Los valores válidos son: ${validStageNames.join(', ')}`,
      received: status,
      options: validStageNames,
    }]);
  }

  const lead = await repo.updateStatus(id, status);

  // Audit log for status change (non-blocking, best-effort)
  try {
    await createAuditLogFromApi(supabase, {
      entityType: 'LEAD',
      entityId: id,
      action: 'UPDATE',
      changes: { status: { old: existing.status, new: status } },
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }

  // Fire-and-forget: auto-DM on status transition (non-blocking)
  try {
    const authService = new InstagramAuthService(supabase);
    const messagingService = new InstagramMessagingService();
    const trigger = new InstagramAutoTrigger();
    const sent = await trigger.maybeSendAutoDm(
      existing,
      status,
      authService,
      messagingService
    );
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
  log: { entityType: string; entityId: string; action: string; changes: Record<string, any> }
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;

  await supabase.from('audit_logs').insert({
    entity_type: log.entityType,
    entity_id: log.entityId,
    action: log.action,
    changes: log.changes,
    user_id: userData.user.id,
  });
}
