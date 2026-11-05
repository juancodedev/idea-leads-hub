import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { logger } from "@/lib/logger";
import { messagingModule } from "@/modules/messaging";

export const runtime = "nodejs";

/**
 * GET /api/instagram/conversations
 * The inbox (S10, ADR-11): one entry per key (`lead:<leadId>` or
 * `unlinked:<participantId>`), `unreadCount` summed over the key's
 * conversations, newest last message first.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);

  try {
    const conversations = await messagingModule(supabase).listInbox.execute(user.id);
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    logger.error("Error fetching Instagram conversations", { error: String(error) });
    return NextResponse.json({ error: "Error al cargar las conversaciones" }, { status: 500 });
  }
});
