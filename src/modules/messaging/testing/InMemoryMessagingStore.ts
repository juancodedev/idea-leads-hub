/**
 * In-memory model of the messaging tables and the ADR-10 SQL functions.
 * It mirrors the semantics of supabase/migrations/20261103000000_messaging_tables.sql
 * so use cases can be tested without a database. SQL-level atomicity itself
 * is covered by `pnpm test:db` (T10).
 */
import { ChannelAccount } from "../domain/entities/ChannelAccount";
import { Conversation } from "../domain/entities/Conversation";
import { Message } from "../domain/entities/Message";
import { Channel } from "../domain/enums/Channel";
import { MessageDirection } from "../domain/enums/MessageDirection";
import { MessageOrigin } from "../domain/enums/MessageOrigin";
import { MessageStatus } from "../domain/enums/MessageStatus";
import { ChannelAccountRepository } from "../domain/ports/ChannelAccountRepository";
import {
  ConversationRepository,
  NewConversation,
} from "../domain/ports/ConversationRepository";
import { LeadLookup } from "../domain/ports/LeadLookup";
import { MessageRepository } from "../domain/ports/MessageRepository";
import {
  ClaimedWebhookEvent,
  WebhookEvent,
  WebhookEventRepository,
} from "../domain/ports/WebhookEventRepository";
import {
  IngestInboundSqlInput,
  RecordEchoSqlInput,
} from "../application/use-cases/IngestInboundEvent";
import { MarkSentSqlInput } from "../application/use-cases/DeliverMessage";

export interface LegacyActivity {
  id: string;
  userId: string;
  leadId: string | null;
  title: string;
  description: string | null;
  readAt: Date | null;
}

const ECHO_WINDOW_MS = 2 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

export class InMemoryMessagingStore {
  accounts: ChannelAccount[] = [];
  conversations: Conversation[] = [];
  messages: Message[] = [];
  activities: LegacyActivity[] = [];
  events: WebhookEvent[] = [];
  leadsByScopedId = new Map<string, string>(); // `${userId}:${igsid}` -> leadId
  now = new Date("2026-11-04T12:00:00Z");

  addAccount(overrides: Partial<ChannelAccount> = {}): ChannelAccount {
    const account: ChannelAccount = {
      id: nextId("acc"),
      userId: "user_1",
      channel: Channel.INSTAGRAM,
      externalAccountId: "ig_123",
      pageId: null,
      displayName: null,
      status: "connected",
      createdAt: this.now,
      updatedAt: this.now,
      ...overrides,
    };
    this.accounts.push(account);
    return account;
  }

  addConversation(overrides: Partial<Conversation> = {}): Conversation {
    const conversation: Conversation = {
      id: nextId("conv"),
      userId: "user_1",
      leadId: null,
      accountId: "acc_x",
      channel: Channel.INSTAGRAM,
      externalId: "123",
      participantName: null,
      lastInboundAt: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: 0,
      metadata: {},
      createdAt: this.now,
      updatedAt: this.now,
      ...overrides,
    };
    this.conversations.push(conversation);
    return conversation;
  }

  addMessage(overrides: Partial<Message> = {}): Message {
    const message: Message = {
      id: nextId("msg"),
      userId: "user_1",
      conversationId: "conv_x",
      direction: MessageDirection.OUTBOUND,
      origin: MessageOrigin.HUMAN,
      type: "text",
      body: "Hola",
      externalId: null,
      status: MessageStatus.PENDING,
      errorMessage: null,
      hint: null,
      legacyActivityId: null,
      rawPayload: null,
      createdAt: this.now,
      deliveredAt: null,
      readAt: null,
      updatedAt: this.now,
      ...overrides,
    };
    this.messages.push(message);
    return message;
  }

  addEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
    const event: WebhookEvent = {
      eventId: nextId("evt"),
      provider: "instagram",
      status: "received",
      attempts: 0,
      payload: {},
      receivedAt: this.now,
      lastAttemptAt: null,
      ...overrides,
    };
    this.events.push(event);
    return event;
  }

  legacyFor(messageId: string): LegacyActivity[] {
    const message = this.messages.find((m) => m.id === messageId);
    return this.activities.filter((a) => a.id === message?.legacyActivityId);
  }

  // ---------------------------------------------------------------- ports

  channelAccountRepository(): ChannelAccountRepository {
    return {
      findById: async (id) => this.accounts.find((a) => a.id === id) ?? null,
      findByExternalAccountId: async (channel, externalAccountId) =>
        this.accounts.find(
          (a) =>
            a.channel === channel &&
            (a.externalAccountId === externalAccountId ||
              a.pageId === externalAccountId)
        ) ?? null,
      findByUserId: async (userId) =>
        this.accounts.filter((a) => a.userId === userId),
      create: async (input) => this.addAccount(input),
    };
  }

  conversationRepository(): ConversationRepository {
    return {
      findById: async (id) => this.conversations.find((c) => c.id === id) ?? null,
      findByAccountAndExternalId: async (accountId, externalId) =>
        this.findConversation(accountId, externalId),
      findByLeadId: async (leadId) =>
        this.conversations.filter((c) => c.leadId === leadId),
      // Check and insert run in the same synchronous step, like
      // `insert ... on conflict do nothing` followed by a select.
      findOrCreate: async (input: NewConversation) =>
        this.findConversation(input.accountId!, input.externalId) ??
        this.addConversation(input),
      update: async (id, patch) => {
        const conversation = this.conversations.find((c) => c.id === id);
        if (!conversation) throw new Error(`conversation ${id} not found`);
        Object.assign(conversation, patch);
        return conversation;
      },
    };
  }

  messageRepository(): MessageRepository {
    return {
      findById: async (id) => this.messages.find((m) => m.id === id) ?? null,
      findByExternalId: async (externalId) =>
        this.messages.find((m) => m.externalId === externalId) ?? null,
      findByConversation: async (conversationId) =>
        this.messages.filter((m) => m.conversationId === conversationId),
      create: async (input) => this.addMessage(input),
      markFailedIfPending: async (id, error, hint) => {
        const message = this.messages.find((m) => m.id === id)!;
        if (message.status === MessageStatus.PENDING) {
          Object.assign(message, {
            status: MessageStatus.FAILED,
            errorMessage: error,
            hint,
          });
        }
        return message;
      },
    };
  }

  leadLookup(): LeadLookup {
    return {
      findLeadIdByInstagramScopedId: async (userId, igsid) =>
        this.leadsByScopedId.get(`${userId}:${igsid}`) ?? null,
    };
  }

  webhookEventRepository(): WebhookEventRepository {
    return {
      claim: async (eventId, provider, payload) => {
        if (this.events.some((e) => e.eventId === eventId)) return null;
        this.addEvent({ eventId, provider, payload });
        return { eventId };
      },
      startAttempt: async (eventId) => {
        const event = this.events.find(
          (e) => e.eventId === eventId && e.status === "received"
        );
        if (!event) return null;
        event.attempts++;
        event.lastAttemptAt = this.now;
        return this.toClaimed(event);
      },
      claimRetry: async (limit) =>
        this.events
          .filter(
            (e) =>
              e.status === "received" &&
              e.attempts < 3 &&
              (e.lastAttemptAt ?? e.receivedAt).getTime() <
                this.now.getTime() - LEASE_MS
          )
          .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
          .slice(0, limit)
          .map((e) => {
            e.attempts++;
            e.lastAttemptAt = this.now;
            return this.toClaimed(e);
          }),
      markProcessed: async (id) => this.setEventStatus(id, "processed"),
      markIgnored: async (id) => this.setEventStatus(id, "ignored"),
      markFailed: async (id) => this.setEventStatus(id, "failed"),
      deleteHandledOlderThan: async (days) => {
        const limit = this.now.getTime() - days * 24 * 60 * 60 * 1000;
        this.events = this.events.filter(
          (e) =>
            !(
              (e.status === "processed" || e.status === "ignored") &&
              e.receivedAt.getTime() < limit
            )
        );
      },
    };
  }

  // -------------------------------------------------------- SQL functions

  /** messaging_ingest_inbound */
  ingestInbound = async (input: IngestInboundSqlInput) => {
    if (
      input.externalId &&
      this.messages.some((m) => m.externalId === input.externalId)
    ) {
      return { inserted: false, messageId: null };
    }
    const conversation = this.conversations.find(
      (c) => c.id === input.conversationId
    )!;
    const message = this.addMessage({
      userId: conversation.userId,
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      origin: MessageOrigin.HUMAN,
      type: input.type,
      body: input.body,
      externalId: input.externalId,
      status: MessageStatus.RECEIVED,
      rawPayload: input.rawPayload,
      createdAt: input.at,
    });
    message.legacyActivityId = this.writeLegacy(conversation, input.legacy.title, input.body);
    conversation.lastInboundAt = this.latest(conversation.lastInboundAt, input.at);
    conversation.lastMessageAt = this.latest(conversation.lastMessageAt, input.at);
    conversation.lastMessagePreview = input.body;
    conversation.unreadCount += 1;
    return { inserted: true, messageId: message.id };
  };

  /** messaging_record_echo */
  recordEcho = async (input: RecordEchoSqlInput) => {
    const existing = this.messages.find((m) => m.externalId === input.externalId);
    if (existing) return { outcome: "duplicate" as const, messageId: existing.id };

    const conversation = this.conversations.find(
      (c) => c.id === input.conversationId
    )!;
    const from = input.eventAt.getTime() - ECHO_WINDOW_MS;
    const candidate = this.messages
      .filter(
        (m) =>
          m.conversationId === conversation.id &&
          m.direction === MessageDirection.OUTBOUND &&
          m.externalId === null &&
          (m.status === MessageStatus.PENDING || m.status === MessageStatus.FAILED) &&
          m.body === input.body &&
          m.createdAt.getTime() >= from &&
          m.createdAt.getTime() <= input.eventAt.getTime()
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    let outcome: "adopted" | "inserted";
    let message: Message;
    if (candidate) {
      outcome = "adopted";
      message = Object.assign(candidate, {
        externalId: input.externalId,
        status: MessageStatus.SENT,
        errorMessage: null,
        hint: null,
      });
    } else {
      outcome = "inserted";
      message = this.addMessage({
        userId: conversation.userId,
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        origin: MessageOrigin.HUMAN,
        body: input.body,
        externalId: input.externalId,
        status: MessageStatus.SENT,
        rawPayload: input.rawPayload,
        createdAt: input.eventAt,
      });
    }
    this.ensureLegacy(message, conversation, input.legacy.title);
    conversation.lastMessageAt = this.latest(conversation.lastMessageAt, input.eventAt);
    conversation.lastMessagePreview = input.body;
    return { outcome, messageId: message.id };
  };

  /** messaging_mark_sent */
  markSent = async (input: MarkSentSqlInput) => {
    const message = this.messages.find((m) => m.id === input.messageId)!;
    if (message.status === MessageStatus.PENDING) {
      message.status = MessageStatus.SENT;
      message.externalId = input.externalId;
    }
    const conversation = this.conversations.find(
      (c) => c.id === message.conversationId
    )!;
    this.ensureLegacy(message, conversation, input.legacy.title);
    conversation.lastMessageAt = this.now;
    conversation.lastMessagePreview = message.body;
    return message;
  };

  /** messaging_set_conversations_read */
  setConversationsRead = async (ids: string[]) => {
    for (const conversation of this.conversations) {
      if (!ids.includes(conversation.id)) continue;
      conversation.unreadCount = 0;
      for (const message of this.messages) {
        if (
          message.conversationId !== conversation.id ||
          message.direction !== MessageDirection.INBOUND
        ) {
          continue;
        }
        const activity = this.activities.find((a) => a.id === message.legacyActivityId);
        if (activity && !activity.readAt) activity.readAt = this.now;
      }
    }
  };

  // -------------------------------------------------------------- helpers

  private findConversation(accountId: string, externalId: string) {
    return (
      this.conversations.find(
        (c) => c.accountId === accountId && c.externalId === externalId
      ) ?? null
    );
  }

  private writeLegacy(conversation: Conversation, title: string, body: string | null) {
    const activity: LegacyActivity = {
      id: nextId("act"),
      userId: conversation.userId,
      leadId: conversation.leadId,
      title,
      description: body,
      readAt: null,
    };
    this.activities.push(activity);
    return activity.id;
  }

  private ensureLegacy(message: Message, conversation: Conversation, title: string) {
    if (message.legacyActivityId) return;
    message.legacyActivityId = this.writeLegacy(conversation, title, message.body);
  }

  private latest(current: Date | null, candidate: Date) {
    return current && current > candidate ? current : candidate;
  }

  private toClaimed(event: WebhookEvent): ClaimedWebhookEvent {
    return { eventId: event.eventId, attempts: event.attempts, payload: event.payload };
  }

  private setEventStatus(id: string, status: WebhookEvent["status"]) {
    const event = this.events.find((e) => e.eventId === id);
    if (event) event.status = status;
  }
}
