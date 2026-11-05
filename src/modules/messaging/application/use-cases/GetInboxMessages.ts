import { Message } from "../../domain/entities/Message";
import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { MessageRepository } from "../../domain/ports/MessageRepository";
import { InboxKey } from "../../domain/values/InboxKey";

export interface GetInboxMessagesDeps {
  conversationRepository: ConversationRepository;
  messageRepository: MessageRepository;
}

/** Messages of every conversation behind an inbox key, oldest first (S10). */
export class GetInboxMessages {
  constructor(private readonly deps: GetInboxMessagesDeps) {}

  async execute(userId: string, key: InboxKey): Promise<Message[]> {
    const conversations = await this.deps.conversationRepository.findByInboxKey(userId, key);
    if (conversations.length === 0) return [];
    return this.deps.messageRepository.findByConversations(conversations.map((c) => c.id));
  }
}
