/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetForLead = jest.fn();
const mockGetForIdea = jest.fn();
const mockCreate = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      getById: jest.fn(),
      getForLead: mockGetForLead,
      getForIdea: mockGetForIdea,
      getPending: jest.fn(),
      create: mockCreate,
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    })),
  })
);

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { withAuth } from "@/lib/api/with-auth";

const mockWithAuth = withAuth as jest.Mock;

describe("GET /api/activities", () => {
  beforeEach(() => {
    mockGetForLead.mockClear();
    mockGetForIdea.mockClear();
    mockCreate.mockClear();
  });

  it("should return activities for a lead when leadId query param provided", async () => {
    mockGetForLead.mockResolvedValue([
      {
        id: "act-1",
        title: "Call John",
        type: ActivityType.CALL,
        completed: false,
        leadId: "lead-1",
        userId: "user-1",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/activities?leadId=lead-1")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Call John");
    expect(mockGetForLead).toHaveBeenCalledWith("lead-1");
  });

  it("should return activities for an idea when ideaId query param provided", async () => {
    mockGetForIdea.mockResolvedValue([
      {
        id: "act-2",
        title: "Research topic",
        type: ActivityType.INVESTIGATION,
        completed: false,
        ideaId: "idea-1",
        userId: "user-1",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/activities?ideaId=idea-1")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Research topic");
    expect(mockGetForIdea).toHaveBeenCalledWith("idea-1");
  });

  it("should return 400 when neither leadId nor ideaId is provided", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/api/activities")
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("should filter unlinked unread activities by read_at IS NULL (BR-3), not completed", async () => {
    // Chain mock: capture which filter verb the route applies.
    const calls: Array<{ verb: string; args: unknown[] }> = [];
    const chain: Record<string, jest.Mock> = {};
    const makeChain = (): any => {
      const target: Record<string, jest.Mock> = {};
      for (const verb of ["is", "eq", "or", "select"]) {
        target[verb] = jest.fn((...args: unknown[]) => {
          calls.push({ verb, args });
          return makeChain();
        });
      }
      return target;
    };
    const queryChain = makeChain();

    mockWithAuth.mockResolvedValue({
      supabase: {
        from: jest.fn(() => queryChain),
      },
      user: { id: "user-1", email: "test@example.com" },
    });

    // Resolve the chain promise-like: the route awaits `query` — make the
    // final chained object thenable to a successful payload.
    (queryChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "m1", readAt: null, type: "INSTAGRAM_MESSAGE" }], error: null });

    const request = new NextRequest(
      new URL(
        "http://localhost:3000/api/activities?type=INSTAGRAM_MESSAGE&unread=true&unlinkedId=ig-123"
      )
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Unread filter keys on the read marker, not the binary completed flag.
    expect(calls).toContainEqual({
      verb: "is",
      args: ["read_at", null],
    });
    expect(calls).not.toContainEqual({
      verb: "eq",
      args: ["completed", false],
    });
  });
});

describe("POST /api/activities", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("should create an activity and return 201", async () => {
    mockCreate.mockResolvedValue({
      id: "new-act",
      title: "Follow up call",
      type: ActivityType.CALL,
      completed: false,
      leadId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest("http://localhost:3000/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: "Follow up call",
        type: "CALL",
        leadId: "123e4567-e89b-12d3-a456-426614174000",
        description: "Follow up with the client",
      }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.title).toBe("Follow up call");
  });

  it("should return 400 when title is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/activities", {
      method: "POST",
      body: JSON.stringify({
        type: "CALL",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 when type is invalid", async () => {
    const request = new NextRequest("http://localhost:3000/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: "Test",
        type: "INVALID_TYPE",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
