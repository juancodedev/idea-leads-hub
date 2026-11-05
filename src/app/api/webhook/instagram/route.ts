import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/database/admin";
import { messagingModule } from "@/modules/messaging";
import { MetaInstagramChannel } from "@/modules/messaging/infrastructure/channels/MetaInstagramChannel";
import { runInBackground } from "@/lib/runtime/background";
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
 * Acknowledges Meta webhook deliveries (S3, ADR-3, ADR-4):
 *
 * 1. Verify `X-Hub-Signature-256` over the raw bytes; fail closed with 401
 *    before anything is stored.
 * 2. Claim the event id (`sha:<sha256(rawBody)>`) with one insert that does
 *    nothing on conflict. A re-delivered event answers 200 unprocessed.
 * 3. Schedule `ProcessWebhookEvent` in the background and answer 200. Owner
 *    resolution, lead linking and storage happen there; failures leave the
 *    event for the retry sweep instead of asking Meta to re-send.
 *
 * A failed claim answers 500 so Meta retries the delivery.
 */
export async function POST(request: NextRequest) {
  // Meta signs the EXACT bytes it sends: read them once and never re-encode.
  const rawBody = await request.arrayBuffer();
  const channel = new MetaInstagramChannel();

  if (!(await channel.verifyWebhook(rawBody, request.headers))) {
    logger.warn("Instagram webhook rejected: invalid signature", {
      bodyLength: rawBody.byteLength,
      hasSignature: request.headers.has("X-Hub-Signature-256"),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    logger.warn("Instagram webhook rejected: malformed JSON", {
      bodyLength: rawBody.byteLength,
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let messaging: ReturnType<typeof messagingModule>;
  try {
    messaging = messagingModule(createAdminClient(), { channel });
  } catch (error) {
    logger.error("Instagram webhook: messaging is not configured", { error });
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const eventId = await channel.eventId(payload, rawBody);

  let claimed: { eventId: string } | null;
  try {
    claimed = await messaging.webhookEventRepository.claim(eventId, channel.channel, payload);
  } catch (error) {
    // Non-2xx makes Meta retry, so a storage outage does not lose the event.
    logger.error("Instagram webhook: failed to store event", { eventId, error });
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }

  if (!claimed) {
    logger.info("Instagram webhook: duplicate delivery ignored", { eventId });
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  runInBackground(async () => {
    await messaging.processWebhookEvent.execute(eventId);
  });

  return NextResponse.json({ status: "received" }, { status: 200 });
}
