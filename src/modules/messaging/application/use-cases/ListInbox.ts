import { Conversation } from "../../domain/entities/Conversation";
import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { LeadLookup, LeadSummary } from "../../domain/ports/LeadLookup";
import { inboxKeyOf } from "../../domain/values/InboxKey";

export type InboxDirection = "inbound" | "outbound";

/** One inbox entry: the set of conversations behind one key (ADR-11). */
export interface InboxEntry {
  /** Inbox key: `lead:<leadId>` or `unlinked:<participantId>`. */
  id: string;
  conversationIds: string[];
  leadId: string | null;
  leadName: string;
  instagramHandle: string | null;
  instagramScopedId: string | null;
  lastMessage: { text: string; timestamp: string; direction: InboxDirection };
  unreadCount: number;
  isConnected: boolean;
  isLinked: boolean;
}

export interface ListInboxDeps {
  conversationRepository: ConversationRepository;
  leadLookup: LeadLookup;
}

/**
 * Lists the user's inbox (S10): one entry per key, `unreadCount` summed and
 * `lastMessage` taken from the most recent conversation of the set, entries
 * ordered by their last message, newest first.
 */
export class ListInbox {
  constructor(private readonly deps: ListInboxDeps) {}

  async execute(userId: string): Promise<InboxEntry[]> {
    const conversations = await this.deps.conversationRepository.listByUser(userId);
    const leadIds = [
      ...new Set(conversations.map((c) => c.leadId).filter((id): id is string => !!id)),
    ];
    const leads = new Map<string, LeadSummary>();
    if (leadIds.length > 0) {
      for (const lead of await this.deps.leadLookup.findSummaries(userId, leadIds)) {
        leads.set(lead.id, lead);
      }
    }

    const entries = new Map<string, InboxEntry & { lastAt: number }>();
    for (const conversation of conversations) {
      const key = inboxKeyOf(conversation);
      const lastAt = (conversation.lastMessageAt ?? conversation.createdAt).getTime();
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { ...this.newEntry(key, conversation, leads), lastAt });
        continue;
      }
      entry.conversationIds.push(conversation.id);
      entry.unreadCount += conversation.unreadCount;
      if (lastAt > entry.lastAt) {
        entry.lastAt = lastAt;
        entry.lastMessage = lastMessageOf(conversation);
      }
    }

    return [...entries.values()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .map(({ lastAt: _lastAt, ...entry }) => entry);
  }

  private newEntry(
    key: string,
    conversation: Conversation,
    leads: Map<string, LeadSummary>
  ): InboxEntry {
    const lead = conversation.leadId ? leads.get(conversation.leadId) : undefined;
    const instagramScopedId = lead ? lead.instagramScopedId : conversation.externalId;
    return {
      id: key,
      conversationIds: [conversation.id],
      leadId: conversation.leadId,
      leadName: lead?.name ?? `Instagram: ${conversation.externalId}`,
      instagramHandle: lead?.instagramHandle ?? null,
      instagramScopedId,
      lastMessage: lastMessageOf(conversation),
      unreadCount: conversation.unreadCount,
      isConnected: !!instagramScopedId,
      isLinked: !!conversation.leadId,
    };
  }
}

/**
 * The conversation keeps no direction for its last message: it was inbound
 * when the last inbound message is the last message.
 */
function lastMessageOf(conversation: Conversation): InboxEntry["lastMessage"] {
  const { lastInboundAt, lastMessageAt } = conversation;
  const inbound =
    !!lastInboundAt && (!lastMessageAt || lastInboundAt.getTime() >= lastMessageAt.getTime());
  return {
    text: conversation.lastMessagePreview ?? "",
    timestamp: (lastMessageAt ?? conversation.createdAt).toISOString(),
    direction: inbound ? "inbound" : "outbound",
  };
}
