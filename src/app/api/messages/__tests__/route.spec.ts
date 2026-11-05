/**
 * @jest-environment node
 *
 * /api/messages on the messaging model (S10, ADR-11): a key resolves to a
 * set of conversations; GET, DELETE and PATCH (link) act on the whole set
 * and keep the pre-pipeline response contract.
 */
import { UnauthorizedError } from "@/infrastructure/repositories/errors";
import { InMemoryMessagingStore } from "@/modules/messaging/testing/InMemoryMessagingStore";
import { inMemoryMessagingModule } from "@/modules/messaging/testing/inMemoryMessagingModule";
import { MessageDirection } from "@/modules/messaging/domain/enums/MessageDirection";
import { MessageStatus } from "@/modules/messaging/domain/enums/MessageStatus";

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn(),
}));

let mockMessaging: ReturnType<typeof inMemoryMessagingModule>;
jest.mock("@/modules/messaging", () => ({
  messagingModule: jest.fn(() => mockMessaging),
}));

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { messagingModule } from "@/modules/messaging";
import { GET, DELETE, PATCH } from "../route";

const userSupabase = { tag: "user-client" };
let store: InMemoryMessagingStore;

beforeEach(() => {
  jest.clearAllMocks();
  store = new InMemoryMessagingStore();
  mockMessaging = inMemoryMessagingModule(store);
  (withAuth as jest.Mock).mockResolvedValue({
    supabase: userSupabase,
    user: { id: "user_1", email: "test@example.com" },
  });
});

const at = (iso: string) => new Date(iso);

const get = (key?: string) =>
  GET(
    new NextRequest(
      `http://localhost:3000/api/messages${key ? `?key=${encodeURIComponent(key)}` : ""}`
    )
  );

const del = (key?: string) =>
  DELETE(
    new NextRequest(
      `http://localhost:3000/api/messages${key ? `?key=${encodeURIComponent(key)}` : ""}`,
      { method: "DELETE" }
    )
  );

