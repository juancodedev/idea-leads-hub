import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { DeliverMessage } from "./application/use-cases/DeliverMessage";
import { IngestInboundEvent } from "./application/use-cases/IngestInboundEvent";
import { MarkConversationRead } from "./application/use-cases/MarkConversationRead";
import { ProcessWebhookEvent } from "./application/use-cases/ProcessWebhookEvent";
import { SweepWebhookEvents } from "./application/use-cases/SweepWebhookEvents";
import { MessagingChannel } from "./domain/ports/MessagingChannel";
import { MetaInstagramChannel } from "./infrastructure/channels/MetaInstagramChannel";
import { SupabaseChannelAccountRepository } from "./infrastructure/repositories/SupabaseChannelAccountRepository";
import { SupabaseConversationRepository } from "./infrastructure/repositories/SupabaseConversationRepository";
import { SupabaseLeadLookup } from "./infrastructure/repositories/SupabaseLeadLookup";
import { SupabaseMessageRepository } from "./infrastructure/repositories/SupabaseMessageRepository";
import { SupabaseWebhookEventRepository } from "./infrastructure/repositories/SupabaseWebhookEventRepository";
import { createMessagingSqlExecutors } from "./infrastructure/sql/executors";

export interface MessagingModuleOptions {
  /** Overrides the Meta Instagram channel (tests, other channels later). */
  channel?: MessagingChannel;
}

/**
 * Composition root of the messaging module (ADR-1). Works with the user
 * client (RLS) and with the service-role client from createAdminClient()
 * (webhook, sweep): repositories scope every query by explicit ids (ADR-2).
 */
export function messagingModule(
  supabase: SupabaseClient<Database>,
  options: MessagingModuleOptions = {}
) {
  const channelAccountRepository = new SupabaseChannelAccountRepository(supabase);
  const conversationRepository = new SupabaseConversationRepository(supabase);
  const messageRepository = new SupabaseMessageRepository(supabase);
  const webhookEventRepository = new SupabaseWebhookEventRepository(supabase);
  const leadLookup = new SupabaseLeadLookup(supabase);
  const channel = options.channel ?? new MetaInstagramChannel();
  const sql = createMessagingSqlExecutors(supabase, messageRepository);

  const ingestInboundEvent = new IngestInboundEvent({
    channelAccountRepository,
    conversationRepository,
    leadLookup,
    execIngestInbound: sql.execIngestInbound,
    execRecordEcho: sql.execRecordEcho,
  });

  const deliverMessage = new DeliverMessage({
    conversationRepository,
    messageRepository,
    channel,
    execMarkSent: sql.execMarkSent,
  });

  const processWebhookEvent = new ProcessWebhookEvent({
    webhookEventRepository,
    parsePayload: (payload) => channel.parse(payload),
    ingestEvent: (event) => ingestInboundEvent.execute(event),
  });

  const sweepWebhookEvents = new SweepWebhookEvents({
    webhookEventRepository,
    processEvent: (event) => processWebhookEvent.execute(event.eventId, event),
  });

  const markConversationRead = new MarkConversationRead({
    execSetConversationsRead: sql.execSetConversationsRead,
  });

  return {
    channel,
    channelAccountRepository,
    conversationRepository,
    messageRepository,
    webhookEventRepository,
    leadLookup,
    ingestInboundEvent,
    deliverMessage,
    processWebhookEvent,
    sweepWebhookEvents,
    markConversationRead,
  };
}

export type MessagingModule = ReturnType<typeof messagingModule>;
