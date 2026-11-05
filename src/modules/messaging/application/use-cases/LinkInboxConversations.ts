import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { LeadLookup } from "../../domain/ports/LeadLookup";
import { LegacyActivityRepository } from "../../domain/ports/LegacyActivityRepository";

export interface LinkInboxConversationsDeps {
  conversationRepository: ConversationRepository;
  legacyActivityRepository: LegacyActivityRepository;
  leadLookup: LeadLookup;
}

export type LinkResult = "linked" | "lead_not_found";

/**
 * Links the `unlinked:<participantId>` set to a lead (ADR-11): `lead_id` on
 * those conversations and on their legacy activities. A lead the user does
 * not own changes nothing.
 */
export class LinkInboxConversations {
  constructor(private readonly deps: LinkInboxConversationsDeps) {}

  async execute(userId: string, participantId: string, leadId: string): Promise<LinkResult> {
    const { conversationRepository, legacyActivityRepository, leadLookup } = this.deps;
    if (!(await leadLookup.exists(userId, leadId))) return "lead_not_found";

    const conversations = await conversationRepository.findByInboxKey(userId, {
      kind: "unlinked",
      participantId,
    });
    await legacyActivityRepository.linkParticipantToLead(userId, participantId, leadId);
    if (conversations.length > 0) {
      await conversationRepository.linkToLead(
        userId,
        conversations.map((c) => c.id),
        leadId
      );
    }
    return "linked";
  }
}
