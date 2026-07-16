import { Lead } from '@/core/domain/Lead';
import { InstagramAuthService } from '@/infrastructure/services/InstagramAuthService';
import { InstagramMessagingService } from '@/infrastructure/services/InstagramMessagingService';

const AUTO_DM_TEMPLATES: Record<string, string> = {
  Interesado:
    '¡Gracias por tu interés en nuestros servicios! Quedamos atentos a cualquier consulta que tengas.',
  Ganado:
    '¡Felicitaciones! Estamos muy contentos de trabajar juntos. En breve recibirás más información.',
  Perdido:
    'Gracias por tu tiempo. Si en el futuro surge algo, no dudes en contactarnos.',
};

export class InstagramAutoTrigger {
  /**
   * Check if a lead status transition should trigger an auto-DM.
   * @returns true if a DM was sent, false otherwise
   */
  async maybeSendAutoDm(
    lead: Lead,
    newStatus: string,
    authService: InstagramAuthService,
    messagingService: InstagramMessagingService
  ): Promise<boolean> {
    // Must have an Instagram-scoped ID to send
    if (!lead.instagramScopedId) {
      return false;
    }

    // Check if this status transition has a configured message
    const template = AUTO_DM_TEMPLATES[newStatus];
    if (!template) {
      return false;
    }

    try {
      const { token, igId } = await authService.getToken(lead.userId);

      // TODO: Check 24h conversation window before sending.
      // Meta's messaging policy requires an active user-initiated conversation
      // within the last 24 hours for MESSAGE_TAG sends. If outside the window
      // we need to fall back to a HANDOVER_PROTOCOL or ICE_BREAKER message.
      // For now, always attempt the send and log when it's outside the window.
      if (!igId || !token) {
        console.info(
          `[InstagramAutoTrigger] Cannot send DM for lead ${lead.id}: missing token or IG ID (outside 24h window check placeholder)`
        );
        return false;
      }

      const result = await messagingService.sendDM(
        igId,
        lead.instagramScopedId,
        template,
        token
      );

      console.info(
        `[InstagramAutoTrigger] Auto DM sent for lead ${lead.id} (status → ${newStatus}): ${result.messageId}`
      );

      return true;
    } catch (error) {
      console.info(
        `[InstagramAutoTrigger] Could not send auto DM for lead ${lead.id}: outside 24h window or token missing`,
        error
      );
      return false;
    }
  }
}
