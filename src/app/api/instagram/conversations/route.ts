import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

interface ConversationResponse {
  conversations: Array<{
    /** Unique key — either the leadId if linked, or a temp id for unlinked */
    id: string;
    /** leadId when linked to a lead, null otherwise */
    leadId: string | null;
    leadName: string;
    instagramHandle: string | null;
    /** Instagram-scoped ID of the sender (for unlinked conversations) */
    instagramScopedId: string | null;
    lastMessage: {
      text: string;
      timestamp: string;
      direction: "inbound" | "outbound";
    };
    unreadCount: number;
    isConnected: boolean;
    isLinked: boolean;
  }>;
}

function getDirection(title: string): "inbound" | "outbound" {
  return title.startsWith("Instagram DM from") ? "inbound" : "outbound";
}

/** Extract counterparty Instagram ID from activity title — "from" for inbound, "to" for outbound */
function extractCounterpartyId(title: string): string | null {
  const fromMatch = title.match(/^Instagram DM from (\d+)/);
  if (fromMatch) return fromMatch[1];
  const toMatch = title.match(/^Instagram DM to (\d+)/);
  return toMatch?.[1] ?? null;
}

export const GET = apiHandler(async (_request: NextRequest) => {
  const { supabase } = await withAuth(_request);

  // Fetch all Instagram message activities with their lead data (LEFT JOIN)
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
      lead:leads(id, name, instagram_handle, instagram_scoped_id)
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

  // Group by lead_id when available, or by sender ID for unlinked messages
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
    // Determine group key
    let groupKey: string;
    let leadId: string | null;
    let leadName: string;
    let instagramHandle: string | null;
    let instagramScopedId: string | null;
    let isLinked: boolean;

    if (activity.lead_id && activity.lead) {
      // Linked to an existing lead
      groupKey = activity.lead_id;
      leadId = activity.lead_id;
      leadName = activity.lead.name;
      instagramHandle = activity.lead.instagram_handle;
      instagramScopedId = activity.lead.instagram_scoped_id;
      isLinked = true;
    } else {
      // Unlinked — group by sender ID extracted from title
      const senderId = extractCounterpartyId(activity.title) ?? activity.id;
      groupKey = `unlinked:${senderId}`;
      leadId = null;
      leadName = `Instagram: ${senderId}`;
      instagramHandle = null;
      instagramScopedId = senderId;
      isLinked = false;
    }

    if (!conversationsMap.has(groupKey)) {
      conversationsMap.set(groupKey, {
        id: groupKey,
        leadId,
        leadName,
        instagramHandle,
        instagramScopedId,
        lastMessage: {
          text: activity.description || activity.title,
          timestamp: activity.created_at,
          direction: getDirection(activity.title),
        },
        unreadCount: 0,
        isConnected: !!instagramScopedId,
        isLinked,
        _seen: new Set<string>(),
      });
    }

    const entry = conversationsMap.get(groupKey)!;

    // Count unread only for messages we haven't counted yet
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
