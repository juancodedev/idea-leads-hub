import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { NotFoundError } from "@/infrastructure/repositories/errors";
import { DeliverMessageDeps } from "../../application/use-cases/DeliverMessage";
import { IngestInboundEventDeps } from "../../application/use-cases/IngestInboundEvent";
import { MarkConversationReadDeps } from "../../application/use-cases/MarkConversationRead";
import { MessageRepository } from "../../domain/ports/MessageRepository";
import { callMessagingRpc } from "./rpc";

export interface MessagingSqlExecutors {
  execIngestInbound: IngestInboundEventDeps["execIngestInbound"];
  execRecordEcho: IngestInboundEventDeps["execRecordEcho"];
  execMarkSent: DeliverMessageDeps["execMarkSent"];
  execSetConversationsRead: MarkConversationReadDeps["execSetConversationsRead"];
}

/**
 * Binds the atomic messaging SQL functions (ADR-10) to the use-case deps.
 * `execMarkSent` reloads the row through the repository, so callers get the
 * message as it ends up (an echo may already have adopted it).
 */
export function createMessagingSqlExecutors(
  client: SupabaseClient<Database>,
  messageRepository: MessageRepository
): MessagingSqlExecutors {
  return {
    execIngestInbound: async (input) => {
      const result = await callMessagingRpc(client, "messaging_ingest_inbound", {
        p_conversation_id: input.conversationId,
        p_external_id: input.externalId,
        p_type: input.type,
        p_body: input.body,
        p_raw: input.rawPayload,
        p_at: input.at.toISOString(),
        p_legacy: { title: input.legacy.title },
      });
      return { inserted: result.inserted, messageId: result.message_id ?? null };
    },

    execRecordEcho: async (input) => {
      const result = await callMessagingRpc(client, "messaging_record_echo", {
        p_conversation_id: input.conversationId,
        p_external_id: input.externalId,
        p_body: input.body,
        p_event_at: input.eventAt.toISOString(),
        p_raw: input.rawPayload,
        p_legacy: { title: input.legacy.title },
      });
      return { outcome: result.outcome, messageId: result.message_id ?? null };
    },

    execMarkSent: async (input) => {
      await callMessagingRpc(client, "messaging_mark_sent", {
        p_message_id: input.messageId,
        p_external_id: input.externalId,
        p_legacy: { title: input.legacy.title },
      });
      const message = await messageRepository.findById(input.messageId);
      if (!message) throw new NotFoundError("Message not found");
      return message;
    },

    execSetConversationsRead: async (conversationIds) => {
      await callMessagingRpc(client, "messaging_set_conversations_read", {
        p_conversation_ids: conversationIds,
      });
    },
  };
}
