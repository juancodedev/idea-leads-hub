import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";
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
  // Read raw bytes directly to avoid any encoding/transformation issues.
  // Meta signs the EXACT bytes they send — any transformation (JSON parse/
  // re-serialize, charset conversion) breaks the HMAC.
  const rawBytes = await request.arrayBuffer();
  const rawBody = new TextDecoder().decode(rawBytes);
  const signature = request.headers.get("X-Hub-Signature-256") || "";

  const messagingService = new InstagramMessagingService();
  // Pass raw bytes directly — Meta signs the exact bytes, not a decoded string
  const isValid = await messagingService.verifyMetaSignature(
    rawBytes,
    signature
  );

  if (!isValid) {
    logger.warn("Instagram webhook rejected: invalid signature", {
      bodyLength: rawBytes.byteLength,
      hasSignature: signature.length > 0,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn("Instagram webhook rejected: malformed JSON", {
      bodyLength: rawBytes.byteLength,
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // parseIncomingMessage only handles messages with text content
  const parsed = messagingService.parseIncomingMessage(payload);

  if (!parsed) {
    // Log rejected payloads for debugging
    const ignoredInfo: Record<string, unknown> = {
      object: (payload as Record<string, unknown>)?.object,
      entryKeys: payload.entry?.[0] ? Object.keys(payload.entry[0]) : [],
    };
    if (payload.entry?.[0]?.messaging?.[0]) {
      ignoredInfo.eventType = "messaging";
      ignoredInfo.messagingKeys = Object.keys(payload.entry[0].messaging[0]);
      ignoredInfo.hasMessage = !!payload.entry[0].messaging[0].message;
    }
    if (payload.entry?.[0]?.changes?.[0]) {
      ignoredInfo.eventType = "changes";
      ignoredInfo.changesField = payload.entry[0].changes[0].field;
      ignoredInfo.changesValueKeys = Object.keys(payload.entry[0].changes[0].value || {});
    }
    logger.info("Instagram webhook payload ignored", ignoredInfo);
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

  const owner = await resolveIntegrationOwner(supabase, parsed.recipientId);
  if (owner.kind === "lookup_failed") {
    // Non-2xx makes Meta retry delivery, so a transient database failure
    // does not turn into permanent message loss.
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
  const ownerUserId = owner.kind === "found" ? owner.userId : null;
  if (!ownerUserId) {
    // Acknowledge receipt so Meta does not retry; the message has no owner.
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  // Find lead by Instagram-scoped sender ID, restricted to the owner's leads.
  type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
  const { data: leads } = (await supabase
    .from("leads")
    .select("id")
    .eq("user_id", ownerUserId)
    .eq("instagram_scoped_id", parsed.senderId)
    .limit(1)) as unknown as { data: Pick<LeadRow, "id">[] | null };

  let leadId = leads?.[0]?.id ?? null;

  // If no direct lead match, reuse the lead linked to the owner's previous
  // messages from/to this sender. Outbound replies use "Instagram DM to {id}",
  // inbound use "Instagram DM from {id}".
  if (!leadId) {
    for (const title of [
      `Instagram DM from ${parsed.senderId}`,
      `Instagram DM to ${parsed.senderId}`,
    ]) {
      const { data: linked } = (await supabase
        .from("activities")
        .select("lead_id")
        .eq("user_id", ownerUserId)
        .eq("type", ActivityType.INSTAGRAM_MESSAGE)
        .eq("title", title)
        .not("lead_id", "is", null)
        .limit(1)
        .maybeSingle()) as unknown as { data: { lead_id: string } | null };

      if (linked?.lead_id) {
        leadId = linked.lead_id;
        break;
      }
    }
  }

  try {
    // Direct insert with service role key — repository requireUser() won't
    // work in webhook context because there's no authenticated user session.
    const { error: activityError } = await supabase
      .from("activities")
      .insert({
        user_id: ownerUserId,
        type: ActivityType.INSTAGRAM_MESSAGE,
        title: `Instagram DM from ${parsed.senderId}`,
        description: parsed.text,
        lead_id: leadId ?? undefined,
        attachments: [
          {
            name: "instagram_message",
            url: "",
            path: "",
            size: 0,
            type: "instagram/message",
          },
        ],
      } as never);

    if (activityError) {
      logger.error("Failed to insert activity from webhook", { error: activityError });
    }
  } catch (error) {
    logger.error("Failed to create activity from webhook", { error });
    // Still return 200 to Meta (acknowledge receipt)
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}

type AdminClient = ReturnType<typeof createClient<Database>>;

/**
 * The recipient id is interpolated into a PostgREST or() filter, so it must
 * not contain filter metacharacters (commas, dots, parentheses, quotes).
 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

type OwnerResolution =
  | { kind: "found"; userId: string }
  | { kind: "none" }
  | { kind: "lookup_failed" };

/**
 * Resolves which user owns the Instagram account that received a message.
 *
 * 1. Match the recipient id against instagram_ig_id or instagram_page_id.
 * 2. If nothing matches and exactly one user has Instagram connected, use
 *    that user: the id stored by some login flows (app-scoped /me id) can
 *    differ from the id Meta sends in webhooks, and with a single integrated
 *    user there is no other tenant the message could belong to.
 * 3. Otherwise there is no owner. Guessing between several users would leak
 *    one user's messages into another user's account.
 *
 * A failed query yields "lookup_failed" instead of being mistaken for
 * "no match", so the caller can ask Meta to retry.
 */
async function resolveIntegrationOwner(
  supabase: AdminClient,
  recipientId: string | undefined
): Promise<OwnerResolution> {
  type SecretRow = { user_id: string };
  type Result = { data: SecretRow[] | null; error: { message: string } | null };

  if (recipientId && SAFE_ID.test(recipientId)) {
    const { data: matches, error } = (await supabase
      .from("user_secrets")
      .select("user_id")
      .or(`instagram_ig_id.eq.${recipientId},instagram_page_id.eq.${recipientId}`)
      .limit(2)) as unknown as Result;

    if (error) {
      logger.error("Instagram webhook owner lookup failed", { recipientId, error: error.message });
      return { kind: "lookup_failed" };
    }
    if (matches?.length === 1) return { kind: "found", userId: matches[0].user_id };
    if (matches && matches.length > 1) {
      logger.error("Instagram webhook recipient matches several users; message dropped", {
        recipientId,
      });
      return { kind: "none" };
    }
  }

  const { data: integrated, error } = (await supabase
    .from("user_secrets")
    .select("user_id")
    .not("instagram_ig_id", "is", null)
    .limit(2)) as unknown as Result;

  if (error) {
    logger.error("Instagram webhook integrated-users lookup failed", {
      recipientId,
      error: error.message,
    });
    return { kind: "lookup_failed" };
  }

  if (integrated?.length === 1) {
    logger.warn("Instagram webhook recipient did not match; using the only integrated user", {
      recipientId,
    });
    return { kind: "found", userId: integrated[0].user_id };
  }

  logger.error("Instagram webhook recipient has no owner; message dropped", {
    recipientId,
    integratedUsers: integrated?.length ?? 0,
  });
  return { kind: "none" };
}
