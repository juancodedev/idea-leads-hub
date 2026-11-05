import { GraphApiError } from "@/infrastructure/services/GraphApiError";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";
import { logger } from "@/lib/logger";
import { Channel } from "../../domain/enums/Channel";
import { InboundAttachmentType, InboundEvent } from "../../domain/events/InboundEvent";
import {
  MessagingChannel,
  SendContext,
  SendMessageInput,
  SendOutcome,
  SendOutcomeError,
} from "../../domain/ports/MessagingChannel";

export const SEND_TIMEOUT_MS = 15000;

export const SEND_HINTS = {
  token: "Token vencido: reconectá Instagram",
  permissions: "Faltan permisos de mensajería en la app de Meta",
  rateLimit: "Límite de envíos alcanzado, reintentá en unos minutos",
  network: "No se pudo contactar a Instagram",
  rejected: (code: number) => `Meta rechazó el mensaje (código ${code})`,
} as const;

const SIGNATURE_HEADER = "x-hub-signature-256";
const INSTAGRAM_LOGIN_AUTH_TYPE = "instagram_business_login";
const KNOWN_ATTACHMENT_TYPES: readonly InboundAttachmentType[] = ["image", "audio", "video", "file"];

type JsonObject = Record<string, unknown>;

/** Timestamp unit of each Meta payload shape. */
type TimestampUnit = "ms" | "s";

export interface MetaInstagramChannelOptions {
  /** Graph send timeout; defaults to 15 s (ADR-8). */
  timeoutMs?: number;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idOf(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;
  const id = value.id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return undefined;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Meta Instagram adapter of the MessagingChannel port (S2). Reuses
 * InstagramMessagingService for Graph sends and HMAC verification.
 */
export class MetaInstagramChannel implements MessagingChannel {
  readonly channel = Channel.INSTAGRAM;
  private readonly timeoutMs: number;

  constructor(
    private readonly messagingService: InstagramMessagingService = new InstagramMessagingService(),
    options: MetaInstagramChannelOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? SEND_TIMEOUT_MS;
  }

  async verifyWebhook(rawBody: ArrayBuffer, headers: Headers): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;
    return this.messagingService.verifyMetaSignature(rawBody, signature);
  }

  /** Meta Instagram payloads carry no delivery id: always the body hash (ADR-4). */
  async eventId(_payload: unknown, rawBody: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", rawBody);
    return `sha:${toHex(digest)}`;
  }

  /**
   * Maps every message and echo of every entry, in both the `messaging[]` and
   * the `changes[].value` (field `messages`) shapes. Items without a message
   * and malformed items are skipped; only a payload without an `entry` array
   * is rejected.
   */
  parse(payload: unknown): InboundEvent[] {
    if (!isObject(payload) || !Array.isArray(payload.entry)) {
      throw new Error("Unparseable Meta Instagram payload: missing entry array");
    }

    const events: InboundEvent[] = [];
    for (const entry of payload.entry) {
      if (!isObject(entry)) continue;
      const entryId = idOf(entry);

      if (Array.isArray(entry.messaging)) {
        for (const item of entry.messaging) {
          this.collect(events, item, entryId, "ms");
        }
      }
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (!isObject(change)) continue;
          if (change.field !== undefined && change.field !== "messages") continue;
          this.collect(events, change.value, entryId, "s");
        }
      }
    }
    return events;
  }

  /** Sends through the Graph API matching the auth type. Never throws. */
  async send(ctx: SendContext, input: SendMessageInput): Promise<SendOutcome> {
    try {
      const options = { signal: AbortSignal.timeout(this.timeoutMs) };
      const result =
        ctx.authType === INSTAGRAM_LOGIN_AUTH_TYPE
          ? await this.messagingService.sendDMViaInstagramLogin(
              ctx.accountId,
              ctx.recipientId,
              input.body,
              ctx.token,
              options
            )
          : await this.messagingService.sendDM(
              ctx.accountId,
              ctx.recipientId,
              input.body,
              ctx.token,
              options
            );
      return { ok: true, externalId: result.messageId };
    } catch (error) {
      return toSendError(error);
    }
  }

  private collect(
    events: InboundEvent[],
    item: unknown,
    entryId: string | undefined,
    unit: TimestampUnit
  ): void {
    try {
      const event = toInboundEvent(item, entryId, unit);
      if (event) events.push(event);
    } catch (error) {
      logger.warn("MetaInstagramChannel: skipping malformed messaging item", { error });
    }
  }
}

function toInboundEvent(
  item: unknown,
  entryId: string | undefined,
  unit: TimestampUnit
): InboundEvent | null {
  if (!isObject(item) || !isObject(item.message)) return null;
  const message = item.message;

  const isEcho = message.is_echo === true;
  const senderId = idOf(item.sender);
  const recipientId = idOf(item.recipient);
  const participantId = isEcho ? recipientId : senderId;
  const accountId = (isEcho ? senderId : recipientId) ?? entryId;
  if (!participantId || !accountId) return null;

  const event: InboundEvent = {
    kind: isEcho ? "echo" : "message",
    accountId,
    participantId,
    mid: typeof message.mid === "string" ? message.mid : undefined,
    text: typeof message.text === "string" ? message.text : "",
    timestamp: toTimestamp(item.timestamp, unit),
    rawPayload: item,
  };

  const attachmentType = toAttachmentType(message.attachments);
  if (attachmentType) event.attachmentType = attachmentType;
  return event;
}

function toAttachmentType(attachments: unknown): InboundAttachmentType | undefined {
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined;
  const first: unknown = attachments[0];
  const type = isObject(first) ? first.type : undefined;
  return KNOWN_ATTACHMENT_TYPES.find((known) => known === type) ?? "file";
}

function toTimestamp(value: unknown, unit: TimestampUnit): Date {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
    return new Date();
  }
  return new Date(unit === "s" ? numeric * 1000 : numeric);
}

/** ADR-8 mapping of a failed send to an error and a user-facing hint. */
function toSendError(error: unknown): SendOutcomeError {
  const message = error instanceof Error ? error.message : String(error);

  if (!(error instanceof GraphApiError)) {
    // fetch rejections: network failure, DNS, abort/timeout
    return { ok: false, error: message, hint: SEND_HINTS.network };
  }

  const { code, status } = error;
  let hint: string;
  if (code === 190 || status === 401) {
    hint = SEND_HINTS.token;
  } else if (code === 10 || code === 200 || status === 403) {
    hint = SEND_HINTS.permissions;
  } else if (status === 429 || code === 4 || code === 613) {
    hint = SEND_HINTS.rateLimit;
  } else {
    hint = SEND_HINTS.rejected(code ?? status);
  }
  return { ok: false, error: message, hint };
}
