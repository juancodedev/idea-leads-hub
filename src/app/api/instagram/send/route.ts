import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { logger } from "@/lib/logger";
import { messagingModule } from "@/modules/messaging";
import { MessageOrigin } from "@/modules/messaging/domain/enums/MessageOrigin";
import {
  instagramSendContext,
  toSendResponse,
} from "@/modules/messaging/presentation/httpResponses";

export const runtime = "nodejs";

const SendMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
  recipientId: z.string().min(1, "Recipient Instagram ID is required"),
});

/**
 * POST /api/instagram/send — sends to a participant through DeliverMessage
 * (S7). 200 `{ messageId }` when sent; 502 `{ error, hint }` when Graph rejects it.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const body = await request.json();
  const { text, recipientId } = SendMessageSchema.parse(body);

  const tokenData = await new InstagramAuthService(supabase).getToken(user.id);

  const message = await messagingModule(supabase).sendToParticipant.execute({
    userId: user.id,
    participantId: recipientId,
    leadId: null,
    body: text,
    origin: MessageOrigin.HUMAN,
    sendContext: instagramSendContext(user.id, tokenData),
  });

  const response = toSendResponse(message);
  if (response.status === 502) {
    logger.error("Instagram send failed", {
      error: response.body.error,
      igId: tokenData.igId,
      recipientId,
      authType: tokenData.authType,
    });
  }
  return NextResponse.json(response.body, { status: response.status });
});
