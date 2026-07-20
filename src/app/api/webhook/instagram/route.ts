import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { Database } from "@/infrastructure/database/database.types";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/webhook/instagram
 * Meta webhook verification (challenge response).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { error: "Verification failed" },
    { status: 403 }
  );
}

/**
 * POST /api/webhook/instagram
 * Receive inbound Instagram messages from Meta.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("X-Hub-Signature-256") || "";
  const rawBody = await request.text();

  const messagingService = new InstagramMessagingService();
  const isValid = await messagingService.verifyMetaSignature(
    rawBody,
    signature
  );

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 403 }
    );
  }

  const payload = JSON.parse(rawBody);

  // parseIncomingMessage only handles messages with text content
  const parsed = messagingService.parseIncomingMessage(payload);

  if (!parsed) {
    // Non-message events (e.g., mentions, comments) are ignored
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Create admin Supabase client for webhook (no user session)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("Missing Supabase configuration for webhook");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);
  const activityRepo = new SupabaseActivityRepository(supabase);

  // Find or auto-create lead by Instagram-scoped sender ID
  type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
  const { data: leads } = (await supabase
    .from("leads")
    .select("id")
    .eq("instagram_scoped_id", parsed.senderId)
    .limit(1)) as unknown as { data: Pick<LeadRow, "id">[] | null };

  let leadId = leads?.[0]?.id ?? null;

  // Auto-create lead for unknown senders so the ID is never lost
  if (!leadId) {
    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        instagram_scoped_id: parsed.senderId,
        name: `Instagram: ${parsed.senderId}`,
        status: "new",
      })
      .select("id")
      .single()
      .throwOnError();

    leadId = newLead?.id ?? null;
    logger.info("Auto-created lead from Instagram webhook", {
      senderId: parsed.senderId,
      leadId,
    });
  }

  try {
    await activityRepo.create({
      type: ActivityType.INSTAGRAM_MESSAGE,
      title: `Instagram DM from ${parsed.senderId}`,
      description: parsed.text,
      leadId: leadId ?? undefined,
      attachments: [
        {
          name: "instagram_message",
          url: "",
          path: "",
          size: 0,
          type: "instagram/message",
        },
      ],
    });
  } catch (error) {
    logger.error("Failed to create activity from webhook", { error });
    // Still return 200 to Meta (acknowledge receipt)
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}
