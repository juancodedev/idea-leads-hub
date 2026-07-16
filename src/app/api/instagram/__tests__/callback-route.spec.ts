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
import { GET } from "../auth/callback/route";

const ORIGINAL_ENV = { ...process.env };
const APP_URL = "http://localhost:3000";

describe("GET /api/instagram/auth/callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.META_APP_ID = "test-app-id";
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should redirect to error when env vars are missing", async () => {
    delete process.env.META_APP_ID;

    const request = new NextRequest(
      new URL(
        `${APP_URL}/api/instagram/auth/callback?code=test-code&state=test-state`
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });

  it("should redirect to error when code param is missing", async () => {
    const request = new NextRequest(
      new URL(`${APP_URL}/api/instagram/auth/callback?state=test-state`)
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });

  it("should redirect to error when state param is missing", async () => {
    const request = new NextRequest(
      new URL(`${APP_URL}/api/instagram/auth/callback?code=test-code`)
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });

  it("should redirect to error when state does not match cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "different-state" });

    const request = new NextRequest(
      new URL(
        `${APP_URL}/api/instagram/auth/callback?code=test-code&state=wrong-state`
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });

  it("should redirect to error when token exchange fails", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const request = new NextRequest(
      new URL(
        `${APP_URL}/api/instagram/auth/callback?code=test-code&state=valid-state`
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });

  it("should redirect to error when no Instagram Business Account found", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-state" });

    // Simulate successful token exchanges but pages without IG business account
    jest.spyOn(global, "fetch").mockImplementation(
      (url: string | URL | Request) => {
        const urlStr = url.toString();

        // Token exchange responses
        if (urlStr.includes("oauth/access_token")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "test-token",
                expires_in: 5184000,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // Pages list — no Instagram Business Account
        if (urlStr.includes("/me/accounts")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [{ id: "page-no-ig", name: "No IG Page" }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // Page details — no instagram_business_account field
        if (urlStr.includes("fields=instagram_business_account")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ id: "page-no-ig" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 })
        );
      }
    );

    const request = new NextRequest(
      new URL(
        `${APP_URL}/api/instagram/auth/callback?code=test-code&state=valid-state`
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });

  it("should store token and redirect to success on full flow", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });

    // Simulate successful full OAuth flow
    jest.spyOn(global, "fetch").mockImplementation(
      (url: string | URL | Request) => {
        const urlStr = url.toString();

        // Short-lived token exchange
        if (urlStr.includes("oauth/access_token") && !urlStr.includes("grant_type")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ access_token: "short-lived-token" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // Long-lived token exchange
        if (urlStr.includes("grant_type=fb_exchange_token")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "long-lived-token",
                expires_in: 5184000,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // Pages list
        if (urlStr.includes("/me/accounts")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  { id: "page-1", name: "Test Page" },
                  { id: "page-2", name: "Other Page" },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // Page details — page-1 has Instagram Business Account
        if (urlStr.includes("fields=instagram_business_account")) {
          const isPage1 = urlStr.includes("page-1");
          return Promise.resolve(
            new Response(
              JSON.stringify(
                isPage1
                  ? { id: "page-1", instagram_business_account: { id: "ig-account-1" } }
                  : { id: "page-2" }
              ),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 })
        );
      }
    );

    const request = new NextRequest(
      new URL(
        `${APP_URL}/api/instagram/auth/callback?code=test-code&state=valid-state`
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=connected");

    // Verify state cookie was deleted
    expect(mockCookieDelete).toHaveBeenCalledWith("instagram_oauth_state");
  });

  it("should redirect to error when user authentication fails in callback", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    // Successful API calls to Meta
    jest.spyOn(global, "fetch").mockImplementation(
      (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("oauth/access_token")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ access_token: "test-token", expires_in: 5184000 }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
        if (urlStr.includes("/me/accounts")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [{ id: "page-1", name: "Test Page" }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
        if (urlStr.includes("instagram_business_account")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "page-1",
                instagram_business_account: { id: "ig-account-1" },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }
    );

    const request = new NextRequest(
      new URL(
        `${APP_URL}/api/instagram/auth/callback?code=test-code&state=valid-state`
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("instagram=error");
  });
});
