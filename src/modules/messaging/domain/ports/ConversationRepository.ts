import { Conversation } from "../entities/Conversation";
import { InboxKey } from "../values/InboxKey";

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
  /** The user's conversations, most recent `last_message_at` first. */
  listByUser(userId: string): Promise<Conversation[]>;
  /** The set of the user's conversations an inbox key resolves to (ADR-11). */
  findByInboxKey(userId: string, key: InboxKey): Promise<Conversation[]>;
  /** Sets `lead_id` on the user's conversations with these ids. */
  linkToLead(userId: string, conversationIds: string[], leadId: string): Promise<void>;
  /** Deletes the user's conversations with these ids (messages cascade). */
  deleteByIds(userId: string, conversationIds: string[]): Promise<void>;
  /** Sum of `unread_count` over the user's conversations (S12 badge). */
  sumUnreadCount(userId: string): Promise<number>;
}
