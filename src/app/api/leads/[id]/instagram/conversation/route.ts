import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

interface ConversationMessage {
  id: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
}

export const GET = apiHandler(
  async (
    request: NextRequest,
    context: { params: { id: string } }
  ) => {
    const { supabase } = await withAuth(request);
    const repo = new SupabaseActivityRepository(supabase);

    const activities = await repo.getForLead(context.params.id);

    const messages: ConversationMessage[] = activities
      .filter((a) => a.type === ActivityType.INSTAGRAM_MESSAGE)
      .map((a) => {
        // Determine direction by title convention
        // "Instagram DM to ..." = outbound, "Instagram DM from ..." = inbound
        const direction = a.title.startsWith("Instagram DM from")
          ? ("inbound" as const)
          : ("outbound" as const);

        return {
          id: a.id,
          text: a.description || a.title,
          direction,
          timestamp: a.createdAt.toISOString(),
        };
      })
      .sort(
        (a, b) => a.timestamp.localeCompare(b.timestamp)
      );

    return NextResponse.json(messages, { status: 200 });
  }
);
