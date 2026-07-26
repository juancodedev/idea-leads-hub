import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';
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
