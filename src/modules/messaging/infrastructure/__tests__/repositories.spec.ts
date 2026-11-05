/**
 * @jest-environment node
 *
 * Supabase repositories of the messaging module (ADR-2, ADR-4, ADR-7, S4, S5,
 * S7): exact tables, filters, upsert options and rpc calls, with explicit ids
 * (no session user).
 */
import { createSupabaseQueryMock } from "../testing/supabaseQueryMock";
import { SupabaseChannelAccountRepository } from "../repositories/SupabaseChannelAccountRepository";
import { SupabaseConversationRepository } from "../repositories/SupabaseConversationRepository";
import { SupabaseMessageRepository } from "../repositories/SupabaseMessageRepository";
import { SupabaseWebhookEventRepository } from "../repositories/SupabaseWebhookEventRepository";
import { SupabaseLeadLookup } from "../repositories/SupabaseLeadLookup";
import { Channel } from "../../domain/enums/Channel";
import { MessageDirection } from "../../domain/enums/MessageDirection";
import { MessageOrigin } from "../../domain/enums/MessageOrigin";
import { MessageStatus } from "../../domain/enums/MessageStatus";

const accountRow = {
  id: "acc_1",
  user_id: "user_1",
  channel: "instagram",
  external_account_id: "ig_1",
  page_id: "page_1",
  display_name: null,
  status: "connected",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-02T00:00:00.000Z",
};

const conversationRow = {
  id: "conv_1",
  user_id: "user_1",
  lead_id: null,
  account_id: "acc_1",
  channel: "instagram",
  external_id: "igsid_1",
  participant_name: null,
  last_inbound_at: "2026-11-03T10:00:00.000Z",
  last_message_at: null,
  last_message_preview: null,
  unread_count: 2,
  metadata: { a: 1 },
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-02T00:00:00.000Z",
};

const messageRow = {
  id: "msg_1",
  user_id: "user_1",
  conversation_id: "conv_1",
  direction: "out",
  origin: "human",
  type: "text",
  body: "Hola",
  external_id: null,
  status: "pending",
  error_message: null,
  hint: null,
  legacy_activity_id: null,
  raw_payload: null,
  created_at: "2026-11-03T10:00:00.000Z",
  delivered_at: null,
  read_at: null,
  updated_at: "2026-11-03T10:00:00.000Z",
};

