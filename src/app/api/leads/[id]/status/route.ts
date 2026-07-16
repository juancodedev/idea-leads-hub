import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { InstagramAuthService } from '@/infrastructure/services/InstagramAuthService';
import { InstagramMessagingService } from '@/infrastructure/services/InstagramMessagingService';
import { InstagramAutoTrigger } from '@/modules/instagram/InstagramAutoTrigger';

export const runtime = 'nodejs';

const LeadStatusEnum = z.enum(['Nuevo', 'Contactado', 'Interesado', 'Propuesta', 'Ganado', 'Perdido']);

const ChangeStatusSchema = z.object({
  status: LeadStatusEnum,
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const { status } = ChangeStatusSchema.parse(body);

  const repo = new SupabaseLeadRepository(supabase);
  const existing = await repo.getById(context.params.id);
  if (!existing) throw new NotFoundError('Lead not found');

  const lead = await repo.updateStatus(context.params.id, status);

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
