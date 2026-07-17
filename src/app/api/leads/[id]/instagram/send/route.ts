import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { InstagramMessagingService, type SendDMResult } from "@/infrastructure/services/InstagramMessagingService";
import { logger } from "@/lib/logger";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

const SendMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
});

export const POST = apiHandler(
  async (
      request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    const { supabase, user } = await withAuth(request);
    const body = await request.json();
    const { text } = SendMessageSchema.parse(body);

    const leadRepo = new SupabaseLeadRepository(supabase);
    const lead = await leadRepo.getById(id);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Resolve recipient: prefer instagramScopedId, or resolve handle -> numeric ID
    const authService = new InstagramAuthService(supabase);
    const tokenData = await authService.getToken(user.id);
    const messagingService = new InstagramMessagingService();

    let recipientId = lead.instagramScopedId;

    if (!recipientId && lead.instagramHandle) {
      try {
        // Resolve via Business Discovery API and cache it
        recipientId = await messagingService.resolveHandleToUserId(
          lead.instagramHandle,
          tokenData.igId,
          tokenData.userToken || tokenData.token
        );

        // Cache the resolved ID on the lead for future sends
        await leadRepo.update({
          id: lead.id,
          instagramScopedId: recipientId,
        });
      } catch (resolveError: any) {
        return NextResponse.json(
          {
            error: resolveError.message,
            tip: "Abrí el Graph API Explorer de Meta con el Page Token de JuanshoDev, corré GET /me?fields=id,name y copiá el ID numérico. Después, edita el lead y agregá ese ID en el campo 'Instagram ID' debajo del handle.",
            needsManualId: true,
          },
          { status: 400 }
        );
      }
    }

    if (!recipientId) {
      return NextResponse.json(
        { error: "Lead has no Instagram identifier" },
        { status: 400 }
      );
    }

    // Send the DM via Meta API
    let result: SendDMResult;
    try {
      result = await messagingService.sendDM(
        tokenData.igId,
        recipientId,
        text,
        tokenData.token
      );
    } catch (sendError: any) {
      logger.error("Instagram send failed", {
        error: sendError.message,
        igId: tokenData.igId,
        recipientId,
        tokenPrefix: tokenData.token?.substring(0, 8),
      });
      return NextResponse.json(
        { error: sendError.message || "Error al enviar mensaje de Instagram" },
        { status: 502 }
      );
    }

    // Create outbound activity record
    const activityRepo = new SupabaseActivityRepository(supabase);
    await activityRepo.create({
      type: ActivityType.INSTAGRAM_MESSAGE,
      title: `Instagram DM to ${recipientId}`,
      description: text,
      leadId: lead.id,
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
