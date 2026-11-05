import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { messagingModule } from "@/modules/messaging";
import { parseInboxKey } from "@/modules/messaging/domain/values/InboxKey";

export const runtime = "nodejs";

/**
 * PATCH /api/messages/read — body `{ key }` (S10, S12).
 * Sets `unread_count = 0` on every conversation behind the key and `read_at`
 * on their unread legacy activities (MarkConversationRead).
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const { key: raw } = await request.json();

  if (!raw) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  const key = typeof raw === "string" ? parseInboxKey(raw) : null;
  if (!key) {
    return NextResponse.json(
      { error: 'Invalid key format — expected "lead:<id>" or "unlinked:<id>"' },
      { status: 400 }
    );
  }

  await messagingModule(supabase).markInboxRead.execute(user.id, key);
  return NextResponse.json({ success: true }, { status: 200 });
});
