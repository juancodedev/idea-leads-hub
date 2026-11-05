/**
 * @jest-environment node
 *
 * POST /api/leads/[id]/instagram/send (S7, S10): recipient resolution kept
 * unchanged; the send goes through DeliverMessage on the lead's conversation
 * (created when missing). 200 { messageId } on sent, 502 { error, hint } on failed.
 */
import { UnauthorizedError } from "@/infrastructure/repositories/errors";
import { InMemoryMessagingStore } from "@/modules/messaging/testing/InMemoryMessagingStore";
import { inMemoryMessagingModule } from "@/modules/messaging/testing/inMemoryMessagingModule";
import { MessageStatus } from "@/modules/messaging/domain/enums/MessageStatus";

process.env.META_APP_SECRET = "test_app_secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

jest.mock("@/lib/api/with-auth", () => ({ withAuth: jest.fn() }));

const mockGetById = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getById: mockGetById,
    update: mockUpdate,
  })),
}));

const mockGetToken = jest.fn();

jest.mock("@/infrastructure/services/InstagramAuthService", () => ({
  InstagramAuthService: jest.fn().mockImplementation(() => ({
    getToken: mockGetToken,
  })),
}));

const mockResolveHandle = jest.fn();

jest.mock("@/infrastructure/services/InstagramMessagingService", () => ({
  InstagramMessagingService: jest.fn().mockImplementation(() => ({
    resolveHandleToUserId: mockResolveHandle,
  })),
}));

let mockMessaging: ReturnType<typeof inMemoryMessagingModule>;
jest.mock("@/modules/messaging", () => ({
  messagingModule: jest.fn(() => mockMessaging),
}));

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { POST } from "../route";

const baseLead = {
  id: "lead-1",
  name: "Test Lead",
  company: "Test Corp",
  email: "test@corp.com",
  status: "Nuevo",
  userId: "user_1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  tags: [],
};

const pageToken = {
  token: "page-access-token-abc",
  userToken: "user-token-def",
  igId: "ig-account-456",
  pageId: "page-111",
  authType: "facebook",
};

let store: InMemoryMessagingStore;
let send: jest.Mock;

const post = (body: unknown, id = "lead-1") =>
  POST(
    new NextRequest(`http://localhost:3000/api/leads/${id}/instagram/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

describe("POST /api/leads/[id]/instagram/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = new InMemoryMessagingStore();
    send = jest.fn().mockResolvedValue({ ok: true, externalId: "msg-outbound-001" });
    mockMessaging = inMemoryMessagingModule(store, send);
    (withAuth as jest.Mock).mockResolvedValue({
      supabase: {},
      user: { id: "user_1", email: "test@example.com" },
    });
    mockGetToken.mockResolvedValue(pageToken);
  });

  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await post({ text: "Hola" })).status).toBe(401);
  });

  it("should send DM using instagramScopedId through DeliverMessage and keep the legacy activity", async () => {
    mockGetById.mockResolvedValue({ ...baseLead, instagramScopedId: "ig-scoped-789" });

    const response = await post({ text: "Hello, interested in our product?" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ messageId: "msg-outbound-001" });
    expect(send).toHaveBeenCalledWith(
      {
        userId: "user_1",
        token: "page-access-token-abc",
        authType: "facebook",
        accountId: "ig-account-456",
        recipientId: "ig-scoped-789",
      },
      expect.objectContaining({ body: "Hello, interested in our product?", origin: "human" })
    );
    expect(store.conversations).toEqual([
      expect.objectContaining({ leadId: "lead-1", externalId: "ig-scoped-789" }),
    ]);
    expect(store.messages).toEqual([
      expect.objectContaining({ status: MessageStatus.SENT, externalId: "msg-outbound-001" }),
    ]);
    expect(store.activities).toEqual([
      expect.objectContaining({
        leadId: "lead-1",
        title: "Instagram DM to ig-scoped-789",
        description: "Hello, interested in our product?",
      }),
    ]);
  });

  it("should fallback to instagramHandle when no scopedId", async () => {
    mockGetById.mockResolvedValue({ ...baseLead, instagramHandle: "@test_user" });
    mockResolveHandle.mockResolvedValue("1789");

    const response = await post({ text: "Hi there!" });

    expect(response.status).toBe(200);
    expect(mockResolveHandle).toHaveBeenCalledWith("@test_user", "ig-account-456", "user-token-def");
    expect(mockUpdate).toHaveBeenCalledWith({ id: "lead-1", instagramScopedId: "1789" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "1789" }),
      expect.anything()
    );
  });

  it("returns 400 with needsManualId when the handle cannot be resolved", async () => {
    mockGetById.mockResolvedValue({ ...baseLead, instagramHandle: "@ghost" });
    mockResolveHandle.mockRejectedValue(new Error("User not found"));

    const response = await post({ text: "Hi" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: "User not found", needsManualId: true });
    expect(body.tip).toEqual(expect.any(String));
    expect(send).not.toHaveBeenCalled();
  });

  it("should return 400 when text is missing", async () => {
    expect((await post({})).status).toBe(400);
  });

  it("should return 400 when lead has no instagram identifier", async () => {
    mockGetById.mockResolvedValue({ ...baseLead });

    const response = await post({ text: "Hello!" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Lead has no Instagram identifier" });
  });

  it("sends with the Instagram user token when authType is instagram_business_login", async () => {
    mockGetById.mockResolvedValue({ ...baseLead, instagramScopedId: "ig-scoped-789" });
    mockGetToken.mockResolvedValue({
      ...pageToken,
      userToken: "ig-user-token-xyz",
      authType: "instagram_business_login",
    });

    const response = await post({ text: "Hello via IG Business Login!" });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "ig-user-token-xyz",
        authType: "instagram_business_login",
        accountId: "ig-account-456",
        recipientId: "ig-scoped-789",
      }),
      expect.anything()
    );
  });

  it("should return 400 with needsManualId when Instagram Business Login and no scopedId", async () => {
    mockGetById.mockResolvedValue({ ...baseLead, instagramHandle: "@test_user" });
    mockGetToken.mockResolvedValue({ ...pageToken, authType: "instagram_business_login" });

    const response = await post({ text: "Hello!" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.needsManualId).toBe(true);
    expect(mockResolveHandle).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("should return 404 when lead not found (or another user's lead)", async () => {
    mockGetById.mockResolvedValue(null);

    const response = await post({ text: "Hello!" }, "non-existent");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Lead not found" });
  });

  it("returns 502 with error and hint when Graph rejects the send, and the failed message stays visible", async () => {
    mockGetById.mockResolvedValue({ ...baseLead, instagramScopedId: "ig-scoped-789" });
    send.mockResolvedValue({
      ok: false,
      error: "Error validating access token",
      hint: "Token vencido: reconectá Instagram",
    });

    const response = await post({ text: "Hola" });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Error validating access token",
      hint: "Token vencido: reconectá Instagram",
    });
    const thread = await mockMessaging.getInboxMessages.execute("user_1", {
      kind: "lead",
      leadId: "lead-1",
    });
    expect(thread).toEqual([
      expect.objectContaining({ status: MessageStatus.FAILED, body: "Hola" }),
    ]);
    expect(store.activities).toEqual([]);
  });
});
