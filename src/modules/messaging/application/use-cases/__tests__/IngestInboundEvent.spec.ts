/**
 * @jest-environment node
 *
 * IngestInboundEvent (S5 inbound ingest, S6 echo handling, S8 legacy activity).
 */
import { IngestInboundEvent } from "../IngestInboundEvent";
import { InboundEvent } from "../../../domain/events/InboundEvent";
import { MessageDirection } from "../../../domain/enums/MessageDirection";
import { MessageOrigin } from "../../../domain/enums/MessageOrigin";
import { MessageStatus } from "../../../domain/enums/MessageStatus";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

const SECOND = 1000;

describe("IngestInboundEvent", () => {
  let store: InMemoryMessagingStore;
  let useCase: IngestInboundEvent;
  let mid = 0;

  const makeEvent = (overrides: Partial<InboundEvent> = {}): InboundEvent => ({
    kind: "message",
    accountId: "ig_123",
    participantId: "123",
    mid: `m_${++mid}`,
    text: "Hola",
    timestamp: store.now,
    rawPayload: { entry: [] },
    ...overrides,
  });

  const conversationOf = (igsid = "123") =>
    store.conversations.find((c) => c.externalId === igsid)!;

  beforeEach(() => {
    store = new InMemoryMessagingStore();
    store.addAccount({ userId: "user_1", externalAccountId: "ig_123" });
    useCase = new IngestInboundEvent({
      channelAccountRepository: store.channelAccountRepository(),
      conversationRepository: store.conversationRepository(),
      leadLookup: store.leadLookup(),
      execIngestInbound: store.ingestInbound,
      execRecordEcho: store.recordEcho,
    });
  });

  describe("inbound messages", () => {
    it("creates the conversation, the message and its legacy activity for a new participant", async () => {
      const event = makeEvent();

      const result = await useCase.execute(event);

      expect(result).toMatchObject({ kind: "processed", outcome: "inserted" });
      expect(store.conversations).toHaveLength(1);
      expect(conversationOf()).toMatchObject({
        userId: "user_1",
        unreadCount: 1,
        lastInboundAt: event.timestamp,
        lastMessagePreview: "Hola",
      });
      expect(store.messages).toHaveLength(1);
      expect(store.messages[0]).toMatchObject({
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        externalId: event.mid,
        body: "Hola",
      });
      expect(store.legacyFor(store.messages[0].id)).toEqual([
        expect.objectContaining({ title: "Instagram DM from 123", description: "Hola" }),
      ]);
    });

    it("ignores the same mid delivered twice without touching counters or the timeline", async () => {
      const event = makeEvent();

      await useCase.execute(event);
      const second = await useCase.execute(event);

      expect(second).toEqual({ kind: "ignored", reason: "duplicate-mid" });
      expect(store.messages).toHaveLength(1);
      expect(store.activities).toHaveLength(1);
      expect(conversationOf().unreadCount).toBe(1);
    });

    it("stores a concurrent duplicate mid exactly once", async () => {
      const event = makeEvent();

      const results = await Promise.all([useCase.execute(event), useCase.execute(event)]);

      expect(results.filter((r) => r.kind === "processed")).toHaveLength(1);
      expect(results.filter((r) => r.kind === "ignored")).toHaveLength(1);
      expect(store.messages).toHaveLength(1);
      expect(store.activities).toHaveLength(1);
    });

    it("creates a single conversation when two first messages arrive at once", async () => {
      const results = await Promise.all([
        useCase.execute(makeEvent()),
        useCase.execute(makeEvent()),
      ]);

      expect(results.every((r) => r.kind === "processed")).toBe(true);
      expect(store.conversations).toHaveLength(1);
      expect(store.messages).toHaveLength(2);
      expect(conversationOf().unreadCount).toBe(2);
    });

    it("ignores events for an unknown channel account and stores nothing", async () => {
      const result = await useCase.execute(makeEvent({ accountId: "unknown_ig" }));

      expect(result).toEqual({ kind: "ignored", reason: "unknown-account" });
      expect(store.conversations).toHaveLength(0);
      expect(store.messages).toHaveLength(0);
      expect(store.activities).toHaveLength(0);
    });

    it("resolves the account by its page id as well", async () => {
      store.accounts[0].pageId = "page_9";

      const result = await useCase.execute(makeEvent({ accountId: "page_9" }));

      expect(result.kind).toBe("processed");
    });

    it("links the conversation to the owner's lead with the same instagram scoped id", async () => {
      store.leadsByScopedId.set("user_1:123", "lead_42");

      await useCase.execute(makeEvent());

      expect(conversationOf().leadId).toBe("lead_42");
      expect(store.activities[0].leadId).toBe("lead_42");
    });

    it("does not link a lead that belongs to another user", async () => {
      store.leadsByScopedId.set("user_2:123", "lead_other");

      await useCase.execute(makeEvent());

      expect(conversationOf().leadId).toBeNull();
    });

    it.each([
      ["image", "[imagen]"],
      ["audio", "[audio]"],
      ["video", "[video]"],
      ["file", "[archivo]"],
    ] as const)(
      "stores a %s attachment without text with a placeholder body, its type and raw payload",
      async (attachmentType, placeholder) => {
        const event = makeEvent({ text: "", attachmentType });

        await useCase.execute(event);

        expect(store.messages[0]).toMatchObject({
          body: placeholder,
          type: attachmentType,
          rawPayload: event.rawPayload,
        });
      }
    );
  });

  describe("echoes", () => {
    const echo = (overrides: Partial<InboundEvent> = {}) =>
      makeEvent({ kind: "echo", ...overrides });

    let conversationId: string;

    beforeEach(async () => {
      conversationId = store.addConversation({
        accountId: store.accounts[0].id,
        externalId: "123",
        unreadCount: 2,
        lastInboundAt: new Date("2026-11-04T11:00:00Z"),
      }).id;
    });

    const pendingCrmRow = (secondsBeforeEcho: number, overrides = {}) =>
      store.addMessage({
        conversationId,
        body: "Hola",
        createdAt: new Date(store.now.getTime() - secondsBeforeEcho * SECOND),
        ...overrides,
      });

    it("adopts the CRM's pending row instead of creating a second one", async () => {
      const row = pendingCrmRow(30);

      const result = await useCase.execute(echo({ mid: "m_9" }));

      expect(result).toMatchObject({ kind: "processed", outcome: "adopted", messageId: row.id });
      expect(store.messages).toHaveLength(1);
      expect(row).toMatchObject({ externalId: "m_9", status: MessageStatus.SENT });
      expect(store.legacyFor(row.id)).toHaveLength(1);
    });

    it("adopts a row that timed out as failed, clearing its error and hint", async () => {
      const row = pendingCrmRow(20, {
        status: MessageStatus.FAILED,
        errorMessage: "timeout",
        hint: "No se pudo contactar a Instagram",
      });

      await useCase.execute(echo({ mid: "m_9" }));

      expect(row).toMatchObject({
        status: MessageStatus.SENT,
        externalId: "m_9",
        errorMessage: null,
        hint: null,
      });
      expect(store.legacyFor(row.id)).toHaveLength(1);
    });

    it("measures the adoption window from the echo timestamp, not the processing time", async () => {
      const row = pendingCrmRow(30);
      const echoTimestamp = store.now;
      store.now = new Date(store.now.getTime() + 4 * 60 * SECOND); // sweep retry 4 min later

      await useCase.execute(echo({ mid: "m_9", timestamp: echoTimestamp }));

      expect(store.messages).toHaveLength(1);
      expect(row.externalId).toBe("m_9");
    });

    it("inserts a new outbound row when the pending row is older than 2 minutes", async () => {
      pendingCrmRow(3 * 60);

      const result = await useCase.execute(echo({ mid: "m_9" }));

      expect(result).toMatchObject({ outcome: "inserted" });
      expect(store.messages).toHaveLength(2);
    });

    it("inserts a new outbound row when the body differs", async () => {
      pendingCrmRow(30, { body: "Otro texto" });

      await useCase.execute(echo({ mid: "m_9" }));

      expect(store.messages).toHaveLength(2);
    });

    it("stores a message sent from the native app as outbound, with its legacy activity", async () => {
      const result = await useCase.execute(echo({ mid: "m_native", text: "Desde la app" }));

      expect(result).toMatchObject({ kind: "processed", outcome: "inserted" });
      const stored = store.messages.find((m) => m.externalId === "m_native")!;
      expect(stored).toMatchObject({
        direction: MessageDirection.OUTBOUND,
        origin: MessageOrigin.HUMAN,
        status: MessageStatus.SENT,
        body: "Desde la app",
      });
      expect(store.legacyFor(stored.id)).toEqual([
        expect.objectContaining({ title: "Instagram DM to 123" }),
      ]);
    });

    it("ignores an echo whose mid is already stored", async () => {
      store.addMessage({ conversationId, externalId: "m_9", status: MessageStatus.SENT });

      const result = await useCase.execute(echo({ mid: "m_9" }));

      expect(result).toEqual({ kind: "ignored", reason: "duplicate-mid" });
      expect(store.messages).toHaveLength(1);
      expect(store.activities).toHaveLength(0);
    });

    it("ignores an echo without mid", async () => {
      const result = await useCase.execute(echo({ mid: undefined }));

      expect(result).toEqual({ kind: "ignored", reason: "echo-without-mid" });
      expect(store.messages).toHaveLength(0);
    });

    it("never changes unread_count or last_inbound_at", async () => {
      const before = { ...store.conversations[0] };

      await useCase.execute(echo({ mid: "m_9" }));

      expect(store.conversations[0].unreadCount).toBe(before.unreadCount);
      expect(store.conversations[0].lastInboundAt).toEqual(before.lastInboundAt);
    });
  });
});
