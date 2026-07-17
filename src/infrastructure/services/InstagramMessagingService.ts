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
   * Strip an Instagram handle to raw username.
   * "@juancode.dev" -> "juancode.dev"
   * "https://instagram.com/juancode.dev" -> "juancode.dev"
   * "juancode.dev" -> "juancode.dev"
   */
  private sanitizeHandle(handle: string): string {
    let clean = handle.trim();

    // Remove leading @
    if (clean.startsWith("@")) clean = clean.slice(1);

    // Extract username from URL
    try {
      const url = new URL(
        clean.startsWith("http") ? clean : `https://${clean}`
      );
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) clean = pathParts[pathParts.length - 1];
    } catch {
      // not a URL, keep as-is
    }

    return clean;
  }

  /**
   * Resolve an Instagram handle (username) to a numeric Instagram User ID
   * using the Business Discovery API.
   *
   * POST /{igBusinessAccountId}?fields=business_discovery.username({handle}){id}
   */
  async resolveHandleToUserId(
    handle: string,
    igBusinessAccountId: string,
    pageAccessToken: string
  ): Promise<string> {
    const username = this.sanitizeHandle(handle);

    const url = `https://graph.facebook.com/v25.0/${igBusinessAccountId}`;
    const params = new URLSearchParams({
      fields: `business_discovery.username(${username}){id}`,
      access_token: pageAccessToken,
    });

    const response = await fetch(`${url}?${params}`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(
        `Failed to resolve Instagram handle: ${
          errorBody?.error?.message || response.statusText
        }`
      );
    }

    const body = (await response.json()) as {
      business_discovery?: { id: string };
    };

    if (!body.business_discovery?.id) {
      throw new Error(
        `Instagram user "${username}" not found or not a business/creator account`
      );
    }

    return body.business_discovery.id;
  }

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
    const isSelfMessage = igId === recipientIgSid;
    const url = `https://graph.facebook.com/v25.0/${igId}/messages`;

    const payload = isSelfMessage
      ? { message: { text } } // Self-messaging: no recipient field needed
      : { recipient: { id: recipientIgSid }, message: { text } };

    const params = new URLSearchParams({ access_token: pageAccessToken });
    const response = await fetch(`${url}?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetail: string;
      try {
        const errorBody = (await response.json()) as {
          error?: { message?: string; code?: number; type?: string };
        };
        errorDetail = errorBody?.error?.message || response.statusText;
      } catch {
        errorDetail = response.statusText || `HTTP ${response.status}`;
      }
      throw new Error(`Failed to send Instagram DM: ${errorDetail}`);
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
      timestamp: messaging.timestamp
        ? new Date(messaging.timestamp).toISOString()
        : new Date().toISOString(),
    };
  }
}