describe("SupabaseChannelAccountRepository", () => {
  it("finds an account by external_account_id or page_id within the channel", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [accountRow] });

    const account = await new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(
      Channel.INSTAGRAM,
      "page_1"
    );

    expect(db.queries[0].table).toBe("channel_accounts");
    expect(db.callsOf(0)).toEqual([
      ["select", "*"],
      ["eq", "channel", "instagram"],
      ["or", "external_account_id.eq.page_1,page_id.eq.page_1"],
    ]);
    expect(account).toEqual({
      id: "acc_1",
      userId: "user_1",
      channel: Channel.INSTAGRAM,
      externalAccountId: "ig_1",
      pageId: "page_1",
      displayName: null,
      status: "connected",
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
      updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    });
  });

  it("prefers the external_account_id match when both columns match different rows", async () => {
    const db = createSupabaseQueryMock();
    db.respond({
      data: [
        { ...accountRow, id: "acc_page", external_account_id: "other", page_id: "x_1" },
        { ...accountRow, id: "acc_ig", external_account_id: "x_1", page_id: null },
      ],
    });

    const account = await new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(
      Channel.INSTAGRAM,
      "x_1"
    );

    expect(account?.id).toBe("acc_ig");
  });

  it("returns null when nothing matches", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] });

    await expect(
      new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(Channel.INSTAGRAM, "ig_9")
    ).resolves.toBeNull();
  });

  it("returns null when the id matches accounts of several users (tenant guard)", async () => {
    const db = createSupabaseQueryMock();
    db.respond({
      data: [
        { ...accountRow, id: "acc_a", user_id: "user_a", external_account_id: "shared" },
        { ...accountRow, id: "acc_b", user_id: "user_b", external_account_id: "ig_b", page_id: "shared" },
      ],
    });

    const account = await new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(
      Channel.INSTAGRAM,
      "shared"
    );

    expect(account).toBeNull();
    expect(db.queries).toHaveLength(1);
  });

  it("falls back to the only connected account when the id matches nothing (ADR-7)", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] }, { data: [accountRow] });

    const account = await new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(
      Channel.INSTAGRAM,
      "ig_professional"
    );

    expect(account?.id).toBe("acc_1");
    expect(db.callsOf(1)).toEqual([
      ["select", "*"],
      ["eq", "channel", "instagram"],
      ["eq", "status", "connected"],
      ["limit", 2],
    ]);
  });

  it("does not fall back when several accounts are connected", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] }, { data: [accountRow, { ...accountRow, id: "acc_2", user_id: "user_2" }] });

    await expect(
      new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(Channel.INSTAGRAM, "ig_9")
    ).resolves.toBeNull();
  });

  it("throws when the fallback lookup fails, so the event is retried", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] }, { error: { message: "timeout" } });

    await expect(
      new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(Channel.INSTAGRAM, "ig_9")
    ).rejects.toThrow("timeout");
  });

  it.each([["a,b"], ["x.eq.1"], ["id)"], [""], ["ig 1"]])(
    "returns null without querying for an unsafe id %p",
    async (unsafe) => {
      const db = createSupabaseQueryMock();

      const account = await new SupabaseChannelAccountRepository(
        db.client
      ).findByExternalAccountId(Channel.INSTAGRAM, unsafe);

      expect(account).toBeNull();
      expect(db.queries).toHaveLength(0);
    }
  );

  it("throws on a query error", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ error: { message: "boom" } });

    await expect(
      new SupabaseChannelAccountRepository(db.client).findByExternalAccountId(Channel.INSTAGRAM, "ig_1")
    ).rejects.toThrow("boom");
  });

  it("finds by id and by user id", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: accountRow }, { data: [accountRow] });
    const repo = new SupabaseChannelAccountRepository(db.client);

    await expect(repo.findById("acc_1")).resolves.toMatchObject({ id: "acc_1" });
    await expect(repo.findByUserId("user_1")).resolves.toHaveLength(1);

    expect(db.callsOf(0)).toEqual([["select", "*"], ["eq", "id", "acc_1"], ["maybeSingle"]]);
    expect(db.callsOf(1)).toEqual([
      ["select", "*"],
      ["eq", "user_id", "user_1"],
      ["order", "created_at", { ascending: true }],
    ]);
  });

  it("creates an account with the explicit user id", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: accountRow });

    await new SupabaseChannelAccountRepository(db.client).create({
      userId: "user_1",
      channel: Channel.INSTAGRAM,
      externalAccountId: "ig_1",
      pageId: "page_1",
      displayName: null,
      status: "connected",
    });

    expect(db.callsOf(0)).toEqual([
      [
        "insert",
        {
          user_id: "user_1",
          channel: "instagram",
          external_account_id: "ig_1",
          page_id: "page_1",
          display_name: null,
          status: "connected",
        },
      ],
      ["select", "*"],
      ["single"],
    ]);
  });
});

describe("SupabaseConversationRepository", () => {
  const newConversation = {
    userId: "user_1",
    leadId: null,
    accountId: "acc_1",
    channel: Channel.INSTAGRAM,
    externalId: "igsid_1",
    participantName: null,
    lastInboundAt: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCount: 0,
    metadata: {},
  };

  it("findOrCreate inserts ignoring duplicates and then selects the pair", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: null }, { data: conversationRow });

    const conversation = await new SupabaseConversationRepository(db.client).findOrCreate(
      newConversation
    );

    expect(db.queries.map((q) => q.table)).toEqual(["conversations", "conversations"]);
    expect(db.callsOf(0)).toEqual([
      [
        "upsert",
        {
          user_id: "user_1",
          lead_id: null,
          account_id: "acc_1",
          channel: "instagram",
          external_id: "igsid_1",
          participant_name: null,
          last_inbound_at: null,
          last_message_at: null,
          last_message_preview: null,
          unread_count: 0,
          metadata: {},
        },
        { onConflict: "account_id,external_id", ignoreDuplicates: true },
      ],
    ]);
    expect(db.callsOf(1)).toEqual([
      ["select", "*"],
      ["eq", "account_id", "acc_1"],
      ["eq", "external_id", "igsid_1"],
      ["maybeSingle"],
    ]);
    expect(conversation).toMatchObject({
      id: "conv_1",
      accountId: "acc_1",
      externalId: "igsid_1",
      unreadCount: 2,
      lastInboundAt: new Date("2026-11-03T10:00:00.000Z"),
      lastMessageAt: null,
      metadata: { a: 1 },
    });
  });

  it("findOrCreate returns the row another run created concurrently", async () => {
    const db = createSupabaseQueryMock();
    // the insert hits the conflict and does nothing (no error), the select finds the row
    db.respond({ data: null, error: null }, { data: { ...conversationRow, id: "conv_other" } });

    const conversation = await new SupabaseConversationRepository(db.client).findOrCreate(
      newConversation
    );

    expect(conversation.id).toBe("conv_other");
  });

  it("findOrCreate throws when the insert fails", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ error: { message: "insert failed" } });

    await expect(
      new SupabaseConversationRepository(db.client).findOrCreate(newConversation)
    ).rejects.toThrow("insert failed");
  });

  it("findOrCreate refuses a conversation without account (not race-safe)", async () => {
    const db = createSupabaseQueryMock();

    await expect(
      new SupabaseConversationRepository(db.client).findOrCreate({
        ...newConversation,
        accountId: null,
      })
    ).rejects.toThrow("accountId");
    expect(db.queries).toHaveLength(0);
  });

  it("updates only the given fields, in snake_case", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: { ...conversationRow, lead_id: "lead_1" } });

    const conversation = await new SupabaseConversationRepository(db.client).update("conv_1", {
      leadId: "lead_1",
      lastMessageAt: new Date("2026-11-04T00:00:00.000Z"),
    });

    expect(db.callsOf(0)).toEqual([
      ["update", { lead_id: "lead_1", last_message_at: "2026-11-04T00:00:00.000Z" }],
      ["eq", "id", "conv_1"],
      ["select", "*"],
      ["single"],
    ]);
    expect(conversation.leadId).toBe("lead_1");
  });

  it("finds by id, by pair and by lead", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: null }, { data: conversationRow }, { data: [conversationRow] });
    const repo = new SupabaseConversationRepository(db.client);

    await expect(repo.findById("conv_x")).resolves.toBeNull();
    await expect(repo.findByAccountAndExternalId("acc_1", "igsid_1")).resolves.toMatchObject({
      id: "conv_1",
    });
    await expect(repo.findByLeadId("lead_1")).resolves.toHaveLength(1);

    expect(db.callsOf(0)).toEqual([["select", "*"], ["eq", "id", "conv_x"], ["maybeSingle"]]);
    expect(db.callsOf(2)).toEqual([
      ["select", "*"],
      ["eq", "lead_id", "lead_1"],
      ["order", "last_message_at", { ascending: false, nullsFirst: false }],
    ]);
  });
});

