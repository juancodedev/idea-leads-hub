import { CountUnreadMessages } from "./application/use-cases/CountUnreadMessages";
import { DeleteInboxConversations } from "./application/use-cases/DeleteInboxConversations";
import { DeliverMessage, DeliverMessageDeps } from "./application/use-cases/DeliverMessage";
import { GetInboxMessages } from "./application/use-cases/GetInboxMessages";
import {
  IngestInboundEvent,
  IngestInboundEventDeps,
} from "./application/use-cases/IngestInboundEvent";
import { LinkInboxConversations } from "./application/use-cases/LinkInboxConversations";
import { ListInbox } from "./application/use-cases/ListInbox";
import {
  MarkConversationRead,
  MarkConversationReadDeps,
} from "./application/use-cases/MarkConversationRead";
import { MarkInboxRead } from "./application/use-cases/MarkInboxRead";
import { ProcessWebhookEvent } from "./application/use-cases/ProcessWebhookEvent";
import { SendToParticipant } from "./application/use-cases/SendToParticipant";
import { SweepWebhookEvents } from "./application/use-cases/SweepWebhookEvents";
import { ChannelAccountRepository } from "./domain/ports/ChannelAccountRepository";
import { ConversationRepository } from "./domain/ports/ConversationRepository";
import { LeadLookup } from "./domain/ports/LeadLookup";
import { LegacyActivityRepository } from "./domain/ports/LegacyActivityRepository";
import { MessageRepository } from "./domain/ports/MessageRepository";
import { MessagingChannel } from "./domain/ports/MessagingChannel";
import { WebhookEventRepository } from "./domain/ports/WebhookEventRepository";

/** Ports and atomic SQL executors (ADR-10) the messaging use cases run on. */
export interface MessagingPorts {
  channel: MessagingChannel;
  channelAccountRepository: ChannelAccountRepository;
  conversationRepository: ConversationRepository;
  messageRepository: MessageRepository;
  webhookEventRepository: WebhookEventRepository;
  leadLookup: LeadLookup;
  legacyActivityRepository: LegacyActivityRepository;
  execIngestInbound: IngestInboundEventDeps["execIngestInbound"];
  execRecordEcho: IngestInboundEventDeps["execRecordEcho"];
  execMarkSent: DeliverMessageDeps["execMarkSent"];
  execSetConversationsRead: MarkConversationReadDeps["execSetConversationsRead"];
}

/**
 * Wires the messaging use cases on a set of ports. `messagingModule(supabase)`
 * passes the Supabase adapters; tests pass the in-memory store.
 */
export function composeMessaging(ports: MessagingPorts) {
  const {
    channel,
    channelAccountRepository,
    conversationRepository,
    messageRepository,
    webhookEventRepository,
    leadLookup,
    legacyActivityRepository,
  } = ports;

  const ingestInboundEvent = new IngestInboundEvent({
    channelAccountRepository,
    conversationRepository,
    leadLookup,
    execIngestInbound: ports.execIngestInbound,
    execRecordEcho: ports.execRecordEcho,
  });

  const deliverMessage = new DeliverMessage({
    conversationRepository,
    messageRepository,
    channel,
    execMarkSent: ports.execMarkSent,
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
    execSetConversationsRead: ports.execSetConversationsRead,
  });

  const linkInboxConversations = new LinkInboxConversations({
    conversationRepository,
    legacyActivityRepository,
    leadLookup,
  });

  return {
    channel,
    channelAccountRepository,
    conversationRepository,
    messageRepository,
    webhookEventRepository,
    leadLookup,
    legacyActivityRepository,
    ingestInboundEvent,
    deliverMessage,
    processWebhookEvent,
    sweepWebhookEvents,
    markConversationRead,
    linkInboxConversations,
    listInbox: new ListInbox({ conversationRepository, leadLookup }),
    getInboxMessages: new GetInboxMessages({ conversationRepository, messageRepository }),
    markInboxRead: new MarkInboxRead({ conversationRepository, markConversationRead }),
    deleteInboxConversations: new DeleteInboxConversations({
      conversationRepository,
      legacyActivityRepository,
    }),
    countUnreadMessages: new CountUnreadMessages({ conversationRepository }),
    sendToParticipant: new SendToParticipant({
      channelAccountRepository,
      conversationRepository,
      deliverMessage,
      linkInboxConversations,
    }),
  };
}

export type MessagingModule = ReturnType<typeof composeMessaging>;
