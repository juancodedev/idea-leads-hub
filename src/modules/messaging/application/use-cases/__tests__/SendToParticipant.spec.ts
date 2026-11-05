/**
 * @jest-environment node
 *
 * SendToParticipant (S7, S10): resolves the user's channel account and the
 * participant's conversation (created when missing), then delivers through
 * the single DeliverMessage path.
 */
import { SendToParticipant } from "../SendToParticipant";
import { DeliverMessage } from "../DeliverMessage";
import { LinkInboxConversations } from "../LinkInboxConversations";
import { Channel } from "../../../domain/enums/Channel";
import { MessageOrigin } from "../../../domain/enums/MessageOrigin";
import { MessageStatus } from "../../../domain/enums/MessageStatus";
import { MessagingChannel, SendOutcome } from "../../../domain/ports/MessagingChannel";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

describe("SendToParticipant", () => {
  let store: InMemoryMessagingStore;
  let send: jest.Mock<Promise<SendOutcome>>;

  const useCase = () => {
    const channel: MessagingChannel = {
      channel: Channel.INSTAGRAM,
      verifyWebhook: jest.fn(),
      eventId: jest.fn(),
      parse: jest.fn(),
      send,
    };
    const conversationRepository = store.conversationRepository();
    return new SendToParticipant({
      channelAccountRepository: store.channelAccountRepository(),
      conversationRepository,
      deliverMessage: new DeliverMessage({
        conversationRepository,
        messageRepository: store.messageRepository(),
        channel,
        execMarkSent: store.markSent,
      }),
      linkInboxConversations: new LinkInboxConversations({
        conversationRepository,
        legacyActivityRepository: store.legacyActivityRepository(),
        leadLookup: store.leadLookup(),
      }),
    });
  };

  const sendContext = { userId: "user_1", token: "page-token", authType: "facebook", accountId: "ig_123" };

  beforeEach(() => {
    store = new InMemoryMessagingStore();
    send = jest.fn().mockResolvedValue({ ok: true, externalId: "mid_1" });
  });

  it("creates the participant's conversation on the user's account and returns the sent message", async () => {
    const account = store.addAccount({ externalAccountId: "ig_123" });

    const message = await useCase().execute({
      userId: "user_1",
      participantId: "999",
      leadId: null,
      body: "Hola",
      origin: MessageOrigin.HUMAN,
      sendContext,
    });

    expect(message).toMatchObject({ status: MessageStatus.SENT, externalId: "mid_1", origin: "human" });
    expect(store.conversations).toHaveLength(1);
    expect(store.conversations[0]).toMatchObject({
      accountId: account.id,
      externalId: "999",
      leadId: null,
      unreadCount: 0,
    });
    expect(send).toHaveBeenCalledWith(
      { ...sendContext, recipientId: "999" },
      expect.objectContaining({ body: "Hola", origin: "human" })
    );
    expect(store.legacyFor(message.id)[0]).toMatchObject({ title: "Instagram DM to 999", leadId: null });
  });

  it("reuses the existing conversation and links an unlinked one to the lead before sending", async () => {
    const account = store.addAccount({ externalAccountId: "ig_123" });
    const lead = store.addLead();
    const existing = store.addConversation({ accountId: account.id, externalId: "999" });

    const message = await useCase().execute({
      userId: "user_1",
      participantId: "999",
      leadId: lead.id,
      body: "Hola",
      origin: MessageOrigin.AUTO,
      sendContext,
    });

    expect(store.conversations).toHaveLength(1);
    expect(message.conversationId).toBe(existing.id);
    expect(existing.leadId).toBe(lead.id);
    expect(message.origin).toBe(MessageOrigin.AUTO);
    expect(store.legacyFor(message.id)[0].leadId).toBe(lead.id);
  });

  it("creates the user's channel account from the send context when none exists", async () => {
    await useCase().execute({
      userId: "user_1",
      participantId: "999",
      leadId: null,
      body: "Hola",
      origin: MessageOrigin.HUMAN,
      sendContext,
    });

    expect(store.accounts).toEqual([
      expect.objectContaining({ userId: "user_1", channel: "instagram", externalAccountId: "ig_123" }),
    ]);
  });

  it("never sends from another user's account", async () => {
    store.addAccount({ userId: "user_2", externalAccountId: "ig_other" });
    const mine = store.addAccount({ userId: "user_1", externalAccountId: "ig_123" });

    const message = await useCase().execute({
      userId: "user_1",
      participantId: "999",
      leadId: null,
      body: "Hola",
      origin: MessageOrigin.HUMAN,
      sendContext,
    });

    expect(store.conversations.find((c) => c.id === message.conversationId)!.accountId).toBe(mine.id);
  });

  it("returns the failed message with error and hint when the channel rejects it", async () => {
    store.addAccount({ externalAccountId: "ig_123" });
    send.mockResolvedValue({ ok: false, error: "Invalid OAuth access token", hint: "Token vencido: reconectá Instagram" });

    const message = await useCase().execute({
      userId: "user_1",
      participantId: "999",
      leadId: null,
      body: "Hola",
      origin: MessageOrigin.HUMAN,
      sendContext,
    });

    expect(message).toMatchObject({
      status: MessageStatus.FAILED,
      errorMessage: "Invalid OAuth access token",
      hint: "Token vencido: reconectá Instagram",
    });
    expect(store.messages).toHaveLength(1);
  });
});
