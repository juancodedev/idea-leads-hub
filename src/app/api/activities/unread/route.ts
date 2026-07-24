import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

/**
 * GET /api/activities/unread
 * Returns the count of unread Instagram message activities.
 * Used by the sidebar badge to show real-time notification count.
 */
export const GET = apiHandler(async (_request: NextRequest) => {
  const { supabase } = await withAuth(_request);

  const { count, error } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("type", ActivityType.INSTAGRAM_MESSAGE)
    .eq("completed", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json(
      { error: "Error al obtener mensajes no leídos" },
      { status: 500 }
    );
  }

  return NextResponse.json({ count: count ?? 0 }, { status: 200 });
});
