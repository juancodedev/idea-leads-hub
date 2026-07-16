/**
 * @jest-environment node
 */

const mockCookieGet = jest.fn();
const mockCookieSet = jest.fn();
const mockCookieDelete = jest.fn();

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: mockCookieGet,
      set: mockCookieSet,
      delete: mockCookieDelete,
    })
  ),
}));

const mockEq = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn(() =>
    Promise.resolve({
      supabase: {
        from: jest.fn(() => ({
          update: jest.fn(() => ({
            eq: mockEq,
          })),
        })),
      },
      user: { id: "user-1" },
    })
  ),
}));

import { NextRequest } from "next/server";
import { GET, DELETE } from "../auth/route";

const ORIGINAL_ENV = { ...process.env };

describe("GET /api/instagram/auth (initiation)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.META_APP_ID = "test-app-id";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should return 400 when META_APP_ID is not configured", async () => {
    delete process.env.META_APP_ID;

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/auth")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("META_APP_ID");
  });

  it("should return 400 when NEXT_PUBLIC_APP_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/auth")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("should set state cookie and redirect to Facebook OAuth", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/auth")
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("https://www.facebook.com/v21.0/dialog/oauth");
    expect(location).toContain("client_id=test-app-id");
    expect(location).toContain(
      "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Finstagram%2Fauth%2Fcallback"
    );
    expect(location).toContain("response_type=code");
    expect(location).toContain("scope=pages_show_list");

    // Verify state cookie was set
    expect(mockCookieSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = mockCookieSet.mock.calls[0];
    expect(name).toBe("instagram_oauth_state");
    expect(value).toBeTruthy();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.maxAge).toBe(300);
    expect(options.path).toBe("/api/instagram/auth/callback");

    // Verify state is in the redirect URL
    expect(location).toContain(`state=${value}`);
  });
});

describe("DELETE /api/instagram/auth (disconnect)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should clear Instagram fields and return success", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/auth"),
      { method: "DELETE" }
    );
    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("should return 500 when database update fails", async () => {
    mockEq.mockResolvedValue({ error: new Error("DB error") });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/instagram/auth"),
      { method: "DELETE" }
    );
    const response = await DELETE(request);

    expect(response.status).toBe(500);
  });
});
