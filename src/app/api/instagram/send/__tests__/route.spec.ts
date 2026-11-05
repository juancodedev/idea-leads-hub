/**
 * @jest-environment node
 *
 * POST /api/instagram/send (S7, S10): sends to a participant through
 * DeliverMessage. 200 { messageId } on sent, 502 { error, hint } on failed.
 */
import { UnauthorizedError } from "@/infrastructure/repositories/errors";
import { InMemoryMessagingStore } from "@/modules/messaging/testing/InMemoryMessagingStore";
import { inMemoryMessagingModule } from "@/modules/messaging/testing/inMemoryMessagingModule";
import { MessageStatus } from "@/modules/messaging/domain/enums/MessageStatus";

jest.mock("@/lib/api/with-auth", () => ({ withAuth: jest.fn() }));

const mockGetToken = jest.fn();
jest.mock("@/infrastructure/services/InstagramAuthService", () => ({
  InstagramAuthService: jest.fn().mockImplementation(() => ({ getToken: mockGetToken })),
}));

let mockMessaging: ReturnType<typeof inMemoryMessagingModule>;
jest.mock("@/modules/messaging", () => ({
  messagingModule: jest.fn(() => mockMessaging),
}));

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { POST } from "../route";

let store: InMemoryMessagingStore;
let send: jest.Mock;

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost:3000/api/instagram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/instagram/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = new InMemoryMessagingStore();
    send = jest.fn().mockResolvedValue({ ok: true, externalId: "mid_1" });
    mockMessaging = inMemoryMessagingModule(store, send);
    (withAuth as jest.Mock).mockResolvedValue({ supabase: {}, user: { id: "user_1" } });
    mockGetToken.mockResolvedValue({
      token: "page-token",
      userToken: "user-token",
      igId: "ig_1",
      pageId: "page_1",
      authType: "facebook",
    });
  });

  it("returns 401 without a session", async () => {
    (withAuth as jest.Mock).mockRejectedValueOnce(new UnauthorizedError("No autorizado"));
    expect((await post({ text: "Hola", recipientId: "999" })).status).toBe(401);
  });

  it("returns 400 when text or recipientId is missing", async () => {
    expect((await post({ recipientId: "999" })).status).toBe(400);
    expect((await post({ text: "Hola" })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends with the page token, stores the sent message and its unlinked legacy activity", async () => {
    const response = await post({ text: "Hola", recipientId: "999" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messageId: "mid_1" });
    expect(send).toHaveBeenCalledWith(
      { userId: "user_1", token: "page-token", authType: "facebook", accountId: "ig_1", recipientId: "999" },
      expect.objectContaining({ body: "Hola", origin: "human" })
    );
    expect(store.conversations).toEqual([
      expect.objectContaining({ externalId: "999", leadId: null }),
    ]);
    expect(store.activities).toEqual([
      expect.objectContaining({ title: "Instagram DM to 999", leadId: null, description: "Hola" }),
    ]);
  });

  it("sends with the Instagram user token for instagram_business_login", async () => {
    mockGetToken.mockResolvedValue({
      token: "page-token",
      userToken: "ig-user-token",
      igId: "ig_1",
      pageId: "",
      authType: "instagram_business_login",
    });

    await post({ text: "Hola", recipientId: "999" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ token: "ig-user-token", authType: "instagram_business_login" }),
      expect.anything()
    );
  });

  it("returns 502 with error and hint on an expired token, and the failed message is visible in the conversation", async () => {
    send.mockResolvedValue({
      ok: false,
      error: "Error validating access token",
      hint: "Token vencido: reconectá Instagram",
    });

    const response = await post({ text: "Hola", recipientId: "999" });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Error validating access token",
      hint: "Token vencido: reconectá Instagram",
    });
    const thread = await mockMessaging.getInboxMessages.execute("user_1", {
      kind: "unlinked",
      participantId: "999",
    });
    expect(thread).toEqual([expect.objectContaining({ status: MessageStatus.FAILED })]);
  });
});
