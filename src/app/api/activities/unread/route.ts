import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';

export const runtime = 'nodejs';

/**
 * GET /api/activities/unread
 * Returns the count of unread Instagram message activities, computed on the
 * read marker (`read_at IS NULL`) via the repo verb — the single source of
 * truth shared with the badge, conversations list, and page selection (BR-3).
 */
export const GET = apiHandler(async (_request: NextRequest) => {
  const { supabase, user } = await withAuth(_request);

  const repo = new SupabaseActivityRepository(supabase);
  const count = await repo.getUnreadCount(user.id);

  return NextResponse.json({ count }, { status: 200 });
});