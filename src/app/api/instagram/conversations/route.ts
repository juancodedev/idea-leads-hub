import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

interface ConversationResponse {
  conversations: Array<{
    leadId: string;
    leadName: string;
    instagramHandle: string | null;
    lastMessage: {
      text: string;
      timestamp: string;
      direction: "inbound" | "outbound";
    };
    unreadCount: number;
    isConnected: boolean;
  }>;
}

function getDirection(title: string): "inbound" | "outbound" {
  return title.startsWith("Instagram DM from") ? "inbound" : "outbound";
}

export const GET = apiHandler(async (_request: NextRequest) => {
  const { supabase } = await withAuth(_request);

  // Fetch all Instagram message activities with their lead data
  const { data: activities, error } = await supabase
    .from("activities")
    .select(
      `
      id,
      lead_id,
      title,
      description,
      completed,
      created_at,
      lead:leads!inner(id, name, instagram_handle, instagram_scoped_id)
    `
    )
    .eq("type", ActivityType.INSTAGRAM_MESSAGE)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching Instagram conversations:", error);
    return NextResponse.json(
      { error: "Error al cargar las conversaciones" },
      { status: 500 }
    );
  }

  // Group by lead_id and build conversation summaries
  const conversationsMap = new Map<
    string,
    ConversationResponse["conversations"][0] & { _seen: Set<string> }
  >();

  for (const activity of activities as Array<{
    id: string;
    lead_id: string | null;
    title: string;
    description: string;
    completed: boolean;
    created_at: string;
    lead: {
      id: string;
      name: string;
      instagram_handle: string | null;
      instagram_scoped_id: string | null;
    } | null;
  }>) {
    if (!activity.lead_id || !activity.lead) continue;

    if (!conversationsMap.has(activity.lead_id)) {
      conversationsMap.set(activity.lead_id, {
        leadId: activity.lead_id,
        leadName: activity.lead.name,
        instagramHandle: activity.lead.instagram_handle,
        lastMessage: {
          text: activity.description || activity.title,
          timestamp: activity.created_at,
          direction: getDirection(activity.title),
        },
        unreadCount: 0,
        isConnected: !!(
          activity.lead.instagram_handle ||
          activity.lead.instagram_scoped_id
        ),
        _seen: new Set<string>(),
      });
    }

    const entry = conversationsMap.get(activity.lead_id)!;

    // Count unread only for messages we haven't counted yet
    // (activities come ordered desc, first one is most recent = our lastMessage)
    if (!activity.completed && !entry._seen.has(activity.id)) {
      entry.unreadCount++;
      entry._seen.add(activity.id);
    }
  }

  const conversations = Array.from(conversationsMap.values()).map(
    ({ _seen, ...rest }) => rest
  );

  return NextResponse.json({ conversations }, { status: 200 });
});
