import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const runtime = "nodejs";

const SendMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
});

export const POST = apiHandler(
  async (
    request: NextRequest,
    context: { params: { id: string } }
  ) => {
    const { supabase, user } = await withAuth(request);
    const body = await request.json();
    const { text } = SendMessageSchema.parse(body);

    const leadRepo = new SupabaseLeadRepository(supabase);
    const lead = await leadRepo.getById(context.params.id);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Resolve recipient: prefer instagramScopedId, fallback to instagramHandle
    const recipientId = lead.instagramScopedId || lead.instagramHandle;
    if (!recipientId) {
      return NextResponse.json(
        { error: "Lead has no Instagram identifier" },
        { status: 400 }
      );
    }

    // Get the page access token for the current user
    const authService = new InstagramAuthService(supabase);
    const tokenData = await authService.getToken(user.id);

    // Send the DM via Meta API
    const messagingService = new InstagramMessagingService();
    const result = await messagingService.sendDM(
      tokenData.igId,
      recipientId,
      text,
      tokenData.token
    );

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
