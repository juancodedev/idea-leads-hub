import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/database/admin";
import { messagingModule } from "@/modules/messaging";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const BEARER_PREFIX = "Bearer ";

/**
 * GET /api/webhook/instagram/sweep
 * Reprocesses webhook events stuck in `received` (S4, ADR-5). Called by the
 * scheduled worker (or an external cron) with `Authorization: Bearer
 * ${CRON_SECRET}`. `/api` is outside the middleware matcher, so this check is
 * the only guard; an unset CRON_SECRET refuses every request.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let messaging: ReturnType<typeof messagingModule>;
  try {
    messaging = messagingModule(createAdminClient());
  } catch (error) {
    logger.error("Webhook sweep: messaging is not configured", { error });
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const summary = await messaging.sweepWebhookEvents.execute();
    if (summary.claimed > 0) logger.info("Webhook sweep finished", { ...summary });
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    logger.error("Webhook sweep failed", { error });
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

async function isAuthorized(authorization: string | null): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization?.startsWith(BEARER_PREFIX)) return false;
  return constantTimeEqual(authorization.slice(BEARER_PREFIX.length), secret);
}

/**
 * Compares two strings in time independent of where they differ: both are
 * hashed to fixed-length SHA-256 digests (WebCrypto, available on Workers and
 * Node) and every byte is compared.
 */
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