describe("SupabaseMessageRepository", () => {
  it("creates a message and maps it back", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: messageRow });

    const message = await new SupabaseMessageRepository(db.client).create({
      userId: "user_1",
      conversationId: "conv_1",
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
      deliveredAt: null,
      readAt: null,
    });

    expect(db.queries[0].table).toBe("messages");
    expect(db.callsOf(0)).toEqual([
      [
        "insert",
        {
          user_id: "user_1",
          conversation_id: "conv_1",
          direction: "out",
          origin: "human",
          type: "text",
          body: "Hola",
          external_id: null,
          status: "pending",
          error_message: null,
          hint: null,
          legacy_activity_id: null,
          raw_payload: null,
          delivered_at: null,
          read_at: null,
        },
      ],
      ["select", "*"],
      ["single"],
    ]);
    expect(message).toMatchObject({
      id: "msg_1",
      direction: MessageDirection.OUTBOUND,
      origin: MessageOrigin.HUMAN,
      status: MessageStatus.PENDING,
      createdAt: new Date("2026-11-03T10:00:00.000Z"),
      deliveredAt: null,
    });
  });

  it("markFailedIfPending updates only a pending row and returns the row as it ends up", async () => {
    const db = createSupabaseQueryMock();
    db.respond(
      { data: null },
      { data: { ...messageRow, status: "failed", error_message: "e", hint: "h" } }
    );

    const message = await new SupabaseMessageRepository(db.client).markFailedIfPending(
      "msg_1",
      "e",
      "h"
    );

    expect(db.callsOf(0)).toEqual([
      ["update", expect.objectContaining({ status: "failed", error_message: "e", hint: "h" })],
      ["eq", "id", "msg_1"],
      ["eq", "status", "pending"],
    ]);
    expect(db.callsOf(1)).toEqual([["select", "*"], ["eq", "id", "msg_1"], ["maybeSingle"]]);
    expect(message).toMatchObject({ status: MessageStatus.FAILED, errorMessage: "e", hint: "h" });
  });

  it("markFailedIfPending returns an echo-adopted row unchanged", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: null }, { data: { ...messageRow, status: "sent", external_id: "m_echo" } });

    const message = await new SupabaseMessageRepository(db.client).markFailedIfPending(
      "msg_1",
      "e",
      "h"
    );

    expect(message).toMatchObject({ status: MessageStatus.SENT, externalId: "m_echo", hint: null });
  });

  it("finds by id, external id and conversation", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: messageRow }, { data: null }, { data: [messageRow] });
    const repo = new SupabaseMessageRepository(db.client);

    await repo.findById("msg_1");
    await expect(repo.findByExternalId("m_1")).resolves.toBeNull();
    await expect(repo.findByConversation("conv_1")).resolves.toHaveLength(1);

    expect(db.callsOf(1)).toEqual([["select", "*"], ["eq", "external_id", "m_1"], ["maybeSingle"]]);
    expect(db.callsOf(2)).toEqual([
      ["select", "*"],
      ["eq", "conversation_id", "conv_1"],
      ["order", "created_at", { ascending: true }],
    ]);
  });
});

