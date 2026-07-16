/**
 * @jest-environment node
 */

const mockMaybeSingle = jest.fn();

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn(() =>
    Promise.resolve({
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
        })),
      },
      user: { id: "user-1" },
    })
  ),
}));

import { NextRequest } from "next/server";
import { GET } from "../status/route";

describe("GET /api/instagram/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return connected=false when token is null", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        instagram_token: null,
        instagram_ig_id: null,
        token_expires_at: null,
      },
      error: null,
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/status")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connected).toBe(false);
  });

  it("should return connected=true with details when token exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        instagram_token: "valid-token",
        instagram_ig_id: "ig-123",
        token_expires_at: "2026-09-15T00:00:00.000Z",
      },
      error: null,
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/status")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.igId).toBe("ig-123");
    expect(body.expiresAt).toBe("2026-09-15T00:00:00.000Z");
  });

  it("should return connected=false when no row exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/status")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connected).toBe(false);
  });

  it("should return 500 on database error", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error("DB error"),
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/status")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
