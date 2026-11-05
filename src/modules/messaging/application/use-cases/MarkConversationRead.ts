export interface MarkConversationReadDeps {
  /**
   * messaging_set_conversations_read: unread_count = 0 on each conversation
   * and read_at = now() on their unread inbound legacy activities, atomically.
   */
  execSetConversationsRead: (conversationIds: string[]) => Promise<void>;
}

export class MarkConversationRead {
  constructor(private readonly deps: MarkConversationReadDeps) {}

  /** Marks the set of conversations behind an inbox key as read (S10, S12). */
  async execute(conversationIds: string[]): Promise<void> {
    const ids = [...new Set(conversationIds)];
    if (ids.length === 0) return;
    await this.deps.execSetConversationsRead(ids);
  }
}
