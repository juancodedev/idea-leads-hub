import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';

export const runtime = 'nodejs';

export const DELETE = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabaseTagRepository(supabase);
  await repo.delete(context.params.id);
  return new NextResponse(null, { status: 204 });
});
