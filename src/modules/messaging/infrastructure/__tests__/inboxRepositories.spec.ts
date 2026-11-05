/**
 * @jest-environment node
 *
 * Supabase adapters behind the inbox readers and key operations (S10, S12,
 * ADR-2, ADR-11): every query is scoped by the explicit user id.
 */
import { createSupabaseQueryMock } from "../testing/supabaseQueryMock";
import { SupabaseConversationRepository } from "../repositories/SupabaseConversationRepository";
import { SupabaseMessageRepository } from "../repositories/SupabaseMessageRepository";
import { SupabaseLeadLookup } from "../repositories/SupabaseLeadLookup";
import { SupabaseLegacyActivityRepository } from "../repositories/SupabaseLegacyActivityRepository";

const conversationRow = {
  id: "conv_1",
  user_id: "user_1",
  lead_id: null,
  account_id: "acc_1",
  channel: "instagram",
  external_id: "igsid_1",
  participant_name: null,
  last_inbound_at: null,
  last_message_at: null,
  last_message_preview: null,
  unread_count: 2,
  metadata: {},
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-02T00:00:00.000Z",
};

describe("SupabaseConversationRepository (inbox)", () => {
  it("lists the user's conversations, most recent first", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [conversationRow] });

    const list = await new SupabaseConversationRepository(db.client).listByUser("user_1");

    expect(list.map((c) => c.id)).toEqual(["conv_1"]);
    expect(db.queries[0].table).toBe("conversations");
    expect(db.callsOf(0)).toEqual([
      ["select", "*"],
      ["eq", "user_id", "user_1"],
      ["order", "last_message_at", { ascending: false, nullsFirst: false }],
    ]);
  });

  it("resolves a lead key to every conversation of the lead", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [conversationRow] });

    await new SupabaseConversationRepository(db.client).findByInboxKey("user_1", {
      kind: "lead",
      leadId: "lead_1",
    });

    expect(db.callsOf(0)).toEqual([
      ["select", "*"],
      ["eq", "user_id", "user_1"],
      ["eq", "lead_id", "lead_1"],
    ]);
  });

  it("resolves an unlinked key to the participant's conversations without a lead", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] });

    await new SupabaseConversationRepository(db.client).findByInboxKey("user_1", {
      kind: "unlinked",
      participantId: "igsid_1",
    });

    expect(db.callsOf(0)).toEqual([
      ["select", "*"],
      ["eq", "user_id", "user_1"],
      ["eq", "external_id", "igsid_1"],
      ["is", "lead_id", null],
    ]);
  });

  it("links and deletes only the user's conversations with the given ids", async () => {
    const db = createSupabaseQueryMock();
    const repo = new SupabaseConversationRepository(db.client);

    await repo.linkToLead("user_1", ["c1", "c2"], "lead_1");
    await repo.deleteByIds("user_1", ["c1", "c2"]);

    expect(db.callsOf(0)).toEqual([
      ["update", { lead_id: "lead_1", updated_at: expect.any(String) }],
      ["eq", "user_id", "user_1"],
      ["in", "id", ["c1", "c2"]],
    ]);
    expect(db.callsOf(1)).toEqual([
      ["delete"],
      ["eq", "user_id", "user_1"],
      ["in", "id", ["c1", "c2"]],
    ]);
  });

  it("sums unread_count over the user's conversations", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [{ unread_count: 2 }, { unread_count: 1 }] });

    const count = await new SupabaseConversationRepository(db.client).sumUnreadCount("user_1");

    expect(count).toBe(3);
    expect(db.callsOf(0)).toEqual([
      ["select", "unread_count"],
      ["eq", "user_id", "user_1"],
      ["gt", "unread_count", 0],
    ]);
  });

  it("throws on query errors", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ error: { message: "boom" } });

    await expect(
      new SupabaseConversationRepository(db.client).sumUnreadCount("user_1")
    ).rejects.toThrow("boom");
  });
});

