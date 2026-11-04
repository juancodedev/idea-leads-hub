/**
 * @jest-environment node
 *
 * SweepWebhookEvents (S4 retry sweep: batch size, atomic claim, retention).
 */
import { SweepWebhookEvents } from "../SweepWebhookEvents";
import { ProcessWebhookEvent } from "../ProcessWebhookEvent";
import { IngestResult } from "../IngestInboundEvent";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

describe("SweepWebhookEvents", () => {
  let store: InMemoryMessagingStore;
  let ingestEvent: jest.Mock<Promise<IngestResult>>;

  const minutesAgo = (minutes: number) => new Date(store.now.getTime() - minutes * MINUTE);

  const makeUseCase = () => {
    const webhookEventRepository = store.webhookEventRepository();
    const process = new ProcessWebhookEvent({
      webhookEventRepository,
      parsePayload: (payload) => [payload as never],
      ingestEvent,
    });
    return new SweepWebhookEvents({
      webhookEventRepository,
      processEvent: (claimed) => process.execute(claimed.eventId, claimed),
    });
  };

  beforeEach(() => {
    store = new InMemoryMessagingStore();
    ingestEvent = jest.fn().mockResolvedValue({
      kind: "processed",
      conversationId: "c",
      messageId: "m",
      outcome: "inserted",
    });
  });

  it("processes a stuck event and increments its attempts exactly once", async () => {
    const event = store.addEvent({ attempts: 1, receivedAt: minutesAgo(5) });

    const summary = await makeUseCase().execute();

    expect(summary).toMatchObject({ claimed: 1, processed: 1 });
    expect(event).toMatchObject({ status: "processed", attempts: 2 });
  });

  it("claims at most 5 events per run, oldest first", async () => {
    const events = [10, 9, 8, 7, 6, 5, 4].map((m) =>
      store.addEvent({ receivedAt: minutesAgo(m) })
    );

    const summary = await makeUseCase().execute();

    expect(summary.claimed).toBe(5);
    expect(events.slice(0, 5).every((e) => e.status === "processed")).toBe(true);
    expect(events.slice(5).every((e) => e.status === "received")).toBe(true);
  });

  it("does not pick events younger than 2 minutes", async () => {
    const event = store.addEvent({ receivedAt: minutesAgo(1) });

    expect((await makeUseCase().execute()).claimed).toBe(0);
    expect(event).toMatchObject({ status: "received", attempts: 0 });
  });

  it("does not pick events that already used 3 attempts or are not received", async () => {
    store.addEvent({ attempts: 3, receivedAt: minutesAgo(10) });
    store.addEvent({ status: "failed", receivedAt: minutesAgo(10) });
    store.addEvent({ status: "processed", receivedAt: minutesAgo(10) });

    expect((await makeUseCase().execute()).claimed).toBe(0);
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it("marks an event failed when its last retry errors, and stops picking it", async () => {
    const event = store.addEvent({ attempts: 2, receivedAt: minutesAgo(10) });
    ingestEvent.mockRejectedValue(new Error("db down"));

    expect(await makeUseCase().execute()).toMatchObject({ claimed: 1, failed: 1 });
    expect(event).toMatchObject({ status: "failed", attempts: 3 });
    expect((await makeUseCase().execute()).claimed).toBe(0);
  });

  it("reports a retryable failure as retrying and leaves the event received", async () => {
    const event = store.addEvent({ attempts: 0, receivedAt: minutesAgo(10) });
    ingestEvent.mockRejectedValue(new Error("db down"));

    expect(await makeUseCase().execute()).toMatchObject({ claimed: 1, retrying: 1 });
    expect(event).toMatchObject({ status: "received", attempts: 1 });
  });

  it("never processes the same event in two overlapping runs", async () => {
    const event = store.addEvent({ attempts: 0, receivedAt: minutesAgo(5) });

    const [first, second] = await Promise.all([
      makeUseCase().execute(),
      makeUseCase().execute(),
    ]);

    expect(first.claimed + second.claimed).toBe(1);
    expect(ingestEvent).toHaveBeenCalledTimes(1);
    expect(event.attempts).toBe(1);
  });

  it("does not pick an old event whose current attempt started less than 2 minutes ago", async () => {
    const event = store.addEvent({
      attempts: 1,
      receivedAt: minutesAgo(10),
      lastAttemptAt: minutesAgo(1),
    });

    expect((await makeUseCase().execute()).claimed).toBe(0);
    expect(event.attempts).toBe(1);
  });

  it("deletes handled events older than 30 days and keeps the rest", async () => {
    const oldProcessed = store.addEvent({
      status: "processed",
      receivedAt: new Date(store.now.getTime() - 31 * DAY),
    });
    const oldIgnored = store.addEvent({
      status: "ignored",
      receivedAt: new Date(store.now.getTime() - 31 * DAY),
    });
    const oldFailed = store.addEvent({
      status: "failed",
      receivedAt: new Date(store.now.getTime() - 31 * DAY),
    });
    const recentProcessed = store.addEvent({
      status: "processed",
      receivedAt: new Date(store.now.getTime() - 29 * DAY),
    });

    await makeUseCase().execute();

    const ids = store.events.map((e) => e.eventId);
    expect(ids).not.toContain(oldProcessed.eventId);
    expect(ids).not.toContain(oldIgnored.eventId);
    expect(ids).toEqual(expect.arrayContaining([oldFailed.eventId, recentProcessed.eventId]));
  });
});
