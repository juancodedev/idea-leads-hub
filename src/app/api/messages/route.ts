import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { logger } from "@/lib/logger";
import { messagingModule } from "@/modules/messaging";
import { parseInboxKey } from "@/modules/messaging/domain/values/InboxKey";
import { toInboxMessageResponse } from "@/modules/messaging/presentation/httpResponses";

export const runtime = "nodejs";

const INVALID_KEY = 'Invalid key format — expected "lead:<id>" or "unlinked:<id>"';

/* ------------------------------------------------------------------ */
/*  GET /api/messages?key=<key>                                       */
/*  Messages of every conversation behind the key, oldest first.      */
/*  Key format: "lead:<leadId>" or "unlinked:<participantId>"         */
/* ------------------------------------------------------------------ */
export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const raw = new URL(request.url).searchParams.get("key");

  if (!raw) {
    return NextResponse.json({ error: "key query param is required" }, { status: 400 });
  }
  const key = parseInboxKey(raw);
  if (!key) {
    return NextResponse.json({ error: INVALID_KEY }, { status: 400 });
  }

  try {
    const messages = await messagingModule(supabase).getInboxMessages.execute(user.id, key);
    return NextResponse.json(messages.map(toInboxMessageResponse), { status: 200 });
  } catch (error) {
    logger.error("Error fetching conversation", { error: String(error) });
    return NextResponse.json({ error: "Error al cargar los mensajes" }, { status: 500 });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/messages?key=<key>                                    */
/*  Deletes the key's legacy activities and its conversations         */
/*  (messages cascade).                                               */
/* ------------------------------------------------------------------ */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const raw = new URL(request.url).searchParams.get("key");

  if (!raw) {
    return NextResponse.json({ error: "key query param is required" }, { status: 400 });
  }
  const key = parseInboxKey(raw);
  if (!key) {
    return NextResponse.json({ error: INVALID_KEY }, { status: 400 });
  }

  try {
    await messagingModule(supabase).deleteInboxConversations.execute(user.id, key);
  } catch (error) {
    logger.error("Error deleting conversation", { error: String(error) });
    return NextResponse.json({ error: "Error al eliminar la conversación" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/messages                                               */
/*  Body: { key: "unlinked:<participantId>", leadId: "<leadId>" }     */
/*  Links the key's conversations and legacy activities to a lead.    */
/* ------------------------------------------------------------------ */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const { key: raw, leadId } = await request.json();

  if (!raw || !leadId) {
    return NextResponse.json({ error: "key and leadId are required" }, { status: 400 });
  }

  if (typeof raw === "string" && raw.startsWith("lead:")) {
    // Already linked — nothing to do
    return NextResponse.json({ success: true, alreadyLinked: true }, { status: 200 });
  }

  const key = typeof raw === "string" ? parseInboxKey(raw) : null;
  if (!key || key.kind !== "unlinked" || typeof leadId !== "string") {
    return NextResponse.json({ error: 'Invalid key format — expected "unlinked:<id>"' }, { status: 400 });
  }

  let result;
  try {
    result = await messagingModule(supabase).linkInboxConversations.execute(
      user.id,
      key.participantId,
      leadId
    );
  } catch (error) {
    logger.error("Error linking conversation", { error: String(error) });
    return NextResponse.json({ error: "Error al vincular la conversación" }, { status: 500 });
  }

  if (result === "lead_not_found") {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ success: true, alreadyLinked: false }, { status: 200 });
});
