/**
 * @jest-environment node
 *
 * GET /api/instagram/conversations (S10): the inbox from `conversations`,
 * one entry per key, with the pre-pipeline response fields.
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
import { GET } from "../route";

let store: InMemoryMessagingStore;
const at = (iso: string) => new Date(iso);

const list = () => GET(new NextRequest("http://localhost:3000/api/instagram/conversations"));

beforeEach(() => {
  jest.clearAllMocks();
  store = new InMemoryMessagingStore();
  mockMessaging = inMemoryMessagingModule(store);
  (withAuth as jest.Mock).mockResolvedValue({ supabase: {}, user: { id: "user_1" } });
});

describe("GET /api/instagram/conversations", () => {
  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await list()).status).toBe(401);
  });

  it("returns one entry per key with the previous field names, newest first", async () => {
    const lead = store.addLead({ name: "Ana", instagramHandle: "ana", instagramScopedId: "111" });
    const c1 = store.addConversation({
      leadId: lead.id,
      accountId: "acc_a",
      externalId: "111",
      unreadCount: 1,
      lastMessageAt: at("2026-11-04T09:00:00Z"),
      lastInboundAt: at("2026-11-04T09:00:00Z"),
      lastMessagePreview: "old",
    });
    const c2 = store.addConversation({
      leadId: lead.id,
      accountId: "acc_b",
      externalId: "111",
      unreadCount: 2,
      lastMessageAt: at("2026-11-04T10:00:00Z"),
      lastInboundAt: at("2026-11-04T08:00:00Z"),
      lastMessagePreview: "we answered",
    });
    store.addConversation({
      externalId: "222",
      lastMessageAt: at("2026-11-04T12:00:00Z"),
      lastInboundAt: at("2026-11-04T12:00:00Z"),
      lastMessagePreview: "new lead?",
    });
    store.addConversation({ userId: "user_2", externalId: "999" });

    const res = await list();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.conversations).toEqual([
      {
        id: "unlinked:222",
        conversationIds: [expect.any(String)],
        leadId: null,
        leadName: "Instagram: 222",
        instagramHandle: null,
        instagramScopedId: "222",
        lastMessage: { text: "new lead?", timestamp: "2026-11-04T12:00:00.000Z", direction: "inbound" },
        unreadCount: 0,
        isConnected: true,
        isLinked: false,
      },
      {
        id: `lead:${lead.id}`,
        conversationIds: [c2.id, c1.id],
        leadId: lead.id,
        leadName: "Ana",
        instagramHandle: "ana",
        instagramScopedId: "111",
        lastMessage: { text: "we answered", timestamp: "2026-11-04T10:00:00.000Z", direction: "outbound" },
        unreadCount: 3,
        isConnected: true,
        isLinked: true,
      },
    ]);
  });

  it("returns 500 with the previous message on error", async () => {
    jest.spyOn(mockMessaging.listInbox, "execute").mockRejectedValue(new Error("db"));

    const res = await list();

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Error al cargar las conversaciones");
  });
});
