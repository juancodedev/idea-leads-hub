/**
 * @jest-environment node
 *
 * MarkConversationRead (S10 PATCH /api/messages/read, S12 read state).
 */
import { MarkConversationRead } from "../MarkConversationRead";
import { MessageDirection } from "../../../domain/enums/MessageDirection";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

describe("MarkConversationRead", () => {
  let store: InMemoryMessagingStore;
  let setRead: jest.Mock;

  const makeUseCase = () => new MarkConversationRead({ execSetConversationsRead: setRead });

  const inboundWithLegacy = async (conversationId: string, mid: string) => {
    await store.ingestInbound({
      conversationId,
      externalId: mid,
      type: "text",
      body: "Hola",
      rawPayload: {},
      at: store.now,
      legacy: { title: "Instagram DM from 123" },
    });
  };

  beforeEach(() => {
    store = new InMemoryMessagingStore();
    setRead = jest.fn(store.setConversationsRead);
  });

  it("zeroes the unread count of every conversation in the set and marks their inbound legacy activities read", async () => {
    const a = store.addConversation({ externalId: "1" });
    const b = store.addConversation({ externalId: "2" });
    const other = store.addConversation({ externalId: "3" });
    await inboundWithLegacy(a.id, "m_a");
    await inboundWithLegacy(b.id, "m_b1");
    await inboundWithLegacy(b.id, "m_b2");
    await inboundWithLegacy(other.id, "m_other");

    await makeUseCase().execute([a.id, b.id]);

    expect([a.unreadCount, b.unreadCount, other.unreadCount]).toEqual([0, 0, 1]);
    const readByConversation = (id: string) =>
      store.messages
        .filter((m) => m.conversationId === id && m.direction === MessageDirection.INBOUND)
        .flatMap((m) => store.legacyFor(m.id))
        .map((activity) => activity.readAt !== null);
    expect(readByConversation(a.id)).toEqual([true]);
    expect(readByConversation(b.id)).toEqual([true, true]);
    expect(readByConversation(other.id)).toEqual([false]);
  });

  it("calls the SQL function once with each conversation only once", async () => {
    await makeUseCase().execute(["c1", "c2", "c1"]);

    expect(setRead).toHaveBeenCalledTimes(1);
    expect(setRead).toHaveBeenCalledWith(["c1", "c2"]);
  });

  it("does nothing for an empty set", async () => {
    await makeUseCase().execute([]);

    expect(setRead).not.toHaveBeenCalled();
  });
});
