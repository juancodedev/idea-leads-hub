import { Conversation } from "../entities/Conversation";

export type NewConversation = Omit<Conversation, "id" | "createdAt" | "updatedAt">;

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByAccountAndExternalId(
    accountId: string,
    externalId: string
  ): Promise<Conversation | null>;
  findByLeadId(leadId: string): Promise<Conversation[]>;
  /**
   * Returns the conversation for (accountId, externalId), creating it when
   * missing. MUST be race-safe: a concurrent creation of the same pair
   * returns the existing row instead of failing (insert on conflict do
   * nothing + select).
   */
  findOrCreate(conversation: NewConversation): Promise<Conversation>;
  update(id: string, patch: Partial<Conversation>): Promise<Conversation>;
}
