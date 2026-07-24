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
 * Compute HMAC-SHA256 hex digest over raw bytes.
 */
async function computeHmacHex(secret: string, data: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    data.slice(data.byteOffset, data.byteOffset + data.byteLength)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    // Compute HMAC values for debugging
    const metaHex = process.env.META_APP_SECRET
      ? await computeHmacHex(process.env.META_APP_SECRET, rawBytes)
      : "";
    const igHex = process.env.INSTAGRAM_APP_SECRET
      ? await computeHmacHex(process.env.INSTAGRAM_APP_SECRET, rawBytes)
      : "";

    // Log to Cloudflare observability (now enabled in wrangler.toml)
    console.error("[webhook/hmac_mismatch]", JSON.stringify({
      bodyLength: rawBytes.byteLength,
      bodyFirst100: rawBody.substring(0, 100),
      bodyLast40: rawBody.substring(rawBody.length - 40),
      signature256: signature,
      metaHmacPrefix: metaHex.substring(0, 16),
      igHmacPrefix: igHex.substring(0, 16),
      metaSecretSet: !!process.env.META_APP_SECRET,
      igSecretSet: !!process.env.INSTAGRAM_APP_SECRET,
    }));

    // Persist debug data to audit_logs (raw fetch, bypasses supabase-js client issues)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            entity_type: "instagram_webhook",
            entity_id: "hmac_mismatch_debug",
            action: "hmac_mismatch",
            changes: {
              body: rawBody.substring(0, 500),
              bodyLength: rawBytes.byteLength,
              signature256: signature,
              metaHmac: metaHex.substring(0, 16) + "...",
              igHmac: igHex.substring(0, 16) + "...",
              metaSecretSet: !!process.env.META_APP_SECRET,
              igSecretSet: !!process.env.INSTAGRAM_APP_SECRET,
            },
          }),
        });
        if (!res.ok) {
          console.error("[webhook] audit_logs insert failed", { status: res.status, statusText: res.statusText });
        }
      } catch (err) {
        console.error("[webhook] audit_logs insert error", err);
      }
    }

    return NextResponse.json(
      {
        error: "Invalid signature",
        debug: {
          bodyLength: rawBytes.byteLength,
          bodyFirst100: rawBody.substring(0, 100),
          bodyLast40: rawBody.substring(rawBody.length - 40),
          signature256: signature.substring(0, 30) + "...",
          metaHmacPrefix: metaHex.substring(0, 16),
          igHmacPrefix: igHex.substring(0, 16),
        },
      },
      { status: 403 }
    );
  }

  const payload = JSON.parse(rawBody);

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
    console.log("[webhook] ignored payload:", JSON.stringify(ignoredInfo));
    return NextResponse.json({ status: "ignored", debug: ignoredInfo }, { status: 200 });
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

  // Find the user who owns the Instagram integration to associate activities.
  // Webhook context has no auth session, so we look up the admin from user_secrets.
  const { data: adminUserSecret } = await supabase
    .from("user_secrets")
    .select("user_id")
    .not("instagram_ig_id", "is", null)
    .limit(1)
    .maybeSingle() as unknown as { data: { user_id: string } | null };

  const adminUserId = adminUserSecret?.user_id ?? null;

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
    const result = await (supabase
      .from("leads") as any)
      .insert({
        instagram_scoped_id: parsed.senderId,
        name: `Instagram: ${parsed.senderId}`,
        status: "new",
      })
      .select("id")
      .single();

    const newLead = result.data as { id: string } | null;

    leadId = newLead?.id ?? null;
    logger.info("Auto-created lead from Instagram webhook", {
      senderId: parsed.senderId,
      leadId,
    });
  }

  try {
    // Direct insert with service role key — repository requireUser() won't
    // work in webhook context because there's no authenticated user session.
    if (!adminUserId) {
      logger.error("No admin user with Instagram integration found — cannot create activity");
    } else {
      const { error: activityError } = await supabase
        .from("activities")
        .insert({
          user_id: adminUserId,
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
    }
  } catch (error) {
    logger.error("Failed to create activity from webhook", { error });
    // Still return 200 to Meta (acknowledge receipt)
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}
