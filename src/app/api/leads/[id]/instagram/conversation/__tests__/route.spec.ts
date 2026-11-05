/**
 * @jest-environment node
 *
 * GET /api/leads/[id]/instagram/conversation (S10): messages of every
 * conversation of the lead, oldest first, with the previous field names.
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
import { GET } from "../route";

let store: InMemoryMessagingStore;
const at = (iso: string) => new Date(iso);

const getConversation = (leadId: string) =>
  GET(new NextRequest(`http://localhost:3000/api/leads/${leadId}/instagram/conversation`), {
    params: Promise.resolve({ id: leadId }),
  });

describe("GET /api/leads/[id]/instagram/conversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = new InMemoryMessagingStore();
    mockMessaging = inMemoryMessagingModule(store);
    (withAuth as jest.Mock).mockResolvedValue({ supabase: {}, user: { id: "user_1" } });
  });

  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await getConversation("lead-1")).status).toBe(401);
  });

  it("should return ordered conversation timeline for lead, including messages received after the migration", async () => {
    const backfilled = store.addConversation({ leadId: "lead-1", accountId: "acc_a", externalId: "111" });
    const live = store.addConversation({ leadId: "lead-1", accountId: "acc_b", externalId: "111" });
    const migrated = store.addMessage({
      conversationId: backfilled.id,
      direction: MessageDirection.INBOUND,
      body: "Hola, me interesa",
      createdAt: at("2026-01-01T10:00:00Z"),
    });
    store.addMessage({
      conversationId: live.id,
      direction: MessageDirection.INBOUND,
      body: "after migration",
      createdAt: at("2026-11-05T10:00:00Z"),
    });
    store.addMessage({
      conversationId: backfilled.id,
      direction: MessageDirection.OUTBOUND,
      body: "¡Gracias!",
      createdAt: at("2026-01-01T11:00:00Z"),
    });

    const response = await getConversation("lead-1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.map((m: { text: string }) => m.text)).toEqual([
      "Hola, me interesa",
      "¡Gracias!",
      "after migration",
    ]);
    expect(body[0]).toEqual(
      expect.objectContaining({
        id: migrated.id,
        text: "Hola, me interesa",
        direction: "inbound",
        timestamp: "2026-01-01T10:00:00.000Z",
      })
    );
    expect(body[1].direction).toBe("outbound");
  });

  it("should return empty array when no instagram messages", async () => {
    const response = await getConversation("lead-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("returns an empty array for another user's lead", async () => {
    const foreign = store.addConversation({ userId: "user_2", leadId: "lead-2" });
    store.addMessage({ userId: "user_2", conversationId: foreign.id });

    const response = await getConversation("lead-2");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
