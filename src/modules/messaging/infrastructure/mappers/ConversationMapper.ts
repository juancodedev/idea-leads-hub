import { Database } from "@/infrastructure/database/database.types";
import { Conversation } from "../../domain/entities/Conversation";
import { Channel } from "../../domain/enums/Channel";
import { NewConversation } from "../../domain/ports/ConversationRepository";
import { toDate, toDateOrNull, toIsoOrNull } from "./dates";

type Tables = Database["public"]["Tables"];
export type ConversationRow = Tables["conversations"]["Row"];
export type ConversationInsert = Tables["conversations"]["Insert"];
export type ConversationUpdate = Tables["conversations"]["Update"];

export const ConversationMapper = {
  toDomain(row: ConversationRow): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      leadId: row.lead_id,
      accountId: row.account_id,
      channel: row.channel as Channel,
      externalId: row.external_id,
      participantName: row.participant_name,
      lastInboundAt: toDateOrNull(row.last_inbound_at),
      lastMessageAt: toDateOrNull(row.last_message_at),
      lastMessagePreview: row.last_message_preview,
      unreadCount: row.unread_count,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    };
  },

  toInsert(conversation: NewConversation): ConversationInsert {
    return {
      user_id: conversation.userId,
      lead_id: conversation.leadId,
      account_id: conversation.accountId,
      channel: conversation.channel,
      external_id: conversation.externalId,
      participant_name: conversation.participantName,
      last_inbound_at: toIsoOrNull(conversation.lastInboundAt),
      last_message_at: toIsoOrNull(conversation.lastMessageAt),
      last_message_preview: conversation.lastMessagePreview,
      unread_count: conversation.unreadCount,
      metadata: conversation.metadata,
    };
  },

  /** Maps only the fields present in the patch. */
  toUpdate(patch: Partial<Conversation>): ConversationUpdate {
    const update: ConversationUpdate = {};
    if (patch.userId !== undefined) update.user_id = patch.userId;
    if (patch.leadId !== undefined) update.lead_id = patch.leadId;
    if (patch.accountId !== undefined) update.account_id = patch.accountId;
    if (patch.channel !== undefined) update.channel = patch.channel;
    if (patch.externalId !== undefined) update.external_id = patch.externalId;
    if (patch.participantName !== undefined) update.participant_name = patch.participantName;
    if (patch.lastInboundAt !== undefined) update.last_inbound_at = toIsoOrNull(patch.lastInboundAt);
    if (patch.lastMessageAt !== undefined) update.last_message_at = toIsoOrNull(patch.lastMessageAt);
    if (patch.lastMessagePreview !== undefined) {
      update.last_message_preview = patch.lastMessagePreview;
    }
    if (patch.unreadCount !== undefined) update.unread_count = patch.unreadCount;
    if (patch.metadata !== undefined) update.metadata = patch.metadata;
    return update;
  },
};
