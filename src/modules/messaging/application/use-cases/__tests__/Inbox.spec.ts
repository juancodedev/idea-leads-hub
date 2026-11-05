/**
 * @jest-environment node
 *
 * Inbox readers and key operations (S10, S12, ADR-11): a key resolves to a
 * set of conversations, and GET/read/DELETE/link act on the whole set.
 */
import { ListInbox } from "../ListInbox";
import { GetInboxMessages } from "../GetInboxMessages";
import { MarkInboxRead } from "../MarkInboxRead";
import { DeleteInboxConversations } from "../DeleteInboxConversations";
import { LinkInboxConversations } from "../LinkInboxConversations";
import { CountUnreadMessages } from "../CountUnreadMessages";
import { MarkConversationRead } from "../MarkConversationRead";
import { MessageDirection } from "../../../domain/enums/MessageDirection";
import { MessageStatus } from "../../../domain/enums/MessageStatus";
import { parseInboxKey } from "../../../domain/values/InboxKey";
import { InMemoryMessagingStore } from "../../../testing/InMemoryMessagingStore";

const at = (iso: string) => new Date(iso);

describe("Inbox use cases", () => {
  let store: InMemoryMessagingStore;

  beforeEach(() => {
    store = new InMemoryMessagingStore();
  });

  const listInbox = () =>
    new ListInbox({
      conversationRepository: store.conversationRepository(),
      leadLookup: store.leadLookup(),
    }).execute("user_1");

  const markRead = (key: string) =>
    new MarkInboxRead({
      conversationRepository: store.conversationRepository(),
      markConversationRead: new MarkConversationRead({
        execSetConversationsRead: store.setConversationsRead,
      }),
    }).execute("user_1", parseInboxKey(key)!);

  const remove = (key: string) =>
    new DeleteInboxConversations({
      conversationRepository: store.conversationRepository(),
      legacyActivityRepository: store.legacyActivityRepository(),
    }).execute("user_1", parseInboxKey(key)!);

  /** A lead with two conversations (1 and 2 unread), as in the api-rest scenario. */
  const leadWithTwoConversations = () => {
    const lead = store.addLead({ name: "Ana", instagramHandle: "ana", instagramScopedId: "111" });
    const c1 = store.addConversation({
      leadId: lead.id,
      externalId: "111",
      accountId: "acc_a",
      unreadCount: 1,
      lastInboundAt: at("2026-11-04T10:00:00Z"),
      lastMessageAt: at("2026-11-04T10:00:00Z"),
      lastMessagePreview: "older",
    });
    const c2 = store.addConversation({
      leadId: lead.id,
      externalId: "111",
      accountId: "acc_b",
      unreadCount: 2,
      lastInboundAt: at("2026-11-04T11:00:00Z"),
      lastMessageAt: at("2026-11-04T11:00:00Z"),
      lastMessagePreview: "newest",
    });
    for (const c of [c1, c2]) {
      for (let i = 0; i < c.unreadCount; i++) {
        const activity = store.addLegacyActivity({ leadId: lead.id, title: "Instagram DM from 111" });
        store.addMessage({
          conversationId: c.id,
          direction: MessageDirection.INBOUND,
          status: MessageStatus.RECEIVED,
          legacyActivityId: activity.id,
        });
      }
    }
    return { lead, c1, c2 };
  };

  describe("ListInbox", () => {
    it("shows one entry per lead key with the summed unreadCount and the newest last message", async () => {
      const { lead, c1, c2 } = leadWithTwoConversations();

      const inbox = await listInbox();

      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toEqual({
        id: `lead:${lead.id}`,
        conversationIds: [c2.id, c1.id],
        leadId: lead.id,
        leadName: "Ana",
        instagramHandle: "ana",
        instagramScopedId: "111",
        lastMessage: {
          text: "newest",
          timestamp: "2026-11-04T11:00:00.000Z",
          direction: "inbound",
        },
        unreadCount: 3,
        isConnected: true,
        isLinked: true,
      });
    });

    it("groups unlinked conversations by participant and orders entries newest first", async () => {
      store.addConversation({
        externalId: "222",
        lastMessageAt: at("2026-11-04T09:00:00Z"),
        lastInboundAt: at("2026-11-04T08:00:00Z"),
        lastMessagePreview: "we replied",
        unreadCount: 1,
      });
      store.addConversation({
        externalId: "333",
        lastMessageAt: at("2026-11-04T12:00:00Z"),
        lastInboundAt: at("2026-11-04T12:00:00Z"),
        lastMessagePreview: "they wrote",
      });

      const inbox = await listInbox();

      expect(inbox.map((e) => e.id)).toEqual(["unlinked:333", "unlinked:222"]);
      expect(inbox[1]).toMatchObject({
        leadId: null,
        leadName: "Instagram: 222",
        instagramHandle: null,
        instagramScopedId: "222",
        lastMessage: { text: "we replied", direction: "outbound" },
        unreadCount: 1,
        isConnected: true,
        isLinked: false,
      });
    });

    it("never lists another user's conversations", async () => {
      store.addConversation({ userId: "user_2", externalId: "999" });
      expect(await listInbox()).toEqual([]);
    });
  });

  describe("GetInboxMessages", () => {
    it("merges the messages of every conversation of a lead key, oldest first", async () => {
      const lead = store.addLead();
      const c1 = store.addConversation({ leadId: lead.id, accountId: "acc_a" });
      const c2 = store.addConversation({ leadId: lead.id, accountId: "acc_b" });
      store.addMessage({ conversationId: c2.id, body: "second", createdAt: at("2026-11-04T10:00:00Z") });
      store.addMessage({ conversationId: c1.id, body: "first", createdAt: at("2026-11-04T09:00:00Z") });
      store.addMessage({ conversationId: "other", body: "not mine" });

      const messages = await new GetInboxMessages({
        conversationRepository: store.conversationRepository(),
        messageRepository: store.messageRepository(),
      }).execute("user_1", parseInboxKey(`lead:${lead.id}`)!);

      expect(messages.map((m) => m.body)).toEqual(["first", "second"]);
    });

    it("resolves an unlinked key to the participant's conversations without a lead", async () => {
      const unlinked = store.addConversation({ externalId: "444" });
      const linked = store.addConversation({ externalId: "444", leadId: "lead_x", accountId: "acc_b" });
      store.addMessage({ conversationId: unlinked.id, body: "unlinked" });
      store.addMessage({ conversationId: linked.id, body: "linked" });

      const messages = await new GetInboxMessages({
        conversationRepository: store.conversationRepository(),
        messageRepository: store.messageRepository(),
      }).execute("user_1", parseInboxKey("unlinked:444")!);

      expect(messages.map((m) => m.body)).toEqual(["unlinked"]);
    });

    it("returns nothing for another user's key", async () => {
      const foreign = store.addConversation({ userId: "user_2", externalId: "555" });
      store.addMessage({ userId: "user_2", conversationId: foreign.id });

      const messages = await new GetInboxMessages({
        conversationRepository: store.conversationRepository(),
        messageRepository: store.messageRepository(),
      }).execute("user_1", parseInboxKey("unlinked:555")!);

      expect(messages).toEqual([]);
    });
  });

  describe("MarkInboxRead", () => {
    it("zeroes unread_count on every conversation of the key and sets read_at on their legacy activities", async () => {
      const { lead, c1, c2 } = leadWithTwoConversations();

      const ids = await markRead(`lead:${lead.id}`);

      expect(ids.sort()).toEqual([c1.id, c2.id].sort());
      expect(store.conversations.map((c) => c.unreadCount)).toEqual([0, 0]);
      expect(store.activities.every((a) => a.readAt !== null)).toBe(true);
    });

    it("does nothing for a key with no conversations", async () => {
      expect(await markRead("unlinked:000")).toEqual([]);
    });
  });

  describe("DeleteInboxConversations", () => {
    it("deletes every conversation of a lead key, their messages and the lead's legacy activities", async () => {
      const { lead } = leadWithTwoConversations();
      const other = store.addConversation({ externalId: "777" });
      store.addMessage({ conversationId: other.id });
      const otherActivity = store.addLegacyActivity({ title: "Instagram DM from 777" });

      await remove(`lead:${lead.id}`);

      expect(store.conversations.map((c) => c.id)).toEqual([other.id]);
      expect(store.messages.map((m) => m.conversationId)).toEqual([other.id]);
      expect(store.activities.map((a) => a.id)).toEqual([otherActivity.id]);
    });

    it("deletes an unlinked key's conversations and legacy activities, including never-copied ones", async () => {
      store.addConversation({ externalId: "888" });
      store.addLegacyActivity({ title: "Instagram DM to 888" });
      store.addLegacyActivity({ title: "Instagram DM from 888" });
      const kept = store.addLegacyActivity({ title: "Instagram DM from 888", leadId: "lead_z" });

      await remove("unlinked:888");

      expect(store.conversations).toEqual([]);
      expect(store.activities.map((a) => a.id)).toEqual([kept.id]);
    });

    it("leaves another user's conversations untouched", async () => {
      store.addConversation({ userId: "user_2", externalId: "999" });
      store.addLegacyActivity({ userId: "user_2", title: "Instagram DM from 999" });

      await remove("unlinked:999");

      expect(store.conversations).toHaveLength(1);
      expect(store.activities).toHaveLength(1);
    });
  });

  describe("LinkInboxConversations", () => {
    const link = (participantId: string, leadId: string) =>
      new LinkInboxConversations({
        conversationRepository: store.conversationRepository(),
        legacyActivityRepository: store.legacyActivityRepository(),
        leadLookup: store.leadLookup(),
      }).execute("user_1", participantId, leadId);

    it("links every unlinked conversation of the participant and their legacy activities", async () => {
      const lead = store.addLead();
      store.addConversation({ externalId: "121", accountId: "acc_a" });
      store.addConversation({ externalId: "121", accountId: "acc_b" });
      store.addLegacyActivity({ title: "Instagram DM from 121" });
      store.addLegacyActivity({ title: "Instagram DM to 121" });

      expect(await link("121", lead.id)).toBe("linked");

      expect(store.conversations.map((c) => c.leadId)).toEqual([lead.id, lead.id]);
      expect(store.activities.map((a) => a.leadId)).toEqual([lead.id, lead.id]);
    });

    it("returns lead_not_found for a lead the user does not own, changing nothing", async () => {
      const foreignLead = store.addLead({ userId: "user_2" });
      store.addConversation({ externalId: "131" });

      expect(await link("131", foreignLead.id)).toBe("lead_not_found");
      expect(store.conversations[0].leadId).toBeNull();
    });
  });

  describe("CountUnreadMessages", () => {
    it("sums unread_count over the user's conversations only", async () => {
      store.addConversation({ unreadCount: 2 });
      store.addConversation({ unreadCount: 1, accountId: "acc_b" });
      store.addConversation({ userId: "user_2", unreadCount: 5 });

      const count = await new CountUnreadMessages({
        conversationRepository: store.conversationRepository(),
      }).execute("user_1");

      expect(count).toBe(3);
    });
  });
});
