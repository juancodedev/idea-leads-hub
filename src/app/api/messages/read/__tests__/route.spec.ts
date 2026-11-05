/**
 * @jest-environment node
 *
 * PATCH /api/messages/read (S10, S12): marks every conversation of a key read
 * and sets read_at on their unread legacy activities.
 */
import { UnauthorizedError } from "@/infrastructure/repositories/errors";
import { InMemoryMessagingStore } from "@/modules/messaging/testing/InMemoryMessagingStore";
import { inMemoryMessagingModule } from "@/modules/messaging/testing/inMemoryMessagingModule";
import { MessageDirection } from "@/modules/messaging/domain/enums/MessageDirection";

jest.mock("@/lib/api/with-auth", () => ({ withAuth: jest.fn() }));

let mockMessaging: ReturnType<typeof inMemoryMessagingModule>;
jest.mock("@/modules/messaging", () => ({
  messagingModule: jest.fn(() => mockMessaging),
}));

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { PATCH } from "../route";

let store: InMemoryMessagingStore;

beforeEach(() => {
  jest.clearAllMocks();
  store = new InMemoryMessagingStore();
  mockMessaging = inMemoryMessagingModule(store);
  (withAuth as jest.Mock).mockResolvedValue({ supabase: {}, user: { id: "user_1" } });
});

const read = (body: unknown) =>
  PATCH(
    new NextRequest("http://localhost:3000/api/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

/** Conversation with `unread` inbound messages, each with its unread legacy activity. */
const conversationWithUnread = (overrides: Parameters<InMemoryMessagingStore["addConversation"]>[0], unread: number) => {
  const conversation = store.addConversation({ ...overrides, unreadCount: unread });
  for (let i = 0; i < unread; i++) {
    const activity = store.addLegacyActivity({ userId: conversation.userId, leadId: conversation.leadId });
    store.addMessage({
      userId: conversation.userId,
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      legacyActivityId: activity.id,
    });
  }
  return conversation;
};

describe("PATCH /api/messages/read", () => {
  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await read({ key: "lead:lead_1" })).status).toBe(401);
  });

  it("returns 400 when key is missing", async () => {
    const res = await read({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("key is required");
  });

  it("returns 400 for an invalid key", async () => {
    const res = await read({ key: "nope" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid key format");
  });

  it("zeroes unread_count on both conversations of a lead and sets read_at on their legacy activities", async () => {
    const lead = store.addLead();
    conversationWithUnread({ leadId: lead.id, accountId: "acc_a" }, 1);
    conversationWithUnread({ leadId: lead.id, accountId: "acc_b" }, 2);

    const res = await read({ key: `lead:${lead.id}` });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(store.conversations.map((c) => c.unreadCount)).toEqual([0, 0]);
    expect(store.activities).toHaveLength(3);
    expect(store.activities.every((a) => a.readAt !== null)).toBe(true);
  });

  it("marks an unlinked key read", async () => {
    conversationWithUnread({ externalId: "222" }, 2);

    await read({ key: "unlinked:222" });

    expect(store.conversations[0].unreadCount).toBe(0);
  });

  it("does not touch another user's conversation", async () => {
    conversationWithUnread({ userId: "user_2", externalId: "333" }, 2);

    const res = await read({ key: "unlinked:333" });

    expect(res.status).toBe(200);
    expect(store.conversations[0].unreadCount).toBe(2);
    expect(store.activities.every((a) => a.readAt === null)).toBe(true);
  });
});
