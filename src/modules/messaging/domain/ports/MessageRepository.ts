import { Message } from "../entities/Message";

export interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  findByExternalId(externalId: string): Promise<Message | null>;
  findByConversation(conversationId: string): Promise<Message[]>;
  /** Messages of several conversations merged, oldest first. */
  findByConversations(conversationIds: string[]): Promise<Message[]>;
  create(message: Omit<Message, "id" | "createdAt" | "updatedAt">): Promise<Message>;
  /**
   * Marks the message failed only while it is still `pending`, and returns
   * the row as it ends up. A row an echo already made `sent` is returned
   * unchanged (never downgraded).
   */
  markFailedIfPending(id: string, error: string, hint: string): Promise<Message>;
}
