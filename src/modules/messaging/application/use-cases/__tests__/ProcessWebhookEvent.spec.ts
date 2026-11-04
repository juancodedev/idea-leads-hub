/**
 * @jest-environment node
 *
 * ProcessWebhookEvent (S4 processing outcome and bounded retries).
 */
import { ProcessWebhookEvent } from "../ProcessWebhookEvent";
import { IngestResult } from "../IngestInboundEvent";
import { InboundEvent } from "../../../domain/events/InboundEvent";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

describe("ProcessWebhookEvent", () => {
  let store: InMemoryMessagingStore;
  let parsePayload: jest.Mock<InboundEvent[], [unknown]>;
  let ingestEvent: jest.Mock<Promise<IngestResult>, [InboundEvent]>;

  const inbound = (mid: string): InboundEvent => ({
    kind: "message",
    accountId: "ig_123",
    participantId: "123",
    mid,
    text: "Hola",
    timestamp: new Date(),
    rawPayload: {},
  });
  const processed: IngestResult = {
    kind: "processed",
    conversationId: "c",
    messageId: "m",
    outcome: "inserted",
  };
  const duplicate: IngestResult = { kind: "ignored", reason: "duplicate-mid" };

  const makeUseCase = () =>
    new ProcessWebhookEvent({
      webhookEventRepository: store.webhookEventRepository(),
      parsePayload,
      ingestEvent,
    });

  const eventState = (id: string) => store.events.find((e) => e.eventId === id)!;

  beforeEach(() => {
    store = new InMemoryMessagingStore();
    parsePayload = jest.fn().mockReturnValue([inbound("m_1")]);
    ingestEvent = jest.fn().mockResolvedValue(processed);
  });

  it("marks the event processed when at least one message is stored", async () => {
    const { eventId } = store.addEvent();
    parsePayload.mockReturnValue([inbound("m_1"), inbound("m_2")]);
    ingestEvent.mockResolvedValueOnce(duplicate).mockResolvedValueOnce(processed);

    const result = await makeUseCase().execute(eventId);

    expect(result).toBe("processed");
    expect(ingestEvent).toHaveBeenCalledTimes(2);
    expect(eventState(eventId)).toMatchObject({ status: "processed", attempts: 1 });
  });

  it("marks the event ignored when the payload yields no events", async () => {
    const { eventId } = store.addEvent();
    parsePayload.mockReturnValue([]);

    expect(await makeUseCase().execute(eventId)).toBe("ignored");
    expect(eventState(eventId).status).toBe("ignored");
  });

  it("marks the event ignored when every event was a duplicate or unknown", async () => {
    const { eventId } = store.addEvent();
    ingestEvent.mockResolvedValue(duplicate);

    expect(await makeUseCase().execute(eventId)).toBe("ignored");
    expect(eventState(eventId).status).toBe("ignored");
  });

  it("marks the event failed when the payload cannot be parsed", async () => {
    const { eventId } = store.addEvent();
    parsePayload.mockImplementation(() => {
      throw new Error("malformed");
    });

    expect(await makeUseCase().execute(eventId)).toBe("failed");
    expect(eventState(eventId)).toMatchObject({ status: "failed", attempts: 1 });
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it("leaves the event received for the sweep after a retryable error", async () => {
    const { eventId } = store.addEvent();
    ingestEvent.mockRejectedValue(new Error("connection reset"));

    expect(await makeUseCase().execute(eventId)).toBe("received");
    expect(eventState(eventId)).toMatchObject({ status: "received", attempts: 1 });
  });

  it("marks the event failed when the third attempt errors", async () => {
    const { eventId } = store.addEvent({ attempts: 2 });
    ingestEvent.mockRejectedValue(new Error("connection reset"));

    expect(await makeUseCase().execute(eventId)).toBe("failed");
    expect(eventState(eventId)).toMatchObject({ status: "failed", attempts: 3 });
  });

  it("skips an event another run already handled, without counting an attempt", async () => {
    const { eventId } = store.addEvent({ status: "processed", attempts: 1 });

    expect(await makeUseCase().execute(eventId)).toBe("skipped");
    expect(ingestEvent).not.toHaveBeenCalled();
    expect(eventState(eventId)).toMatchObject({ status: "processed", attempts: 1 });
  });

  it("skips an unknown event id", async () => {
    expect(await makeUseCase().execute("missing")).toBe("skipped");
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it("does not increment attempts again for an event the sweep already claimed", async () => {
    const event = store.addEvent({ attempts: 2, payload: { from: "sweep" } });

    await makeUseCase().execute(event.eventId, {
      eventId: event.eventId,
      attempts: 2,
      payload: event.payload,
    });

    expect(parsePayload).toHaveBeenCalledWith({ from: "sweep" });
    expect(eventState(event.eventId).attempts).toBe(2);
  });
});
