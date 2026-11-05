import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { messagingModule } from "@/modules/messaging";
import { toInboxMessageResponse } from "@/modules/messaging/presentation/httpResponses";

export const runtime = "nodejs";

/** Messages of every conversation of the lead, oldest first (S10). */
export const GET = apiHandler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const { supabase, user } = await withAuth(request);

    const messages = await messagingModule(supabase).getInboxMessages.execute(user.id, {
      kind: "lead",
      leadId: id,
    });

    return NextResponse.json(messages.map(toInboxMessageResponse), { status: 200 });
  }
);
