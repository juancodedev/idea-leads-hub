/**
 * @jest-environment node
 */

const mockCookieGet = jest.fn();
const mockCookieDelete = jest.fn();
const mockGetUser = jest.fn();
const mockUpsert = jest.fn();

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: mockCookieGet,
      delete: mockCookieDelete,
    })
  ),
}));

jest.mock("@/infrastructure/database/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
      from: jest.fn(() => ({
        upsert: mockUpsert,
      })),
    })
  ),
}));

import { NextRequest } from "next/server";
import { POST } from "../ig-callback/route";

const ORIGINAL_ENV = { ...process.env };
const APP_URL = "http://localhost:3000";

describe("POST /api/instagram/ig-callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.INSTAGRAM_APP_ID = "ig-app-id";
    process.env.INSTAGRAM_APP_SECRET = "ig-app-secret";
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
    // All tests need withAuth to succeed — the route calls it before validation
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should return 400 when code is missing", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const request = new NextRequest(`${APP_URL}/api/instagram/ig-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Código");
  });

  it("should return 403 when state does not match cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "expected-state" });
    mockUpsert.mockResolvedValue({ error: null });

    const request = new NextRequest(`${APP_URL}/api/instagram/ig-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-code", state: "wrong-state" }),
    });

    const response = await POST(request);

    // Note: cookie is only deleted after successful state match, not on error
    expect(response.status).toBe(403);
  });

  it("should return 500 when env vars are missing", async () => {
    delete process.env.INSTAGRAM_APP_ID;

    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockUpsert.mockResolvedValue({ error: null });

    const request = new NextRequest(`${APP_URL}/api/instagram/ig-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-code", state: "valid-state" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it("should exchange code for short-lived, then long-lived, and store with auth_type", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });

    const shortLivedToken = "short-lived-token-123";
    const longLivedToken = "long-lived-token-456";

    // Mock the two fetch calls: code→short-lived, short→long-lived
    const mockFetch = jest.spyOn(global, "fetch");

    // First call: exchange code for short-lived token
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: shortLivedToken,
            user_id: 123456,
            permissions: ["instagram_business_basic", "instagram_business_manage_messages"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    // Second call: exchange short-lived for long-lived
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: longLivedToken,
            expires_in: 5184000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const request = new NextRequest(`${APP_URL}/api/instagram/ig-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-code", state: "valid-state" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify long-lived exchange was called with client_secret
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("graph.instagram.com/access_token")
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("grant_type=ig_exchange_token")
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("client_secret=ig-app-secret")
    );

    // Verify storeToken was called with long-lived token and auth_type
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        instagram_token: longLivedToken,
        instagram_user_token: longLivedToken,
        instagram_ig_id: "123456",
        instagram_page_id: "123456",
        auth_type: "instagram_business_login",
      }),
      { onConflict: "user_id" }
    );
  });

  it("should return 502 when long-lived exchange fails", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const mockFetch = jest.spyOn(global, "fetch");

    // First call succeeds (code→short-lived)
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "short-lived-token",
            user_id: 123456,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    // Second call fails (short→long-lived)
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response("Invalid grant", {
          status: 400,
          statusText: "Bad Request",
        })
      )
    );

    const request = new NextRequest(`${APP_URL}/api/instagram/ig-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-code", state: "valid-state" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
    // Store should NOT have been called since long-lived exchange failed
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
