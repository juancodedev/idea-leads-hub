/**
 * @jest-environment node
 *
 * Tenant isolation for the Instagram webhook: an inbound message must be
 * attributed to the user who owns the receiving Instagram account, and lead
 * linking must never cross user boundaries.
 */

process.env.META_APP_SECRET = "test_app_secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

const db: Record<string, Row[]> = {};

/** When set, queries for which it returns true resolve with a PostgREST error. */
let failWhen: ((table: string, usedOr: boolean) => boolean) | null = null;

/** Minimal in-memory stand-in for the supabase-js query builder. */
function query(table: string) {
  const filters: Filter[] = [];
  let max = Infinity;
  let usedOr = false;
  const failed = () => failWhen?.(table, usedOr) ?? false;
  const run = () => (db[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(0, max);
  const dbError = { message: "canceling statement due to statement timeout" };

  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    not: (col: string, op: string, val: unknown) => {
      if (op === "is" && val === null) filters.push((r) => r[col] != null);
      return builder;
    },
    or: (expr: string) => {
      usedOr = true;
      const clauses = expr.split(",").map((c) => {
        const [col, op, ...rest] = c.split(".");
        if (op !== "eq") throw new Error(`unsupported or-op ${op}`);
        return { col, val: rest.join(".") };
      });
      filters.push((r) => clauses.some(({ col, val }) => r[col] === val));
      return builder;
    },
    limit: (n: number) => {
      max = n;
      return builder;
    },
    maybeSingle: async () => {
      if (failed()) return { data: null, error: dbError };
      const rows = run();
      if (rows.length > 1) return { data: null, error: { message: "multiple rows" } };
      return { data: rows[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(failed() ? { data: null, error: dbError } : { data: run(), error: null }).then(
        resolve,
        reject
      ),
    insert: async (row: Row) => {
      (db[table] ??= []).push(row);
      return { error: null };
    },
  };
  return builder;
}

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: (table: string) => query(table) })),
}));

const mockVerify = jest.fn().mockResolvedValue(true);
jest.mock("@/infrastructure/services/InstagramMessagingService", () => {
  const actual = jest.requireActual("@/infrastructure/services/InstagramMessagingService");
  return {
    InstagramMessagingService: jest.fn().mockImplementation(() => {
      const real = new actual.InstagramMessagingService();
      return {
        verifyMetaSignature: mockVerify,
        parseIncomingMessage: real.parseIncomingMessage.bind(real),
      };
    }),
  };
});

import { NextRequest } from "next/server";
import { POST } from "../route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

function inbound(recipientId: string, senderId = "sender-1") {
  return new NextRequest("http://localhost:3000/api/webhook/instagram", {
    method: "POST",
    headers: { "X-Hub-Signature-256": "sha256=valid" },
    body: JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: recipientId,
          messaging: [
            {
              sender: { id: senderId },
              recipient: { id: recipientId },
              message: { mid: "mid-1", text: "Hola" },
              timestamp: 1721084400000,
            },
          ],
        },
      ],
    }),
  });
}

const inboundActivities = () =>
  (db.activities ?? []).filter((a) => a.title === "Instagram DM from sender-1");

beforeEach(() => {
  failWhen = null;
  for (const k of Object.keys(db)) delete db[k];
  db.user_secrets = [
    { user_id: "user-a", instagram_ig_id: "ig-a", instagram_page_id: "page-a" },
    { user_id: "user-b", instagram_ig_id: "ig-b", instagram_page_id: "page-b" },
  ];
  db.leads = [];
  db.activities = [];
});

describe("POST /api/webhook/instagram — tenant isolation", () => {
  it("attributes the message to the user whose instagram_ig_id matches the recipient", async () => {
    const res = await POST(inbound("ig-b"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "received" });
    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-b");
  });

  it("also matches the recipient against instagram_page_id", async () => {
    await POST(inbound("page-a"));

    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-a");
  });

  it("only links leads that belong to the owning user", async () => {
    db.leads = [
      { id: "lead-of-a", user_id: "user-a", instagram_scoped_id: "sender-1" },
      { id: "lead-of-b", user_id: "user-b", instagram_scoped_id: "sender-1" },
    ];

    await POST(inbound("ig-b"));

    expect(inboundActivities()[0].lead_id).toBe("lead-of-b");
  });

  it("does not link a lead owned by another user", async () => {
    db.leads = [{ id: "lead-of-a", user_id: "user-a", instagram_scoped_id: "sender-1" }];

    await POST(inbound("ig-b"));

    expect(inboundActivities()[0].user_id).toBe("user-b");
    expect(inboundActivities()[0].lead_id).toBeUndefined();
  });

  it("only reuses lead links from the owning user's previous activities", async () => {
    db.activities = [
      {
        user_id: "user-a",
        type: ActivityType.INSTAGRAM_MESSAGE,
        title: "Instagram DM to sender-1",
        lead_id: "lead-of-a",
      },
    ];

    await POST(inbound("ig-b"));

    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-b");
    expect(inboundActivities()[0].lead_id).toBeUndefined();
  });

  it("drops the message when the recipient matches no user and several are integrated", async () => {
    const res = await POST(inbound("ig-unknown"));

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
  });

  it("falls back to the only integrated user when the recipient id does not match", async () => {
    db.user_secrets = [{ user_id: "user-a", instagram_ig_id: "app-scoped-id", instagram_page_id: "app-scoped-id" }];

    await POST(inbound("ig-professional-id"));

    expect(inboundActivities()).toHaveLength(1);
    expect(inboundActivities()[0].user_id).toBe("user-a");
  });

  it("drops the message when the recipient id matches more than one user", async () => {
    db.user_secrets = [
      { user_id: "user-a", instagram_ig_id: "shared-id", instagram_page_id: "page-a" },
      { user_id: "user-b", instagram_ig_id: "ig-b", instagram_page_id: "shared-id" },
    ];

    const res = await POST(inbound("shared-id"));

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
  });

  it("never uses a recipient id with filter syntax in the lookup", async () => {
    // A crafted id like "x,instagram_ig_id.eq.ig-a" would inject an extra
    // clause into the PostgREST or() filter and match another user's row.
    // It must be ignored, and with several integrated users the message is
    // dropped rather than guessed.
    const res = await POST(inbound("x,instagram_ig_id.eq.ig-a"));

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
  });

  it("returns 500 so Meta retries when the recipient lookup fails", async () => {
    failWhen = (table, usedOr) => table === "user_secrets" && usedOr;

    const res = await POST(inbound("ig-b"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Temporary failure" });
    expect(inboundActivities()).toHaveLength(0);
  });

  it("returns 500 so Meta retries when the integrated-users lookup fails", async () => {
    failWhen = (table, usedOr) => table === "user_secrets" && !usedOr;

    const res = await POST(inbound("ig-unknown"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Temporary failure" });
    expect(inboundActivities()).toHaveLength(0);
  });

  it("creates no activity when no user has Instagram connected", async () => {
    db.user_secrets = [];

    const res = await POST(inbound("ig-a"));

    expect(res.status).toBe(200);
    expect(inboundActivities()).toHaveLength(0);
  });
});
