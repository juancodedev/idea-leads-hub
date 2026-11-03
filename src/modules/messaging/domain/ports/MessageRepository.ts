import { Message } from "../entities/Message";

export interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  findByExternalId(externalId: string): Promise<Message | null>;
  findByConversation(conversationId: string): Promise<Message[]>;
  create(message: Omit<Message, "id" | "createdAt" | "updatedAt">): Promise<Message>;
  update(id: string, patch: Partial<Message>): Promise<Message>;
}
