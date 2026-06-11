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

  if (!leadId && !ideaId) {
    return NextResponse.json(
      { error: 'leadId or ideaId query parameter is required' },
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
