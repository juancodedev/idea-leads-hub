/**
 * @jest-environment node
 *
 * POST /api/webhook/instagram acknowledges Meta quickly (S3): verify the
 * signature, claim the event id once, schedule processing in the background
 * and answer 200. GET keeps the verification handshake.
 */

process.env.META_VERIFY_TOKEN = "test_verify_token_123";
process.env.META_APP_SECRET = "test_app_secret";

const mockVerifyMetaSignature = jest.fn();

jest.mock("@/infrastructure/services/InstagramMessagingService", () => ({
  InstagramMessagingService: jest.fn().mockImplementation(() => ({
    verifyMetaSignature: mockVerifyMetaSignature,
  })),
}));

const mockCreateAdminClient = jest.fn(() => ({ admin: true }));
jest.mock("@/infrastructure/database/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockClaim = jest.fn();
const mockProcess = jest.fn();
const mockMessagingModule = jest.fn(() => ({
  webhookEventRepository: { claim: mockClaim },
  processWebhookEvent: { execute: mockProcess },
}));
jest.mock("@/modules/messaging", () => ({
  messagingModule: (...args: unknown[]) => mockMessagingModule(...(args as [])),
}));

const backgroundTasks: Array<() => Promise<void>> = [];
jest.mock("@/lib/runtime/background", () => ({
  runInBackground: (task: () => Promise<void>) => {
    backgroundTasks.push(task);
  },
}));

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const PAYLOAD = JSON.stringify({
  object: "instagram",
  entry: [
    {
      id: "page-1",
      messaging: [
        {
          sender: { id: "ig-sender-456" },
          recipient: { id: "page-1" },
          message: { mid: "ig-msg-789", text: "Hello from Instagram!" },
          timestamp: 1721084400000,
        },
      ],
    },
  ],
});
const EVENT_ID = `sha:${createHash("sha256").update(PAYLOAD).digest("hex")}`;

function post(body: string = PAYLOAD, signature: string | null = "sha256=valid") {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== null) headers["X-Hub-Signature-256"] = signature;
  return new NextRequest("http://localhost:3000/api/webhook/instagram", {
    method: "POST",
    headers,
    body,
  });
}

