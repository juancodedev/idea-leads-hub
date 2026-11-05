import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";
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
      // Instagram Business Login tokens DO NOT work with graph.facebook.com
      // Business Discovery API, so skip resolution for that auth type.
      if (tokenData.authType === "instagram_business_login") {
        return NextResponse.json(
          {
            error:
              "Instagram Business Login no soporta resolución de handles. Agregá manualmente el Instagram ID numérico del lead.",
            needsManualId: true,
          },
          { status: 400 }
        );
      }

      try {
        // Resolve via Business Discovery API
        recipientId = await messagingService.resolveHandleToUserId(
          lead.instagramHandle,
          tokenData.igId,
          tokenData.userToken || tokenData.token
        );

        // Persist the scoped_id BEFORE sending — otherwise the lead's reply
        // could arrive at the webhook before this write propagates,
        // causing the message to appear as a new unlinked conversation.
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

    const message = await messagingModule(supabase).sendToParticipant.execute({
      userId: user.id,
      participantId: recipientId,
      leadId: lead.id,
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
  }
);
