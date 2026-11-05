/**
 * @jest-environment node
 *
 * Tenant isolation for the Instagram webhook: an inbound message must be
 * attributed to the user who owns the receiving Instagram account, and lead
 * linking must never cross user boundaries.
 *
 * Runs the real route, messaging module, repositories and channel parser
 * against an in-memory stand-in for supabase-js; the SQL functions the
 * module calls are modelled after their migration (message + legacy activity
 * written with the conversation's user_id and lead_id).
 */

process.env.META_APP_SECRET = "test_app_secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

const db: Record<string, Row[]> = {};
let nextId = 1;
const NOW = "2026-11-04T10:00:00.000Z";

/** When set, queries for which it returns true resolve with a PostgREST error. */
let failWhen: ((table: string) => boolean) | null = null;
const dbError = { message: "canceling statement due to statement timeout" };

/** Minimal in-memory stand-in for the supabase-js query builder. */
function query(table: string) {
  const filters: Filter[] = [];
  let max = Infinity;
  let op: "select" | "upsert" | "update" | "insert" = "select";
  let values: Row = {};
  let conflictCols: string[] = [];
  let returning = false;
  const rows = () => (db[table] ??= []);

  function execute(): { data: unknown; error: unknown } {
    if (failWhen?.(table)) return { data: null, error: dbError };
    if (op === "upsert") {
      const clash = rows().find((r) => conflictCols.every((c) => r[c] === values[c]));
      if (clash) return { data: [], error: null };
      const row = { id: `id-${nextId++}`, created_at: NOW, updated_at: NOW, ...values };
      rows().push(row);
      return { data: returning ? [row] : null, error: null };
    }
    if (op === "insert") {
      const row = { id: `id-${nextId++}`, created_at: NOW, updated_at: NOW, ...values };
      rows().push(row);
      return { data: [row], error: null };
    }
    const matched = rows().filter((r) => filters.every((f) => f(r)));
    if (op === "update") matched.forEach((r) => Object.assign(r, values));
    return { data: matched.slice(0, max), error: null };
  }

  const builder = {
    select: () => {
      returning = true;
      return builder;
    },
    upsert: (row: Row, opts: { onConflict: string }) => {
      op = "upsert";
      values = row;
      conflictCols = opts.onConflict.split(",");
      return builder;
    },
    update: (patch: Row) => {
      op = "update";
      values = patch;
      return builder;
    },
    insert: (row: Row) => {
      op = "insert";
      values = row;
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    or: (expr: string) => {
      const clauses = expr.split(",").map((c) => {
        const [col, operator, ...rest] = c.split(".");
        if (operator !== "eq") throw new Error(`unsupported or-op ${operator}`);
        return { col, val: rest.join(".") };
      });
      filters.push((r) => clauses.some(({ col, val }) => r[col] === val));
      return builder;
    },
    order: () => builder,
    limit: (n: number) => {
      max = n;
      return builder;
    },
    maybeSingle: async () => {
      const { data, error } = execute();
      if (error) return { data: null, error };
      const list = data as Row[];
      if (list.length > 1) return { data: null, error: { message: "multiple rows" } };
      return { data: list[0] ?? null, error: null };
    },
    single: async () => {
      const { data, error } = execute();
      if (error) return { data: null, error };
      return { data: (data as Row[])[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(execute()).then(resolve, reject),
  };
  return builder;
}

/** The messaging SQL functions the inbound path calls (migration 20261103000000). */
async function rpc(fn: string, args: Row) {
  if (fn === "messaging_start_attempt") {
    const event = (db.webhook_events ?? []).find(
      (e) => e.event_id === args.p_event_id && e.status === "received"
    );
    if (!event) return { data: [], error: null };
    event.attempts = (event.attempts as number) + 1;
    return { data: [{ event_id: event.event_id, attempts: event.attempts, payload: event.payload }], error: null };
  }
  if (fn === "messaging_ingest_inbound") {
    const conversation = (db.conversations ?? []).find((c) => c.id === args.p_conversation_id)!;
    const messageId = `msg-${nextId++}`;
    (db.messages ??= []).push({
      id: messageId,
      user_id: conversation.user_id,
      conversation_id: conversation.id,
      direction: "in",
      external_id: args.p_external_id,
      body: args.p_body,
    });
    (db.activities ??= []).push({
      user_id: conversation.user_id,
      lead_id: conversation.lead_id,
      type: "INSTAGRAM_MESSAGE",
      title: (args.p_legacy as Row).title,
      description: args.p_body,
    });
    return { data: { inserted: true, message_id: messageId }, error: null };
  }
  throw new Error(`unexpected rpc ${fn}`);
}

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: (table: string) => query(table), rpc })),
}));

jest.mock("@/infrastructure/services/InstagramMessagingService", () => ({
  InstagramMessagingService: jest.fn().mockImplementation(() => ({
    verifyMetaSignature: jest.fn().mockResolvedValue(true),
  })),
}));

const backgroundTasks: Array<() => Promise<void>> = [];
jest.mock("@/lib/runtime/background", () => ({
  runInBackground: (task: () => Promise<void>) => {
    backgroundTasks.push(task);
  },
}));

import { NextRequest } from "next/server";
import { POST } from "../route";

