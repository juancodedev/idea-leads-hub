import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { InboxKey } from "../../domain/values/InboxKey";
import { MarkConversationRead } from "./MarkConversationRead";

export interface MarkInboxReadDeps {
  conversationRepository: ConversationRepository;
  markConversationRead: MarkConversationRead;
}

/**
 * Marks every conversation behind an inbox key read (S10, S12): their
 * `unread_count` becomes 0 and their unread legacy activities get `read_at`.
 * Returns the ids of the conversations marked.
 */
export class MarkInboxRead {
  constructor(private readonly deps: MarkInboxReadDeps) {}

  async execute(userId: string, key: InboxKey): Promise<string[]> {
    const conversations = await this.deps.conversationRepository.findByInboxKey(userId, key);
    const ids = conversations.map((c) => c.id);
    await this.deps.markConversationRead.execute(ids);
    return ids;
  }
}
