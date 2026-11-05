/**
 * @jest-environment node
 *
 * GET /api/activities/unread (S12): same path and `{ count }`, now the sum of
 * `conversations.unread_count` over the user's conversations.
 */
import { UnauthorizedError } from "@/infrastructure/repositories/errors";
import { InMemoryMessagingStore } from "@/modules/messaging/testing/InMemoryMessagingStore";
import { inMemoryMessagingModule } from "@/modules/messaging/testing/inMemoryMessagingModule";

jest.mock("@/lib/api/with-auth", () => ({ withAuth: jest.fn() }));

let mockMessaging: ReturnType<typeof inMemoryMessagingModule>;
jest.mock("@/modules/messaging", () => ({
  messagingModule: jest.fn(() => mockMessaging),
}));

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { GET } from "../unread/route";

let store: InMemoryMessagingStore;

const getUnread = () =>
  GET(new NextRequest("http://localhost:3000/api/activities/unread", { method: "GET" }));

describe("GET /api/activities/unread", () => {
  beforeEach(() => {
    store = new InMemoryMessagingStore();
    mockMessaging = inMemoryMessagingModule(store);
    (withAuth as jest.Mock).mockResolvedValue({
      supabase: {},
      user: { id: "user_1", email: "test@example.com" },
    });
  });

  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await getUnread()).status).toBe(401);
  });

  it("returns the sum of unread_count over the user's conversations (badge = 3)", async () => {
    store.addConversation({ unreadCount: 2 });
    store.addConversation({ unreadCount: 1, accountId: "acc_b" });
    store.addConversation({ userId: "user_2", unreadCount: 7 });

    const response = await getUnread();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 3 });
  });

  it("should return 0 when no unread messages", async () => {
    const response = await getUnread();

    expect(response.status).toBe(200);
    expect((await response.json()).count).toBe(0);
  });
});
