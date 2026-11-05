import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { LegacyActivityRepository } from "../../domain/ports/LegacyActivityRepository";
import { InboxKey } from "../../domain/values/InboxKey";

export interface DeleteInboxConversationsDeps {
  conversationRepository: ConversationRepository;
  legacyActivityRepository: LegacyActivityRepository;
}

/**
 * Deletes an inbox key (ADR-11), in this order: (1) the legacy activities
 * matched as before the pipeline, which also covers never-copied ones (no FK
 * from `messages.legacy_activity_id`); (2) the conversations of the set,
 * whose messages cascade.
 */
export class DeleteInboxConversations {
  constructor(private readonly deps: DeleteInboxConversationsDeps) {}

  async execute(userId: string, key: InboxKey): Promise<void> {
    const { conversationRepository, legacyActivityRepository } = this.deps;
    const conversations = await conversationRepository.findByInboxKey(userId, key);
    await legacyActivityRepository.deleteForKey(userId, key);
    if (conversations.length > 0) {
      await conversationRepository.deleteByIds(
        userId,
        conversations.map((c) => c.id)
      );
    }
  }
}