function handshake(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/webhook/instagram");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

beforeEach(() => {
  jest.clearAllMocks();
  backgroundTasks.length = 0;
  process.env.META_APP_SECRET = "test_app_secret";
  mockVerifyMetaSignature.mockResolvedValue(true);
  mockClaim.mockResolvedValue({ eventId: EVENT_ID });
  mockProcess.mockResolvedValue("processed");
});

describe("GET /api/webhook/instagram", () => {
  it("returns the challenge when the verify token matches", async () => {
    const response = await GET(
      handshake({
        "hub.mode": "subscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": "challenge_value_42",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge_value_42");
  });

  it("returns 403 when the verify token does not match", async () => {
    const response = await GET(
      handshake({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_token",
        "hub.challenge": "challenge_value_42",
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Verification failed" });
  });

  it("returns 403 when hub.mode is not subscribe", async () => {
    const response = await GET(
      handshake({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": "challenge_value_42",
      })
    );

    expect(response.status).toBe(403);
  });
});

describe("POST /api/webhook/instagram", () => {
  describe("valid event", () => {
    it("claims the body-hash event id, answers 200 and schedules processing once", async () => {
      const response = await POST(post());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "received" });
      expect(mockMessagingModule).toHaveBeenCalledWith(
        { admin: true },
        expect.objectContaining({ channel: expect.anything() })
      );
      expect(mockClaim).toHaveBeenCalledTimes(1);
      expect(mockClaim).toHaveBeenCalledWith(EVENT_ID, "instagram", JSON.parse(PAYLOAD));
      expect(backgroundTasks).toHaveLength(1);
    });

    it("does not process before the response; the background task processes the event", async () => {
      await POST(post());

      expect(mockProcess).not.toHaveBeenCalled();
      await backgroundTasks[0]();
      expect(mockProcess).toHaveBeenCalledTimes(1);
      expect(mockProcess).toHaveBeenCalledWith(EVENT_ID);
    });

    it("verifies the exact raw bytes Meta signed", async () => {
      await POST(post());

      const [bytes, signature] = mockVerifyMetaSignature.mock.calls[0];
      expect(new TextDecoder().decode(bytes as ArrayBuffer)).toBe(PAYLOAD);
      expect(signature).toBe("sha256=valid");
    });

    it("also acknowledges payloads without messages; processing decides they are ignored", async () => {
      const body = JSON.stringify({ object: "instagram", entry: [{ id: "page-1", changes: [{ field: "mention" }] }] });

      const response = await POST(post(body));

      expect(response.status).toBe(200);
      expect(mockClaim).toHaveBeenCalledTimes(1);
      expect(backgroundTasks).toHaveLength(1);
    });
  });

  describe("re-delivered event", () => {
    it("answers 200 without scheduling processing when the event id is already claimed", async () => {
      mockClaim.mockResolvedValue(null);

      const response = await POST(post());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "duplicate" });
      expect(backgroundTasks).toHaveLength(0);
      expect(mockProcess).not.toHaveBeenCalled();
    });
  });

  describe("signature", () => {
    it("answers 401 and stores nothing when the signature does not match", async () => {
      mockVerifyMetaSignature.mockResolvedValue(false);

      const response = await POST(post(PAYLOAD, "sha256=invalid"));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Invalid signature" });
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockClaim).not.toHaveBeenCalled();
      expect(backgroundTasks).toHaveLength(0);
    });

    it("answers 401 and stores nothing when the signature header is missing", async () => {
      const response = await POST(post(PAYLOAD, null));

      expect(response.status).toBe(401);
      expect(mockVerifyMetaSignature).not.toHaveBeenCalled();
      expect(mockClaim).not.toHaveBeenCalled();
    });

    it("fails closed with 401 when no app secret is configured", async () => {
      const { InstagramMessagingService } = jest.requireActual(
        "@/infrastructure/services/InstagramMessagingService"
      );
      const real = new InstagramMessagingService();
      mockVerifyMetaSignature.mockImplementation((bytes: ArrayBuffer, sig: string) =>
        real.verifyMetaSignature(bytes, sig)
      );
      delete process.env.META_APP_SECRET;
      delete process.env.INSTAGRAM_APP_SECRET;
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await POST(post(PAYLOAD, `sha256=${"0".repeat(64)}`));

      errorSpy.mockRestore();
      expect(response.status).toBe(401);
      expect(mockClaim).not.toHaveBeenCalled();
    });

    it("does not expose debug data or HMAC values on an invalid signature", async () => {
      mockVerifyMetaSignature.mockResolvedValue(false);

      const response = await POST(post(PAYLOAD, "sha256=invalid"));

      expect(await response.json()).toEqual({ error: "Invalid signature" });
    });
  });

  describe("failures", () => {
    it("returns 400 for a malformed JSON body with a valid signature and stores nothing", async () => {
      const response = await POST(post("{not-json"));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid payload" });
      expect(mockClaim).not.toHaveBeenCalled();
      expect(backgroundTasks).toHaveLength(0);
    });

    it("answers 500 so Meta retries when the claim insert fails", async () => {
      mockClaim.mockRejectedValue(new Error("webhook_events.claim: connection refused"));

      const response = await POST(post());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Temporary failure" });
      expect(backgroundTasks).toHaveLength(0);
    });

    it("answers 500 when the admin client is not configured", async () => {
      mockCreateAdminClient.mockImplementationOnce(() => {
        throw new Error("Supabase admin client is not configured");
      });

      const response = await POST(post());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Server configuration error" });
      expect(mockClaim).not.toHaveBeenCalled();
    });
  });
});