const link = (body: unknown) =>
  PATCH(
    new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("GET /api/messages", () => {
  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await get("lead:lead_1")).status).toBe(401);
  });

  it("returns 400 when key param is missing", async () => {
    const res = await get();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("key query param");
  });

  it("returns 400 for invalid key format", async () => {
    const res = await get("invalid:123");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid key format");
  });

  it("merges the messages of every conversation of a lead key, oldest first, keeping the response fields", async () => {
    const lead = store.addLead();
    const c1 = store.addConversation({ leadId: lead.id, accountId: "acc_a", externalId: "111" });
    const c2 = store.addConversation({ leadId: lead.id, accountId: "acc_b", externalId: "111" });
    store.addMessage({
      conversationId: c2.id,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.FAILED,
      body: "reply",
      errorMessage: "Invalid OAuth access token",
      hint: "Token vencido: reconectá Instagram",
      createdAt: at("2026-11-04T11:00:00Z"),
    });
    const first = store.addMessage({
      conversationId: c1.id,
      direction: MessageDirection.INBOUND,
      status: MessageStatus.RECEIVED,
      body: "Hola",
      createdAt: at("2026-11-04T10:00:00Z"),
    });

    const res = await get(`lead:${lead.id}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(messagingModule).toHaveBeenCalledWith(userSupabase);
    expect(body).toEqual([
      {
        id: first.id,
        text: "Hola",
        direction: "inbound",
        timestamp: "2026-11-04T10:00:00.000Z",
        status: "received",
        errorMessage: null,
        hint: null,
      },
      expect.objectContaining({
        text: "reply",
        direction: "outbound",
        timestamp: "2026-11-04T11:00:00.000Z",
        status: "failed",
        errorMessage: "Invalid OAuth access token",
        hint: "Token vencido: reconectá Instagram",
      }),
    ]);
  });

  it("returns the messages of an unlinked key", async () => {
    const c = store.addConversation({ externalId: "222" });
    store.addMessage({ conversationId: c.id, direction: MessageDirection.INBOUND, body: "hey" });

    const body = await (await get("unlinked:222")).json();

    expect(body.map((m: { text: string }) => m.text)).toEqual(["hey"]);
  });

  it("returns an empty array for another user's key", async () => {
    const foreign = store.addConversation({ userId: "user_2", externalId: "333" });
    store.addMessage({ userId: "user_2", conversationId: foreign.id });

    const res = await get("unlinked:333");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    jest.spyOn(mockMessaging.getInboxMessages, "execute").mockRejectedValue(new Error("db"));

    const res = await get("lead:lead_1");

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Error al cargar los mensajes");
  });
});

describe("DELETE /api/messages", () => {
  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await del("lead:lead_1")).status).toBe(401);
  });

  it("returns 400 when key param is missing", async () => {
    expect((await del()).status).toBe(400);
  });

  it("returns 400 for invalid key", async () => {
    expect((await del("bad")).status).toBe(400);
  });

  it("deletes every conversation of a lead key, their messages and the lead's legacy activities", async () => {
    const lead = store.addLead();
    const c1 = store.addConversation({ leadId: lead.id, accountId: "acc_a" });
    const c2 = store.addConversation({ leadId: lead.id, accountId: "acc_b" });
    store.addMessage({ conversationId: c1.id });
    store.addMessage({ conversationId: c2.id });
    store.addLegacyActivity({ leadId: lead.id });
    const other = store.addConversation({ externalId: "999" });

    const res = await del(`lead:${lead.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(store.conversations.map((c) => c.id)).toEqual([other.id]);
    expect(store.messages).toEqual([]);
    expect(store.activities).toEqual([]);
  });

  it("deletes an unlinked conversation and its legacy activities", async () => {
    store.addConversation({ externalId: "444" });
    store.addLegacyActivity({ title: "Instagram DM to 444" });

    const res = await del("unlinked:444");

    expect(res.status).toBe(200);
    expect(store.conversations).toEqual([]);
    expect(store.activities).toEqual([]);
  });

  it("does not delete another user's conversation", async () => {
    store.addConversation({ userId: "user_2", externalId: "555" });

    const res = await del("unlinked:555");

    expect(res.status).toBe(200);
    expect(store.conversations).toHaveLength(1);
  });

  it("returns 500 on db error", async () => {
    jest.spyOn(mockMessaging.deleteInboxConversations, "execute").mockRejectedValue(new Error("db"));

    const res = await del("lead:lead_1");

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Error al eliminar la conversación");
  });
});

describe("PATCH /api/messages (link to lead)", () => {
  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await link({ key: "unlinked:1", leadId: "lead_1" })).status).toBe(401);
  });

  it("returns 400 when missing params", async () => {
    const res = await link({ key: "unlinked:1" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("key and leadId are required");
  });

  it("returns 400 for invalid key", async () => {
    expect((await link({ key: "bad:1", leadId: "lead_1" })).status).toBe(400);
  });

  it("returns alreadyLinked for lead: key", async () => {
    const res = await link({ key: "lead:lead_1", leadId: "lead_1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, alreadyLinked: true });
  });

  it("returns 404 when the lead is not the user's", async () => {
    const foreignLead = store.addLead({ userId: "user_2" });
    store.addConversation({ externalId: "666" });

    const res = await link({ key: "unlinked:666", leadId: foreignLead.id });

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Lead no encontrado");
    expect(store.conversations[0].leadId).toBeNull();
  });

  it("links every unlinked conversation of the participant and their legacy activities", async () => {
    const lead = store.addLead();
    store.addConversation({ externalId: "777", accountId: "acc_a" });
    store.addConversation({ externalId: "777", accountId: "acc_b" });
    store.addLegacyActivity({ title: "Instagram DM from 777" });

    const res = await link({ key: "unlinked:777", leadId: lead.id });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, alreadyLinked: false });
    expect(store.conversations.map((c) => c.leadId)).toEqual([lead.id, lead.id]);
    expect(store.activities[0].leadId).toBe(lead.id);
  });

  it("returns 500 on update error", async () => {
    jest.spyOn(mockMessaging.linkInboxConversations, "execute").mockRejectedValue(new Error("db"));

    const res = await link({ key: "unlinked:888", leadId: "lead_1" });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Error al vincular la conversación");
  });
});
