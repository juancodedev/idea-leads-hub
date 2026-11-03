import { Conversation } from "../entities/Conversation";

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByAccountAndExternalId(
    accountId: string,
    externalId: string
  ): Promise<Conversation | null>;
  findByLeadId(leadId: string): Promise<Conversation[]>;
  create(conversation: Omit<Conversation, "id" | "createdAt" | "updatedAt">): Promise<Conversation>;
  update(id: string, patch: Partial<Conversation>): Promise<Conversation>;
}
