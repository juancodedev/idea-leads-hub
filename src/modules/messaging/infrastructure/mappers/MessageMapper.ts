import { Database } from "@/infrastructure/database/database.types";
import { Message } from "../../domain/entities/Message";
import { MessageDirection } from "../../domain/enums/MessageDirection";
import { MessageOrigin } from "../../domain/enums/MessageOrigin";
import { MessageStatus } from "../../domain/enums/MessageStatus";
import { toDate, toDateOrNull, toIsoOrNull } from "./dates";

type Tables = Database["public"]["Tables"];
export type MessageRow = Tables["messages"]["Row"];
export type MessageInsert = Tables["messages"]["Insert"];
export type NewMessage = Omit<Message, "id" | "createdAt" | "updatedAt">;

export const MessageMapper = {
  toDomain(row: MessageRow): Message {
    return {
      id: row.id,
      userId: row.user_id,
      conversationId: row.conversation_id,
      direction: row.direction as MessageDirection,
      origin: row.origin as MessageOrigin | null,
      type: row.type,
      body: row.body,
      externalId: row.external_id,
      status: row.status as MessageStatus,
      errorMessage: row.error_message,
      hint: row.hint,
      legacyActivityId: row.legacy_activity_id,
      rawPayload: row.raw_payload,
      createdAt: toDate(row.created_at),
      deliveredAt: toDateOrNull(row.delivered_at),
      readAt: toDateOrNull(row.read_at),
      updatedAt: toDate(row.updated_at),
    };
  },

  toInsert(message: NewMessage): MessageInsert {
    return {
      user_id: message.userId,
      conversation_id: message.conversationId,
      direction: message.direction,
      origin: message.origin,
      type: message.type,
      body: message.body,
      external_id: message.externalId,
      status: message.status,
      error_message: message.errorMessage,
      hint: message.hint,
      legacy_activity_id: message.legacyActivityId,
      raw_payload: message.rawPayload,
      delivered_at: toIsoOrNull(message.deliveredAt),
      read_at: toIsoOrNull(message.readAt),
    };
  },
};