function inbound(recipientId: string, senderId = "sender-1") {
  return new NextRequest("http://localhost:3000/api/webhook/instagram", {
    method: "POST",
    headers: { "X-Hub-Signature-256": "sha256=valid" },
    body: JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: recipientId,
          time: 1721084400000,
          messaging: [
            {
              sender: { id: senderId },
              recipient: { id: recipientId },
              message: { mid: `mid-${recipientId}`, text: "Hola" },
              timestamp: 1721084400000,
            },
          ],
        },
      ],
    }),
  });
}

/** Posts the delivery and runs the processing it scheduled. */
async function deliver(recipientId: string) {
  const response = await POST(inbound(recipientId));
  for (const task of backgroundTasks.splice(0)) await task();
  return response;
}

const inboundActivities = () =>
  (db.activities ?? []).filter((a) => a.title === "Instagram DM from sender-1");
const eventStatus = () => (db.webhook_events ?? [])[0]?.status;

function account(id: string, userId: string, igId: string, pageId: string | null, status = "connected") {
  return {
    id,
    user_id: userId,
    channel: "instagram",
    external_account_id: igId,
    page_id: pageId,
    display_name: null,
    status,
    created_at: NOW,
    updated_at: NOW,
  };
}

beforeEach(() => {
  failWhen = null;
  backgroundTasks.length = 0;
  for (const k of Object.keys(db)) delete db[k];
  db.channel_accounts = [
    account("acc-a", "user-a", "ig-a", "page-a"),
    account("acc-b", "user-b", "ig-b", "page-b"),
  ];
  db.webhook_events = [];
  db.conversations = [];
  db.leads = [];
  db.activities = [];
  // The webhook_events default status/attempts come from the table definition.
  const originalPush = db.webhook_events.push.bind(db.webhook_events);
  db.webhook_events.push = (...events: Row[]) =>
    originalPush(...events.map((e) => ({ status: "received", attempts: 0, ...e })));
});

describe("POST /api/webhook/instagram — tenant isolation", () => {
  it("attributes the message to the user whose account id matches the recipient", async () => {
    const res = await deliver("ig-b");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "received" });
    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-b");
    expect(db.conversations).toEqual([
      expect.objectContaining({ user_id: "user-b", account_id: "acc-b", external_id: "sender-1" }),
    ]);
    expect(eventStatus()).toBe("processed");
  });

  it("also matches the recipient against the account page id", async () => {
    await deliver("page-a");

    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-a");
  });

  it("only links leads that belong to the owning user", async () => {
    db.leads = [
      { id: "lead-of-a", user_id: "user-a", instagram_scoped_id: "sender-1" },
      { id: "lead-of-b", user_id: "user-b", instagram_scoped_id: "sender-1" },
    ];

    await deliver("ig-b");

    expect(inboundActivities()[0].lead_id).toBe("lead-of-b");
  });

  it("does not link a lead owned by another user", async () => {
    db.leads = [{ id: "lead-of-a", user_id: "user-a", instagram_scoped_id: "sender-1" }];

    await deliver("ig-b");

    expect(inboundActivities()[0].user_id).toBe("user-b");
    expect(inboundActivities()[0].lead_id).toBeNull();
  });

  it("never reuses another user's conversation or its lead link for the same participant", async () => {
    db.conversations = [
      {
        id: "conv-of-a",
        user_id: "user-a",
        account_id: "acc-a",
        channel: "instagram",
        external_id: "sender-1",
        lead_id: "lead-of-a",
        unread_count: 0,
        metadata: {},
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    await deliver("ig-b");

    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-b");
    expect(inboundActivities()[0].lead_id).toBeNull();
    expect(db.messages).toEqual([expect.objectContaining({ user_id: "user-b" })]);
  });

  it("drops the message when the recipient matches no account and several are connected", async () => {
    const res = await deliver("ig-unknown");

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
    expect(eventStatus()).toBe("ignored");
  });

  it("falls back to the only connected account when the recipient id does not match", async () => {
    db.channel_accounts = [
      account("acc-a", "user-a", "app-scoped-id", "app-scoped-id"),
      account("acc-legacy", "user-b", "legacy:user-b", null, "disconnected"),
    ];

    await deliver("ig-professional-id");

    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-a");
  });

  it("drops the message when the recipient id matches accounts of more than one user", async () => {
    db.channel_accounts = [
      account("acc-a", "user-a", "shared-id", "page-a"),
      account("acc-b", "user-b", "ig-b", "shared-id"),
    ];

    const res = await deliver("shared-id");

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
    expect(eventStatus()).toBe("ignored");
  });

  it("never uses a recipient id with filter syntax in the lookup", async () => {
    // A crafted id like "x,external_account_id.eq.ig-a" would inject an extra
    // clause into the PostgREST or() filter and match another user's row.
    const res = await deliver("x,external_account_id.eq.ig-a");

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
  });

  it("keeps the event for the retry sweep when the owner lookup fails", async () => {
    failWhen = (table) => table === "channel_accounts";

    const res = await deliver("ig-b");

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
    expect(db.webhook_events[0]).toEqual(expect.objectContaining({ status: "received", attempts: 1 }));
  });

  it("creates no activity when no account is connected", async () => {
    db.channel_accounts = [];

    const res = await deliver("ig-a");

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
    expect(eventStatus()).toBe("ignored");
  });
});
