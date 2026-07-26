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
   * Send a DM via Instagram Business Login API (graph.instagram.com).
   * Uses Authorization: Bearer header instead of access_token query param.
   *
   * NOTE: Does NOT support self-messaging (igId === recipientIgSid) — that
   * is a Facebook Graph API quirk not present in the Instagram Graph API.
   */
  async sendDMViaInstagramLogin(
    igId: string,
    recipientIgSid: string,
    text: string,
    instagramUserToken: string
  ): Promise<SendDMResult> {
    const url = `https://graph.instagram.com/v25.0/${igId}/messages`;

    const payload = { recipient: { id: recipientIgSid }, message: { text } };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${instagramUserToken}`,
      },
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
      throw new Error(`Failed to send Instagram DM via Business Login: ${errorDetail}`);
    }

    const body = (await response.json()) as { message_id: string };
    return { messageId: body.message_id };
  }

  /**
   * Compute HMAC-SHA256 for a given secret and payload.
   * Uses Uint8Array or raw bytes so we sign the exact bytes Meta signed,
   * avoiding any TextEncoder encoding differences.
   */
  private async computeHmac(
    secret: string,
    payload: string | Uint8Array | ArrayBuffer
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data: Uint8Array =
      typeof payload === "string"
        ? encoder.encode(payload)
        : payload instanceof ArrayBuffer
          ? new Uint8Array(payload)
          : payload;

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    // Cast through unknown: data.buffer is ArrayBufferLike (ArrayBuffer | SharedArrayBuffer),
    // but crypto.subtle.sign expects BufferSource which is ArrayBufferView | ArrayBuffer.
    // The slice returns a concrete ArrayBuffer, TypeScript just doesn't narrow it.
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    );
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Constant-time hex comparison.
   */
  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }

  /**
   * Verify Meta webhook HMAC-SHA256 signature.
   * Tries META_APP_SECRET first, then falls back to INSTAGRAM_APP_SECRET.
   * Meta signs Instagram webhooks with the Instagram App Secret in some
   * configurations, so we try both.
   */
  async verifyMetaSignature(
    payload: string | ArrayBuffer,
    signature: string
  ): Promise<boolean> {
    if (!signature.startsWith("sha256=")) {
      console.error(
        "[verifyMetaSignature] signature does not start with sha256=",
        signature.substring(0, 20)
      );
      return false;
    }

    const providedHex = signature.slice(7);

    // Try secrets in order: META_APP_SECRET first, then INSTAGRAM_APP_SECRET
    const secretsToTry: string[] = [];
    const metaSecret = process.env.META_APP_SECRET;
    const igSecret = process.env.INSTAGRAM_APP_SECRET;

    if (metaSecret) secretsToTry.push(metaSecret);
    if (igSecret && igSecret !== metaSecret) secretsToTry.push(igSecret);

    if (secretsToTry.length === 0) {
      console.error("[verifyMetaSignature] No app secrets configured");
      return false;
    }

    for (const secret of secretsToTry) {
      const expectedHex = await this.computeHmac(secret, payload);

      if (this.constantTimeEqual(expectedHex, providedHex)) {
        // Log which secret worked for future diagnostics
        const label =
          secret === metaSecret
            ? "META_APP_SECRET"
            : "INSTAGRAM_APP_SECRET";
        console.log(`[verifyMetaSignature] matched with ${label}`);
        return true;
      }
    }

    // None matched — log diagnostics
    const expectedHex = metaSecret
      ? await this.computeHmac(metaSecret, payload)
      : "";
    const bodyStr =
      payload instanceof ArrayBuffer
        ? new TextDecoder().decode(payload)
        : payload;
    console.error("[verifyMetaSignature] HMAC mismatch with all secrets", {
      expectedPrefix: expectedHex.substring(0, 16),
      providedPrefix: providedHex.substring(0, 16),
      bodyLength: bodyStr.length,
      bodyFirst100: bodyStr.substring(0, 100),
      bodyLast40: bodyStr.substring(bodyStr.length - 40),
      metaSecretSet: !!metaSecret,
      igSecretSet: !!igSecret,
    });
    return false;
  }

  /**
   * Parse an incoming Meta webhook message payload.
   * Supports two formats:
   *   - Legacy: entry[].messaging[].message.text
   *   - Instagram Graph API v25.0+: entry[].changes[].value.message.text
   *
   * Filters out echo messages (is_echo: true) — these are Meta echoing
   * our own outbound messages back to the webhook, which would otherwise
   * create phantom unlinked conversations.
   *
   * Returns null if the payload is not a text message or is an echo.
   */
  parseIncomingMessage(payload: unknown): ParsedMessage | null {
    type ChangePayload = {
      value: {
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { mid?: string; text?: string; is_echo?: boolean };
        timestamp?: number;
      };
    };

    const data = payload as {
      entry?: Array<{
        messaging?: Array<{
          sender?: { id?: string };
          message?: { mid?: string; text?: string; is_echo?: boolean };
          timestamp?: number;
        }>;
        changes?: ChangePayload[];
      }>;
    };

    const entry = data?.entry?.[0];
    if (!entry) return null;

    // Try legacy format: entry[].messaging[]
    const legacyMsg = entry.messaging?.[0];
    if (legacyMsg) {
      // Skip echo messages (our own outbound echoed back by Meta)
      if (legacyMsg.message?.is_echo) return null;

      const text = legacyMsg.message?.text;
      if (!text) return null;
      const senderId = legacyMsg.sender?.id;
      const messageId = legacyMsg.message?.mid;
      if (!senderId || !messageId) return null;
      return {
        senderId,
        messageId,
        text,
        timestamp: legacyMsg.timestamp
          ? new Date(legacyMsg.timestamp).toISOString()
          : new Date().toISOString(),
      };
    }

    // Try Instagram Graph API v25.0+ format: entry[].changes[].value
    const change = entry.changes?.[0];
    const value = change?.value;
    if (!value?.message?.text) return null;

    // Skip echo messages (v25+ format)
    if (value.message.is_echo) return null;

    const senderId = value.sender?.id;
    const messageId = value.message.mid;
    if (!senderId || !messageId) return null;

    return {
      senderId,
      messageId,
      text: value.message.text,
      timestamp: value.timestamp
        ? new Date(Number(value.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    };
  }
}
