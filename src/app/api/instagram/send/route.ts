import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { InstagramMessagingService, type SendDMResult } from "@/infrastructure/services/InstagramMessagingService";
import { logger } from "@/lib/logger";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

const SendMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
  recipientId: z.string().min(1, "Recipient Instagram ID is required"),
});

export const POST = apiHandler(
  async (request: NextRequest) => {
    const { supabase, user } = await withAuth(request);
    const body = await request.json();
    const { text, recipientId } = SendMessageSchema.parse(body);

    // Resolve auth token
    const authService = new InstagramAuthService(supabase);
    const tokenData = await authService.getToken(user.id);

    if (!recipientId) {
      return NextResponse.json(
        { error: "Recipient Instagram ID is required" },
        { status: 400 }
      );
    }

    // Send the DM via the correct API path based on auth type
    const messagingService = new InstagramMessagingService();

    let result: SendDMResult;
    try {
      if (tokenData.authType === "instagram_business_login") {
        result = await messagingService.sendDMViaInstagramLogin(
          tokenData.igId,
          recipientId,
          text,
          tokenData.userToken
        );
      } else {
        result = await messagingService.sendDM(
          tokenData.igId,
          recipientId,
          text,
          tokenData.token
        );
      }
    } catch (sendError: any) {
      logger.error("Instagram send failed", {
        error: sendError.message,
        igId: tokenData.igId,
        recipientId,
        authType: tokenData.authType,
        tokenPrefix: tokenData.token?.substring(0, 8),
      });
      return NextResponse.json(
        { error: sendError.message || "Error al enviar mensaje de Instagram" },
        { status: 502 }
      );
    }

    // Create outbound activity — no leadId (unlinked conversation)
    const activityRepo = new SupabaseActivityRepository(supabase);
    await activityRepo.create({
      type: ActivityType.INSTAGRAM_MESSAGE,
      title: `Instagram DM to ${recipientId}`,
      description: text,
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

    return NextResponse.json(
      { messageId: result.messageId },
      { status: 200 }
    );
  }
);