describe("SupabaseMessageRepository.findByConversations", () => {
  it("merges the conversations' messages oldest first, and skips the query for no ids", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [] });
    const repo = new SupabaseMessageRepository(db.client);

    await repo.findByConversations(["c1", "c2"]);
    expect(await repo.findByConversations([])).toEqual([]);

    expect(db.queries).toHaveLength(1);
    expect(db.callsOf(0)).toEqual([
      ["select", "*"],
      ["in", "conversation_id", ["c1", "c2"]],
      ["order", "created_at", { ascending: true }],
    ]);
  });
});

describe("SupabaseLeadLookup (inbox)", () => {
  it("maps the user's lead summaries", async () => {
    const db = createSupabaseQueryMock();
    db.respond({
      data: [{ id: "lead_1", name: "Ana", instagram_handle: "ana", instagram_scoped_id: "111" }],
    });

    const leads = await new SupabaseLeadLookup(db.client).findSummaries("user_1", ["lead_1"]);

    expect(leads).toEqual([
      { id: "lead_1", name: "Ana", instagramHandle: "ana", instagramScopedId: "111" },
    ]);
    expect(db.callsOf(0)).toEqual([
      ["select", "id, name, instagram_handle, instagram_scoped_id"],
      ["eq", "user_id", "user_1"],
      ["in", "id", ["lead_1"]],
    ]);
  });

  it("checks that the user owns a lead", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: { id: "lead_1" } }, { data: null });
    const lookup = new SupabaseLeadLookup(db.client);

    expect(await lookup.exists("user_1", "lead_1")).toBe(true);
    expect(await lookup.exists("user_1", "lead_2")).toBe(false);
    expect(db.callsOf(0)).toEqual([
      ["select", "id"],
      ["eq", "user_id", "user_1"],
      ["eq", "id", "lead_1"],
      ["maybeSingle"],
    ]);
  });
});

describe("SupabaseLegacyActivityRepository", () => {
  const titleFilter =
    "title.ilike.Instagram DM from igsid_1,title.ilike.Instagram DM to igsid_1";

  it("deletes a lead key's Instagram activities by lead_id", async () => {
    const db = createSupabaseQueryMock();

    await new SupabaseLegacyActivityRepository(db.client).deleteForKey("user_1", {
      kind: "lead",
      leadId: "lead_1",
    });

    expect(db.queries[0].table).toBe("activities");
    expect(db.callsOf(0)).toEqual([
      ["delete"],
      ["eq", "user_id", "user_1"],
      ["eq", "type", "INSTAGRAM_MESSAGE"],
      ["eq", "lead_id", "lead_1"],
    ]);
  });

  it("deletes an unlinked key's activities by title, without a lead", async () => {
    const db = createSupabaseQueryMock();

    await new SupabaseLegacyActivityRepository(db.client).deleteForKey("user_1", {
      kind: "unlinked",
      participantId: "igsid_1",
    });

    expect(db.callsOf(0)).toEqual([
      ["delete"],
      ["eq", "user_id", "user_1"],
      ["eq", "type", "INSTAGRAM_MESSAGE"],
      ["is", "lead_id", null],
      ["or", titleFilter],
    ]);
  });

  it("links a participant's unlinked activities to a lead", async () => {
    const db = createSupabaseQueryMock();

    await new SupabaseLegacyActivityRepository(db.client).linkParticipantToLead(
      "user_1",
      "igsid_1",
      "lead_1"
    );

    expect(db.callsOf(0)).toEqual([
      ["update", { lead_id: "lead_1" }],
      ["eq", "user_id", "user_1"],
      ["eq", "type", "INSTAGRAM_MESSAGE"],
      ["is", "lead_id", null],
      ["or", titleFilter],
    ]);
  });

  it("rejects participant ids that would inject filter syntax", async () => {
    const db = createSupabaseQueryMock();

    await expect(
      new SupabaseLegacyActivityRepository(db.client).linkParticipantToLead(
        "user_1",
        "1,lead_id.eq.x",
        "lead_1"
      )
    ).rejects.toThrow("Unsafe participant id");
    expect(db.queries).toHaveLength(0);
  });
});
