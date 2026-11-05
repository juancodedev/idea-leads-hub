import { InboundAttachmentType, InboundEvent } from "../../domain/events/InboundEvent";
import { Channel } from "../../domain/enums/Channel";
import { ChannelAccountRepository } from "../../domain/ports/ChannelAccountRepository";
import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { LeadLookup } from "../../domain/ports/LeadLookup";
import { Conversation } from "../../domain/entities/Conversation";
import { logger } from "@/lib/logger";

export type IngestResult =
  | { kind: "ignored"; reason: "unknown-account" | "duplicate-mid" | "echo-without-mid" }
  | {
      kind: "processed";
      conversationId: string;
      messageId: string;
      outcome: "inserted" | "adopted";
    };

/** Legacy timeline activity data written in the same transaction (S8). */
export interface LegacyActivityInput {
  title: string;
}

export interface IngestInboundSqlInput {
  conversationId: string;
  externalId: string | null;
  type: string;
  body: string;
  rawPayload: unknown;
  at: Date;
  legacy: LegacyActivityInput;
}

export interface RecordEchoSqlInput {
  conversationId: string;
  externalId: string;
  body: string;
  eventAt: Date;
  rawPayload: unknown;
  legacy: LegacyActivityInput;
}

export interface IngestInboundEventDeps {
  channelAccountRepository: ChannelAccountRepository;
  conversationRepository: ConversationRepository;
  leadLookup: LeadLookup;
  /** messaging_ingest_inbound: message + legacy activity + counters, atomically. */
  execIngestInbound: (
    input: IngestInboundSqlInput
  ) => Promise<{ inserted: boolean; messageId: string | null }>;
  /** messaging_record_echo: duplicate | adopt pending/failed | insert, atomically. */
  execRecordEcho: (
    input: RecordEchoSqlInput
  ) => Promise<{ outcome: "duplicate" | "adopted" | "inserted"; messageId: string | null }>;
}

const ATTACHMENT_PLACEHOLDERS: Record<InboundAttachmentType, string> = {
  image: "[imagen]",
  audio: "[audio]",
  video: "[video]",
  file: "[archivo]",
};

export class IngestInboundEvent {
  constructor(private readonly deps: IngestInboundEventDeps) {}

  /**
   * Ingests one parsed webhook event (S5, S6, S8).
   *
   * - Unknown channel account -> ignored.
   * - `message`: stored as inbound with its legacy activity and counter update
   *   in one transaction; a repeated `mid` is a no-op (ignored).
   * - `echo`: duplicate `mid` -> ignored; otherwise adopts the CRM's pending or
   *   failed row (window measured from the echo timestamp) or inserts a new
   *   outbound row. Echoes never touch unread counters.
   */
  async execute(event: InboundEvent): Promise<IngestResult> {
    const { channelAccountRepository } = this.deps;

    const account = await channelAccountRepository.findByExternalAccountId(
      Channel.INSTAGRAM,
      event.accountId
    );
    if (!account) {
      logger.info("IngestInboundEvent: unknown account, ignoring", {
        accountId: event.accountId,
      });
      return { kind: "ignored", reason: "unknown-account" };
    }

    const conversation = await this.resolveConversation(
      account.id,
      account.userId,
      event.participantId
    );
    const body = this.bodyOf(event);

    if (event.kind === "echo") {
      return this.ingestEcho(event, conversation, body);
    }
    return this.ingestMessage(event, conversation, body);
  }

  private async ingestMessage(
    event: InboundEvent,
    conversation: Conversation,
    body: string
  ): Promise<IngestResult> {
    const result = await this.deps.execIngestInbound({
      conversationId: conversation.id,
      externalId: event.mid ?? null,
      type: event.attachmentType ?? "text",
      body,
      rawPayload: event.rawPayload,
      at: event.timestamp,
      legacy: { title: `Instagram DM from ${event.participantId}` },
    });

    if (!result.inserted || !result.messageId) {
      return { kind: "ignored", reason: "duplicate-mid" };
    }
    return {
      kind: "processed",
      conversationId: conversation.id,
      messageId: result.messageId,
      outcome: "inserted",
    };
  }

  private async ingestEcho(
    event: InboundEvent,
    conversation: Conversation,
    body: string
  ): Promise<IngestResult> {
    if (!event.mid) {
      // Without a mid an echo cannot be deduplicated; storing it could
      // duplicate a CRM-sent message, so it is skipped.
      logger.warn("IngestInboundEvent: echo without mid, ignoring", {
        conversationId: conversation.id,
      });
      return { kind: "ignored", reason: "echo-without-mid" };
    }

    const result = await this.deps.execRecordEcho({
      conversationId: conversation.id,
      externalId: event.mid,
      body,
      eventAt: event.timestamp,
      rawPayload: event.rawPayload,
      legacy: { title: `Instagram DM to ${event.participantId}` },
    });

    if (result.outcome === "duplicate" || !result.messageId) {
      return { kind: "ignored", reason: "duplicate-mid" };
    }
    return {
      kind: "processed",
      conversationId: conversation.id,
      messageId: result.messageId,
      outcome: result.outcome,
    };
  }

  private async resolveConversation(
    accountId: string,
    userId: string,
    participantId: string
  ): Promise<Conversation> {
    const { conversationRepository, leadLookup } = this.deps;

    let conversation = await conversationRepository.findOrCreate({
      userId,
      leadId: null,
      accountId,
      channel: Channel.INSTAGRAM,
      externalId: participantId,
      participantName: null,
      lastInboundAt: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: 0,
      metadata: {},
    });

    if (!conversation.leadId) {
      const leadId = await leadLookup.findLeadIdByInstagramScopedId(
        userId,
        participantId
      );
      if (leadId) {
        conversation = await conversationRepository.update(conversation.id, {
          leadId,
        });
      }
    }
    return conversation;
  }

  private bodyOf(event: InboundEvent): string {
    if (event.text) return event.text;
    return ATTACHMENT_PLACEHOLDERS[event.attachmentType ?? "file"];
  }
}
