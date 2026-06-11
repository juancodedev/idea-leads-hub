import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';

export const runtime = 'nodejs';

const AssignTagSchema = z.object({
  tagId: z.string().uuid(),
  entityId: z.string().uuid(),
  entityType: z.enum(['lead', 'idea']),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = AssignTagSchema.parse(body);
  const repo = new SupabaseTagRepository(supabase);
  await repo.assignToEntity(data.tagId, data.entityId, data.entityType);
  return NextResponse.json({ success: true }, { status: 200 });
});
