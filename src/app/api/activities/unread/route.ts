import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { messagingModule } from '@/modules/messaging';

export const runtime = 'nodejs';

/**
 * GET /api/activities/unread
 * Unread Instagram badge (S12): the sum of `conversations.unread_count` over
 * the user's conversations. Activity status transitions never touch it.
 */
export const GET = apiHandler(async (_request: NextRequest) => {
  const { supabase, user } = await withAuth(_request);

  const count = await messagingModule(supabase).countUnreadMessages.execute(user.id);

  return NextResponse.json({ count }, { status: 200 });
});
