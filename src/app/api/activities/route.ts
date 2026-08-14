import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { GetActivities } from '@/core/application/activities/GetActivities';
import { CreateActivity } from '@/modules/activities/application/use-cases/CreateActivity';
import { ActivityType } from '@/modules/activities/domain/enums/ActivityType';

export const runtime = 'nodejs';

const CreateActivitySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.nativeEnum(ActivityType),
  description: z.string().optional(),
  dueDate: z.string().datetime().transform((s) => new Date(s)).optional(),
  leadId: z.string().uuid().optional(),
  ideaId: z.string().uuid().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        path: z.string(),
        size: z.number(),
        type: z.string(),
      })
    )
    .optional(),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const { searchParams } = new URL(request.url);

  const leadId = searchParams.get('leadId');
  const ideaId = searchParams.get('ideaId');
  const unlinkedId = searchParams.get('unlinkedId');
  const unreadOnly = searchParams.get('unread') === 'true';
  const typeFilter = searchParams.get('type');

  if (unlinkedId) {
    // Fetch unlinked Instagram messages for a given sender/recipient ID
    let query = supabase
      .from('activities')
      .select('id, read_at, type')
      .is('lead_id', null)
      .or(
        `title.ilike.Instagram DM from ${unlinkedId},title.ilike.Instagram DM to ${unlinkedId}`
      );

    if (unreadOnly) {
      // Unread marker: read_at IS NULL (BR-3) — no `completed` dependency.
      query = query.is('read_at', null);
    }

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching unlinked activities:', error);
      return NextResponse.json({ error: 'Error al cargar actividades' }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  }

  if (!leadId && !ideaId) {
    return NextResponse.json(
      { error: 'leadId, ideaId, or unlinkedId query parameter is required' },
      { status: 400 }
    );
  }

  const repo = new SupabaseActivityRepository(supabase);
  const useCase = new GetActivities(repo);
  const activities = await useCase.execute({ leadId: leadId ?? undefined, ideaId: ideaId ?? undefined });
  return NextResponse.json(activities, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = CreateActivitySchema.parse(body);

  const repo = new SupabaseActivityRepository(supabase);
  const useCase = new CreateActivity(repo);
  const activity = await useCase.execute(data);
  return NextResponse.json(activity, { status: 201 });
});
