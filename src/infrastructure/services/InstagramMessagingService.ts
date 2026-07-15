export interface SendDMResult {
  messageId: string;
}

export interface ParsedMessage {
  senderId: string;
  messageId: string;
  text: string;
  timestamp: string;
}

export class InstagramMessagingService {
  /**
   * Send a DM via Meta Graph API.
   * @param igId Instagram Business Account ID (IGID)
   * @param recipientIgSid Recipient's Instagram-scoped ID
   * @param text Message text
   * @param pageAccessToken Page Access Token for auth
   */
  async sendDM(
    igId: string,
    recipientIgSid: string,
    text: string,
    pageAccessToken: string
  ): Promise<SendDMResult> {
    const url = `https://graph.facebook.com/v21.0/${igId}/messages?access_token=${pageAccessToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientIgSid },
        messaging_type: "MESSAGE_TAG",
        tag: "CONFIRMED_EVENT_UPDATE",
        message: { text },
      }),
    });

    if (!response.ok) {
      throw new Error(
        "Failed to send Instagram DM: " +
          (response.statusText || `HTTP ${response.status}`)
      );
    }

    const body = (await response.json()) as { message_id: string };
    return { messageId: body.message_id };
  }

  /**
   * Verify Meta webhook HMAC-SHA256 signature.
   * Compares the expected signature (computed from payload + app secret)
   * against the `X-Hub-Signature-256` header value.
   */
  async verifyMetaSignature(
    payload: string,
    signature: string
  ): Promise<boolean> {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      return false;
    }

    if (!signature.startsWith("sha256=")) {
      return false;
    }

    const providedHex = signature.slice(7);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expectedSig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    if (expectedHex.length !== providedHex.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      mismatch |= expectedHex.charCodeAt(i) ^ providedHex.charCodeAt(i);
    }
    return mismatch === 0;
  }

  /**
   * Parse an incoming Meta webhook message payload.
   * Returns null if the payload is not a text message.
   */
  parseIncomingMessage(payload: unknown): ParsedMessage | null {
    const data = payload as {
      entry?: Array<{
        messaging?: Array<{
          sender?: { id?: string };
          message?: { mid?: string; text?: string };
          timestamp?: number;
        }>;
      }>;
    };

    const messaging = data?.entry?.[0]?.messaging?.[0];
    if (!messaging) return null;

    const text = messaging.message?.text;
    if (!text) return null;

    const senderId = messaging.sender?.id;
    const messageId = messaging.message?.mid;
    if (!senderId || !messageId) return null;

    return {
      senderId,
      messageId,
      text,
      timestamp: new Date(messaging.timestamp).toISOString(),
    };
  }
}
