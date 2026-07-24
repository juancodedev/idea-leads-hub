/**
 * @jest-environment node
 */

// ── Shared queue via globalThis (hoist-safe) ──────────────────────────
// jest.mock is hoisted above variable declarations. To share state between
// the mock factory and test code, we use globalThis which is always present.

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as any).__MSG_TEST_QUEUE__ = [];
});

jest.mock("@/lib/api/with-auth", () => {
  function buildChain(queueRef: Array<() => any>) {
    const mocks: Record<string, jest.Mock> = {};

    function consume() {
      const fn = queueRef.shift();
      return fn ? fn() : { data: null, error: null };
    }

    const chain = new Proxy(
      {},
      {
        get(_target: any, prop: string) {
          if (prop === "then") {
            return (resolve: (v: any) => void) => resolve(consume());
          }
          const builder = new Set(["from", "select", "delete", "update", "eq", "is", "ilike"]);
          if (builder.has(prop)) {
            if (!mocks[prop]) mocks[prop] = jest.fn().mockReturnValue(chain);
            return mocks[prop];
          }
          if (prop === "order" || prop === "maybeSingle" || prop === "single") {
            if (!mocks[prop])
              mocks[prop] = jest.fn().mockImplementation(() =>
                Promise.resolve(consume())
              );
            return mocks[prop];
          }
          if (!mocks[prop]) mocks[prop] = jest.fn().mockReturnValue(chain);
          return mocks[prop];
        },
      }
    );

    return chain;
  }

  // Get the queue from globalThis — set by beforeEach, populated by pushResult()
  function getQueue() {
    return ((globalThis as any).__MSG_TEST_QUEUE__ ?? []) as Array<() => any>;
  }

  const from = jest.fn().mockImplementation(() => buildChain(getQueue()));

  return {
    withAuth: jest.fn().mockResolvedValue({
      supabase: { from },
      user: { id: "user-1", email: "test@example.com" },
    }),
  };
});

jest.mock("@/modules/activities/domain/enums/ActivityType", () => ({
  ActivityType: { INSTAGRAM_MESSAGE: "INSTAGRAM_MESSAGE" },
}));

import { NextRequest } from "next/server";
import { GET, DELETE, PATCH } from "../route";

// ── Test helpers ───────────────────────────────────────────────────────

function pushResult(data: any) {
  const q = (globalThis as any).__MSG_TEST_QUEUE__;
  if (q) q.push(() => data);
}

// ── GET ────────────────────────────────────────────────────────────────

describe("GET /api/messages", () => {
  it("returns 400 when key param is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("key query param");
  });

  it("returns 400 for invalid key format", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages?key=invalid:123");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid key format");
  });

  it("returns messages for a linked (lead:) key", async () => {
    pushResult({
      data: [
        { id: "act-1", title: "Instagram DM from 12345", description: "Hola!", created_at: "2026-07-22T10:00:00Z" },
        { id: "act-2", title: "Instagram DM to 12345", description: "Cómo estás?", created_at: "2026-07-22T10:05:00Z" },
      ],
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/messages?key=lead:lead-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].direction).toBe("inbound");
    expect(body[1].direction).toBe("outbound");
  });

  it("returns messages for an unlinked key", async () => {
    pushResult({
      data: [
        { id: "act-3", title: "Instagram DM from 99999", description: "Interested", created_at: "2026-07-22T11:00:00Z" },
      ],
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/messages?key=unlinked:99999");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].direction).toBe("inbound");
  });

  it("returns empty array when no messages", async () => {
    pushResult({ data: [], error: null });
    const req = new NextRequest("http://localhost:3000/api/messages?key=lead:nonexistent");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    pushResult({ data: null, error: new Error("DB failed") });
    const req = new NextRequest("http://localhost:3000/api/messages?key=lead:lead-1");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────

describe("DELETE /api/messages", () => {
  it("returns 400 when key param is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid key", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages?key=bad:key", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("deletes linked conversation", async () => {
    pushResult({ error: null });
    const req = new NextRequest("http://localhost:3000/api/messages?key=lead:lead-1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("deletes unlinked conversation", async () => {
    pushResult({ error: null });
    const req = new NextRequest("http://localhost:3000/api/messages?key=unlinked:99999", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it("returns 500 on db error", async () => {
    pushResult({ error: new Error("Delete failed") });
    const req = new NextRequest("http://localhost:3000/api/messages?key=lead:lead-1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});

// ── PATCH ──────────────────────────────────────────────────────────────

describe("PATCH /api/messages (link to lead)", () => {
  it("returns 400 when missing params", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "unlinked:123" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid key", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "bad:123", leadId: "lead-1" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns alreadyLinked for lead: key", async () => {
    const req = new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "lead:lead-1", leadId: "lead-1" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyLinked).toBe(true);
  });

  it("returns 404 when lead not found", async () => {
    pushResult({ data: null, error: null });
    const req = new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "unlinked:99999", leadId: "nonexistent" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("links unlinked messages successfully", async () => {
    pushResult({ data: { id: "lead-1" }, error: null }); // lead check
    pushResult({ error: null }); // update

    const req = new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "unlinked:99999", leadId: "lead-1" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.alreadyLinked).toBe(false);
  });

  it("returns 500 on update error", async () => {
    pushResult({ data: { id: "lead-1" }, error: null }); // lead check
    pushResult({ error: new Error("Update failed") }); // update fails

    const req = new NextRequest("http://localhost:3000/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "unlinked:99999", leadId: "lead-1" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
  });
});
