/**
 * @jest-environment node
 *
 * DeliverMessage (S7 single delivery path, S8 legacy activity).
 */
import { DeliverMessage, DeliverSendContext } from "../DeliverMessage";
import { MessageOrigin } from "../../../domain/enums/MessageOrigin";
import { MessageStatus } from "../../../domain/enums/MessageStatus";
import { MessagingChannel, SendOutcome } from "../../../domain/ports/MessagingChannel";
import { Channel } from "../../../domain/enums/Channel";
import { NotFoundError } from "@/infrastructure/repositories/errors";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

describe("DeliverMessage", () => {
  let store: InMemoryMessagingStore;
  let conversationId: string;
  let send: jest.Mock<Promise<SendOutcome>>;

  let sendContext: DeliverSendContext;

  const makeUseCase = () => {
    const channel: MessagingChannel = {
      channel: Channel.INSTAGRAM,
      verifyWebhook: jest.fn(),
      eventId: jest.fn(),
      parse: jest.fn(),
      send,
    };
    return new DeliverMessage({
      conversationRepository: store.conversationRepository(),
      messageRepository: store.messageRepository(),
      channel,
      execMarkSent: store.markSent,
    });
  };

  const deliver = (origin = MessageOrigin.HUMAN) =>
    makeUseCase().execute({ conversationId, body: "Hola", origin, sendContext });

  /** Simulates the echo of the pending row arriving before Graph answers. */
  const echoArrivesDuringSend = () =>
    store.recordEcho({
      conversationId,
      externalId: "m_echo",
      body: "Hola",
      eventAt: store.now,
      rawPayload: {},
      legacy: { title: "Instagram DM to 123" },
    });

  beforeEach(() => {
    store = new InMemoryMessagingStore();
    conversationId = store.addConversation({
      externalId: "123",
      leadId: "lead_1",
      unreadCount: 3,
    }).id;
    send = jest.fn();
    sendContext = {
      userId: "user_1",
      token: "token",
      authType: "facebook",
      accountId: "ig_business_1",
    };
  });

  it("sends through the channel and stores the message as sent with its Graph id", async () => {
    send.mockResolvedValue({ ok: true, externalId: "m_1" });

    const message = await deliver();

    expect(send).toHaveBeenCalledWith(expect.objectContaining(sendContext), {
      conversationId,
      body: "Hola",
      origin: MessageOrigin.HUMAN,
    });
    expect(message).toMatchObject({
      status: MessageStatus.SENT,
      externalId: "m_1",
      origin: MessageOrigin.HUMAN,
    });
    expect(store.messages).toHaveLength(1);
    expect(store.conversations[0]).toMatchObject({
      lastMessagePreview: "Hola",
      unreadCount: 3,
    });
  });

  it("sends to the conversation's participant when the caller omits the recipient", async () => {
    send.mockResolvedValue({ ok: true, externalId: "m_1" });

    await deliver();

    expect(send).toHaveBeenCalledWith(
      {
        userId: "user_1",
        token: "token",
        authType: "facebook",
        accountId: "ig_business_1",
        recipientId: "123",
      },
      expect.anything()
    );
  });

  it("keeps the recipient the caller passes", async () => {
    send.mockResolvedValue({ ok: true, externalId: "m_1" });
    sendContext = { ...sendContext, recipientId: "explicit_rcpt" };

    await deliver();

    expect(send.mock.calls[0][0].recipientId).toBe("explicit_rcpt");
  });

  it("stores the pending row before calling the channel", async () => {
    send.mockImplementation(async () => {
      expect(store.messages[0].status).toBe(MessageStatus.PENDING);
      return { ok: true, externalId: "m_1" };
    });

    await deliver();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("writes exactly one legacy activity for a sent message", async () => {
    send.mockResolvedValue({ ok: true, externalId: "m_1" });

    const message = await deliver();

    expect(store.legacyFor(message.id)).toEqual([
      expect.objectContaining({
        title: "Instagram DM to 123",
        leadId: "lead_1",
        description: "Hola",
      }),
    ]);
  });

  it("marks the message failed with the error and hint, and writes no legacy activity", async () => {
    send.mockResolvedValue({
      ok: false,
      error: "Invalid OAuth access token",
      hint: "Token vencido: reconectá Instagram",
    });

    const message = await deliver();

    expect(message).toMatchObject({
      status: MessageStatus.FAILED,
      errorMessage: "Invalid OAuth access token",
      hint: "Token vencido: reconectá Instagram",
    });
    expect(store.activities).toHaveLength(0);
  });

  it("stores auto trigger messages with origin auto", async () => {
    send.mockResolvedValue({ ok: true, externalId: "m_1" });

    const message = await deliver(MessageOrigin.AUTO);

    expect(message.origin).toBe(MessageOrigin.AUTO);
  });

  it("keeps the echo's id and a single legacy activity when the echo adopted the row first", async () => {
    send.mockImplementation(async () => {
      await echoArrivesDuringSend();
      return { ok: true, externalId: "m_echo" };
    });

    const message = await deliver();

    expect(store.messages).toHaveLength(1);
    expect(message).toMatchObject({ status: MessageStatus.SENT, externalId: "m_echo" });
    expect(store.activities).toHaveLength(1);
  });

  it("does not downgrade a row the echo already made sent when the send then fails", async () => {
    send.mockImplementation(async () => {
      await echoArrivesDuringSend();
      return { ok: false, error: "timeout", hint: "No se pudo contactar a Instagram" };
    });

    const message = await deliver();

    expect(message).toMatchObject({
      status: MessageStatus.SENT,
      externalId: "m_echo",
      errorMessage: null,
      hint: null,
    });
    expect(store.activities).toHaveLength(1);
  });

  it("throws NotFoundError and stores nothing when the conversation does not exist", async () => {
    conversationId = "missing";

    await expect(deliver()).rejects.toBeInstanceOf(NotFoundError);
    expect(send).not.toHaveBeenCalled();
    expect(store.messages).toHaveLength(0);
  });
});
