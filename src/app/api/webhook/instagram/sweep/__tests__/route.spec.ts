/**
 * @jest-environment node
 *
 * GET /api/webhook/instagram/sweep (S4, ADR-5): `/api` is outside the
 * middleware matcher, so the Bearer CRON_SECRET check in the route is the
 * only guard.
 */

const mockCreateAdminClient = jest.fn(() => ({ admin: true }));
jest.mock("@/infrastructure/database/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockSweep = jest.fn();
const mockMessagingModule = jest.fn(() => ({
  sweepWebhookEvents: { execute: mockSweep },
}));
jest.mock("@/modules/messaging", () => ({
  messagingModule: (...args: unknown[]) => mockMessagingModule(...(args as [])),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";

const SECRET = "cron-secret-value";
const SUMMARY = { claimed: 2, processed: 1, ignored: 1, retrying: 0, failed: 0 };

function sweep(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.Authorization = authorization;
  return new NextRequest("http://localhost:3000/api/webhook/instagram/sweep", { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  mockSweep.mockResolvedValue(SUMMARY);
});

afterAll(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/webhook/instagram/sweep", () => {
  it("runs the sweep with the admin client and returns its summary", async () => {
    const response = await GET(sweep(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUMMARY);
    expect(mockMessagingModule).toHaveBeenCalledWith({ admin: true });
    expect(mockSweep).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no Authorization header", undefined],
    ["a wrong token", "Bearer wrong-secret"],
    ["a token that only shares a prefix", `Bearer ${SECRET}-extra`],
    ["the secret without the Bearer scheme", SECRET],
    ["an empty bearer token", "Bearer "],
  ])("answers 401 and processes nothing with %s", async (_label, authorization) => {
    const response = await GET(sweep(authorization));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it("answers 401 when CRON_SECRET is not configured, even for an empty bearer token", async () => {
    delete process.env.CRON_SECRET;

    for (const authorization of ["Bearer ", "Bearer undefined", undefined]) {
      const response = await GET(sweep(authorization));
      expect(response.status).toBe(401);
    }
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it("answers 500 when the sweep fails", async () => {
    mockSweep.mockRejectedValue(new Error("messaging_claim_retry: timeout"));

    const response = await GET(sweep(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Sweep failed" });
  });

  it("answers 500 when the admin client is not configured", async () => {
    mockCreateAdminClient.mockImplementationOnce(() => {
      throw new Error("Supabase admin client is not configured");
    });

    const response = await GET(sweep(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(mockSweep).not.toHaveBeenCalled();
  });
});
