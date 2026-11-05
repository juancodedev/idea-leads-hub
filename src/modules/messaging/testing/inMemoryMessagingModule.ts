import { composeMessaging } from "../composition";
import { Channel } from "../domain/enums/Channel";
import { MessagingChannel } from "../domain/ports/MessagingChannel";
import { InMemoryMessagingStore } from "./InMemoryMessagingStore";

/**
 * The real messaging use cases wired on the in-memory store, for route
 * tests. `send` defaults to a successful Graph send.
 */
export function inMemoryMessagingModule(
  store: InMemoryMessagingStore,
  send: MessagingChannel["send"] = async () => ({ ok: true, externalId: "mid_test" })
) {
  const channel: MessagingChannel = {
    channel: Channel.INSTAGRAM,
    verifyWebhook: async () => true,
    eventId: async () => "evt_test",
    parse: () => [],
    send,
  };
  return composeMessaging({
    channel,
    channelAccountRepository: store.channelAccountRepository(),
    conversationRepository: store.conversationRepository(),
    messageRepository: store.messageRepository(),
    webhookEventRepository: store.webhookEventRepository(),
    leadLookup: store.leadLookup(),
    legacyActivityRepository: store.legacyActivityRepository(),
    execIngestInbound: store.ingestInbound,
    execRecordEcho: store.recordEcho,
    execMarkSent: store.markSent,
    execSetConversationsRead: store.setConversationsRead,
  });
}
