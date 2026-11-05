import { ConversationRepository } from "../../domain/ports/ConversationRepository";

export interface CountUnreadMessagesDeps {
  conversationRepository: ConversationRepository;
}

/** Unread badge (S12): sum of `unread_count` over the user's conversations. */
export class CountUnreadMessages {
  constructor(private readonly deps: CountUnreadMessagesDeps) {}

  execute(userId: string): Promise<number> {
    return this.deps.conversationRepository.sumUnreadCount(userId);
  }
}
