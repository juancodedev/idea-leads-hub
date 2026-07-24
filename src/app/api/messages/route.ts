import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  GET /api/messages?key=<key>                                       */
/*  Returns messages for a conversation.                              */
/*  Key format: "lead:<leadId>" or "unlinked:<senderId>"              */
/* ------------------------------------------------------------------ */
export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key query param is required" }, { status: 400 });
  }

  let messages: Array<{ id: string; text: string; direction: "inbound" | "outbound"; timestamp: string }> = [];

  if (key.startsWith("lead:")) {
    const leadId = key.replace("lead:", "");
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("lead_id", leadId)
      .eq("type", ActivityType.INSTAGRAM_MESSAGE)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching conversation:", error);
      return NextResponse.json({ error: "Error al cargar los mensajes" }, { status: 500 });
    }

    messages = (data ?? []).map((a: any) => ({
      id: a.id,
      text: a.description || a.title,
      direction: a.title.startsWith("Instagram DM from") ? ("inbound" as const) : ("outbound" as const),
      timestamp: a.created_at,
    }));
  } else if (key.startsWith("unlinked:")) {
    const senderId = key.replace("unlinked:", "");
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .is("lead_id", null)
      .eq("type", ActivityType.INSTAGRAM_MESSAGE)
      .ilike("title", `Instagram DM from ${senderId}`)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching conversation:", error);
      return NextResponse.json({ error: "Error al cargar los mensajes" }, { status: 500 });
    }

    messages = (data ?? []).map((a: any) => ({
      id: a.id,
      text: a.description || a.title,
      direction: a.title.startsWith("Instagram DM from") ? ("inbound" as const) : ("outbound" as const),
      timestamp: a.created_at,
    }));
  } else {
    return NextResponse.json({ error: 'Invalid key format — expected "lead:<id>" or "unlinked:<id>"' }, { status: 400 });
  }

  return NextResponse.json(messages, { status: 200 });
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/messages?key=<key>                                    */
/*  Deletes all Instagram message activities in a conversation.        */
/* ------------------------------------------------------------------ */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key query param is required" }, { status: 400 });
  }

  let query: any;

  if (key.startsWith("lead:")) {
    const leadId = key.replace("lead:", "");
    query = supabase.from("activities").delete().eq("lead_id", leadId).eq("type", ActivityType.INSTAGRAM_MESSAGE);
  } else if (key.startsWith("unlinked:")) {
    const senderId = key.replace("unlinked:", "");
    query = supabase
      .from("activities")
      .delete()
      .is("lead_id", null)
      .eq("type", ActivityType.INSTAGRAM_MESSAGE)
      .ilike("title", `Instagram DM from ${senderId}`);
  } else {
    return NextResponse.json({ error: 'Invalid key format — expected "lead:<id>" or "unlinked:<id>"' }, { status: 400 });
  }

  const { error } = await query;

  if (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json({ error: "Error al eliminar la conversación" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/messages/link                                          */
/*  Body: { key: "unlinked:<senderId>", leadId: "<leadId>" }          */
/*  Links unlinked messages to a lead.                                 */
/* ------------------------------------------------------------------ */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const { key, leadId } = body;

  if (!key || !leadId) {
    return NextResponse.json({ error: "key and leadId are required" }, { status: 400 });
  }

  if (key.startsWith("lead:")) {
    // Already linked — nothing to do
    return NextResponse.json({ success: true, alreadyLinked: true }, { status: 200 });
  }

  if (!key.startsWith("unlinked:")) {
    return NextResponse.json({ error: 'Invalid key format — expected "unlinked:<id>"' }, { status: 400 });
  }

  const senderId = key.replace("unlinked:", "");

  // Verify the lead exists
  const { data: lead, error: leadError } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  // Update all unlinked Instagram message activities from this sender to point to the lead
  const { error: updateError } = await supabase
    .from("activities")
    .update({ lead_id: leadId } as never)
    .is("lead_id", null)
    .eq("type", ActivityType.INSTAGRAM_MESSAGE)
    .ilike("title", `Instagram DM from ${senderId}`);

  if (updateError) {
    console.error("Error linking conversation:", updateError);
    return NextResponse.json({ error: "Error al vincular la conversación" }, { status: 500 });
  }

  return NextResponse.json({ success: true, alreadyLinked: false }, { status: 200 });
});
