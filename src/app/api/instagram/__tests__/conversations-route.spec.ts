/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

import { NextRequest } from "next/server";
import { GET } from "../conversations/route";
import { withAuth } from "@/lib/api/with-auth";

const mockWithAuth = withAuth as jest.Mock;

/** Build a supabase query-chain mock. Every verb returns the SAME object
 *  (mimics supabase-js) and the object is thenable to the given payload. */
function makeQueryChain(payload: { data: unknown; error: unknown }) {
  const calls: Array<{ verb: string; args: unknown[] }> = [];
  const chain: Record<string, jest.Mock> = {};
  for (const verb of ["is", "eq", "or", "select", "order"]) {
    chain[verb] = jest.fn((...args: unknown[]) => {
      calls.push({ verb, args });
      return chain;
    });
  }
  (chain as any).then = (resolve: (v: unknown) => void) => resolve(payload);
  return { chain, calls };
}

function mockSupabaseFor(payload: { data: unknown; error: unknown }) {
  const { chain, calls } = makeQueryChain(payload);
  mockWithAuth.mockResolvedValue({
    supabase: { from: jest.fn(() => chain) },
    user: { id: "user-1", email: "test@example.com" },
  });
  return { chain, calls };
}

describe("GET /api/instagram/conversations", () => {
  beforeEach(() => {
    mockWithAuth.mockResolvedValue({
      supabase: {},
      user: { id: "user-1", email: "test@example.com" },
    });
  });

  it("should count unread by read_at IS NULL (BR-3), not by !completed", async () => {
    const { calls } = mockSupabaseFor({
      data: [
        {
          id: "m1",
          lead_id: null,
          title: "Instagram DM from 123456",
          description: "hi",
          created_at: "2024-01-01T00:00:00Z",
          read_at: null,
          lead: null,
        },
        {
          id: "m2",
          lead_id: null,
          title: "Instagram DM from 123456",
          description: "hello?",
          created_at: "2024-01-02T00:00:00Z",
          read_at: "2024-01-02T01:00:00Z",
          lead: null,
        },
      ],
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/instagram/conversations",
      { method: "GET" }
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversations).toHaveLength(1);
    // Only the read_at IS NULL message counts as unread.
    expect(body.conversations[0].unreadCount).toBe(1);
    // The query must select the read marker.
    expect(calls).toContainEqual({
      verb: "select",
      args: [expect.stringContaining("read_at")],
    });
  });

  it("should not treat completed messages as read when read_at is null", async () => {
    mockSupabaseFor({
      data: [
        {
          id: "m1",
          lead_id: null,
          title: "Instagram DM from 999",
          description: "read? no",
          created_at: "2024-01-01T00:00:00Z",
          read_at: null,
          completed: true, // legacy flag says completed, but read marker is null
          lead: null,
        },
      ],
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/instagram/conversations",
      { method: "GET" }
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // BR-3: completion never implies read — a COMPLETED-but-unread message stays unread.
    expect(body.conversations[0].unreadCount).toBe(1);
  });
});