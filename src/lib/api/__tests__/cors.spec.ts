/**
 * @jest-environment node
 */

// ALLOWED_ORIGINS is computed at module load, so the env must be set before
// the module is required (static imports are hoisted above this assignment).
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

const { getCorsHeaders, handlePreflight, resolveOrigin, withCors } =
  require("../cors") as typeof import("../cors");

describe("resolveOrigin", () => {
  it("echoes an allowed origin", () => {
    expect(resolveOrigin("https://app.example.com")).toBe("https://app.example.com");
    expect(resolveOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects the opaque 'null' origin (sandboxed iframes, data: URLs)", () => {
    expect(resolveOrigin("null")).toBeNull();
  });

  it("rejects a missing origin", () => {
    expect(resolveOrigin(null)).toBeNull();
  });

  it("rejects an unknown origin", () => {
    expect(resolveOrigin("https://evil.example")).toBeNull();
  });
});

describe("getCorsHeaders", () => {
  it("omits Access-Control-Allow-Origin and credentials for a rejected origin", () => {
    const headers = getCorsHeaders("null");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    expect(headers["Vary"]).toBe("Origin");
  });

  it("allows credentials for an allowed origin", () => {
    const headers = getCorsHeaders("https://app.example.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });
});

describe("handlePreflight", () => {
  it("returns 204 without allow-origin for Origin: null", () => {
    const request = new Request("https://app.example.com/api/leads", {
      method: "OPTIONS",
      headers: { origin: "null" },
    });
    const response = handlePreflight(request);
    expect(response?.status).toBe(204);
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns null for non-OPTIONS requests", () => {
    const request = new Request("https://app.example.com/api/leads", { method: "GET" });
    expect(handlePreflight(request)).toBeNull();
  });
});

describe("withCors", () => {
  it("does not set allow-origin for a rejected origin and keeps status/body", async () => {
    const response = withCors(new Response("ok", { status: 201 }), "null");
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("sets allow-origin for an allowed origin", () => {
    const response = withCors(new Response("ok"), "https://app.example.com");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });
});
