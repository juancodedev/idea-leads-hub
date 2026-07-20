/**
 * @jest-environment node
 */

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { InstagramMessagingService } from "../InstagramMessagingService";

describe("InstagramMessagingService", () => {
  let service: InstagramMessagingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InstagramMessagingService();
  });

  describe("sendDM", () => {
    const igId = "ig-123456";
    const recipientIgSid = "recipient-ig-sid-789";
    const text = "Hello, this is a test message!";
    const pageAccessToken = "EAAPageAccessToken123";

    it("should POST to Meta Graph API and return messageId", async () => {
      const expectedMessageId = "mocked-message-id-123";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message_id: expectedMessageId,
        }),
      } as Response);

      const result = await service.sendDM(
        igId,
        recipientIgSid,
        text,
        pageAccessToken
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://graph.facebook.com/v25.0/${igId}/messages?access_token=${pageAccessToken}`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: recipientIgSid },
            message: { text },
          }),
        })
      );
      expect(result).toEqual({ messageId: expectedMessageId });
    });

    it("should throw when Meta API returns non-ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as Response);

      await expect(
        service.sendDM(igId, recipientIgSid, text, pageAccessToken)
      ).rejects.toThrow("Failed to send Instagram DM");
    });
  });

  describe("sendDMViaInstagramLogin", () => {
    const igId = "ig-123456";
    const recipientIgSid = "recipient-ig-sid-789";
    const text = "Hello from Instagram Business Login!";
    const instagramUserToken = "IGUserToken123";

    it("should POST to graph.instagram.com with Bearer auth and return messageId", async () => {
      const expectedMessageId = "mocked-ig-message-id-456";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message_id: expectedMessageId,
        }),
      } as Response);

      const result = await service.sendDMViaInstagramLogin(
        igId,
        recipientIgSid,
        text,
        instagramUserToken
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://graph.instagram.com/v25.0/${igId}/messages`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${instagramUserToken}`,
          },
          body: JSON.stringify({
            recipient: { id: recipientIgSid },
            message: { text },
          }),
        })
      );
      expect(result).toEqual({ messageId: expectedMessageId });
    });

    it("should throw when Instagram API returns non-ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: { message: "Application does not have capability" },
        }),
      } as Response);

      await expect(
        service.sendDMViaInstagramLogin(igId, recipientIgSid, text, instagramUserToken)
      ).rejects.toThrow("Failed to send Instagram DM via Business Login");
    });

    it("should throw with HTTP status when error body has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({}),
      } as Response);

      await expect(
        service.sendDMViaInstagramLogin(igId, recipientIgSid, text, instagramUserToken)
      ).rejects.toThrow("Failed to send Instagram DM via Business Login");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      await expect(
        service.sendDMViaInstagramLogin(igId, recipientIgSid, text, instagramUserToken)
      ).rejects.toThrow("Network failure");
    });
  });

  describe("verifyMetaSignature", () => {
    it("should return true for a valid signature", async () => {
      process.env.META_APP_SECRET = "my_app_secret";
      const payload = JSON.stringify({ field: "value" });
      // Expected HMAC-SHA256 hex of payload with META_APP_SECRET
      // We'll compute it using crypto.subtle in the implementation,
      // so we need to know what the hex looks like
      const expectedHex = await computeHmacSha256Hex(
        payload,
        "my_app_secret"
      );

      const signature = `sha256=${expectedHex}`;
      const result = await service.verifyMetaSignature(payload, signature);

      expect(result).toBe(true);
    });

    it("should return false for an invalid signature (tampered payload)", async () => {
      process.env.META_APP_SECRET = "my_app_secret";
      const payload = JSON.stringify({ field: "value" });
      const tamperedSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

      const result = await service.verifyMetaSignature(payload, tamperedSignature);

      expect(result).toBe(false);
    });

    it("should return false when signature does not start with sha256=", async () => {
      process.env.META_APP_SECRET = "my_app_secret";
      const payload = JSON.stringify({ field: "value" });

      const result = await service.verifyMetaSignature(payload, "invalid_format");

      expect(result).toBe(false);
    });

    it("should return false when META_APP_SECRET is not set", async () => {
      delete process.env.META_APP_SECRET;
      const payload = JSON.stringify({ field: "value" });

      const result = await service.verifyMetaSignature(payload, "sha256=abcd");

      expect(result).toBe(false);
    });
  });

  describe("parseIncomingMessage", () => {
    it("should parse standard Meta webhook message payload", () => {
      const payload = {
        entry: [
          {
            id: "page-1",
            time: 1721084400,
            messaging: [
              {
                sender: { id: "sender-ig-id-456" },
                recipient: { id: "page-1" },
                timestamp: 1721084400000,
                message: {
                  mid: "message-id-789",
                  text: "Hola, estoy interesado",
                },
              },
            ],
          },
        ],
      };

      const result = service.parseIncomingMessage(payload);

      expect(result).not.toBeNull();
      expect(result!.senderId).toBe("sender-ig-id-456");
      expect(result!.messageId).toBe("message-id-789");
      expect(result!.text).toBe("Hola, estoy interesado");
      expect(result!.timestamp).toBe("2024-07-15T23:00:00.000Z");
    });

    it("should return null for payload without messaging entries", () => {
      const payload = {
        entry: [
          {
            id: "page-1",
            time: 1721084400,
            messaging: [],
          },
        ],
      };

      const result = service.parseIncomingMessage(payload);

      expect(result).toBeNull();
    });

    it("should return null for payload without text message", () => {
      const payload = {
        entry: [
          {
            id: "page-1",
            time: 1721084400,
            messaging: [
              {
                sender: { id: "sender-ig-id-456" },
                recipient: { id: "page-1" },
                timestamp: 1721084400000,
                message: {
                  mid: "message-id-789",
                  attachments: [{ type: "image" }],
                },
              },
            ],
          },
        ],
      };

      const result = service.parseIncomingMessage(payload);

      expect(result).toBeNull();
    });
  });
});

/**
 * Helper to compute HMAC-SHA256 hex string for test expectations.
 */
async function computeHmacSha256Hex(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

beforeAll(() => {
  process.env.META_APP_SECRET = "my_app_secret";
});