describe("SupabaseWebhookEventRepository", () => {
  const now = new Date("2026-11-04T12:00:00.000Z");
  const repo = (db: ReturnType<typeof createSupabaseQueryMock>) =>
    new SupabaseWebhookEventRepository(db.client, () => now);

  it("claims with one upsert that ignores duplicates", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [{ event_id: "sha:1" }] });

    const claimed = await repo(db).claim("sha:1", "instagram", { entry: [] });

    expect(db.queries[0].table).toBe("webhook_events");
    expect(db.callsOf(0)).toEqual([
      [
        "upsert",
        { event_id: "sha:1", provider: "instagram", payload: { entry: [] } },
        { onConflict: "event_id", ignoreDuplicates: true },
      ],
      ["select", "event_id"],
    ]);
    expect(claimed).toEqual({ eventId: "sha:1" });
  });

  it("returns null when the event was already claimed", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] });

    await expect(repo(db).claim("sha:1", "instagram", {})).resolves.toBeNull();
  });

  it("throws when the claim insert fails", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ error: { message: "db down" } });

    await expect(repo(db).claim("sha:1", "instagram", {})).rejects.toThrow("db down");
  });

  it("starts an attempt through messaging_start_attempt", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [{ event_id: "sha:1", attempts: 1, payload: { entry: [] } }] });

    const event = await repo(db).startAttempt("sha:1");

    expect(db.rpcs).toEqual([{ fn: "messaging_start_attempt", args: { p_event_id: "sha:1" } }]);
    expect(event).toEqual({ eventId: "sha:1", attempts: 1, payload: { entry: [] } });
  });

  it("returns null when the event is missing or no longer received", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] });

    await expect(repo(db).startAttempt("sha:1")).resolves.toBeNull();
  });

  it("claims retryable events through messaging_claim_retry", async () => {
    const db = createSupabaseQueryMock();
    db.respond({
      data: [
        { event_id: "sha:1", provider: "instagram", attempts: 2, payload: { a: 1 } },
        { event_id: "sha:2", provider: "instagram", attempts: 1, payload: { b: 2 } },
      ],
    });

    const events = await repo(db).claimRetry(5);

    expect(db.rpcs).toEqual([{ fn: "messaging_claim_retry", args: { p_limit: 5 } }]);
    expect(events).toEqual([
      { eventId: "sha:1", attempts: 2, payload: { a: 1 } },
      { eventId: "sha:2", attempts: 1, payload: { b: 2 } },
    ]);
  });

  it("throws when an rpc fails", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ error: { message: "rpc failed" } });

    await expect(repo(db).claimRetry(5)).rejects.toThrow("rpc failed");
  });

  it.each([
    ["markProcessed", "processed"],
    ["markIgnored", "ignored"],
    ["markFailed", "failed"],
  ] as const)("%s sets status %s on that event", async (method, status) => {
    const db = createSupabaseQueryMock();

    await repo(db)[method]("sha:1");

    expect(db.callsOf(0)).toEqual([
      ["update", { status }],
      ["eq", "event_id", "sha:1"],
    ]);
  });

  it("deletes processed and ignored events received more than N days ago", async () => {
    const db = createSupabaseQueryMock();

    await repo(db).deleteHandledOlderThan(30);

    expect(db.callsOf(0)).toEqual([
      ["delete"],
      ["in", "status", ["processed", "ignored"]],
      ["lt", "received_at", "2026-10-05T12:00:00.000Z"],
    ]);
  });
});

describe("SupabaseLeadLookup", () => {
  it("finds the user's lead by instagram_scoped_id", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: { id: "lead_1" } });

    const leadId = await new SupabaseLeadLookup(db.client).findLeadIdByInstagramScopedId(
      "user_1",
      "igsid_1"
    );

    expect(db.queries[0].table).toBe("leads");
    expect(db.callsOf(0)).toEqual([
      ["select", "id"],
      ["eq", "user_id", "user_1"],
      ["eq", "instagram_scoped_id", "igsid_1"],
      ["limit", 1],
      ["maybeSingle"],
    ]);
    expect(leadId).toBe("lead_1");
  });

  it("returns null when there is no such lead", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: null });

    await expect(
      new SupabaseLeadLookup(db.client).findLeadIdByInstagramScopedId("user_1", "igsid_9")
    ).resolves.toBeNull();
  });
});
