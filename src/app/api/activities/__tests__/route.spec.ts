/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn(),
}));

const mockGetForLead = jest.fn();
const mockGetForIdea = jest.fn();
const mockCreate = jest.fn();
const mockUpsert = jest.fn();
const mockRepository = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: function MockActivityRepository(
      supabase: unknown,
      scopedUserId?: string
    ) {
      mockRepository(supabase, scopedUserId);
      return {
        getById: jest.fn(),
        getForLead: mockGetForLead,
        getForIdea: mockGetForIdea,
        getPending: jest.fn(),
        create: mockCreate,
        upsertByExternalId: mockUpsert,
        update: jest.fn(),
        delete: jest.fn(),
        complete: jest.fn(),
        moveStatus: jest.fn(),
        markRead: jest.fn(),
        markUnread: jest.fn(),
        getUnreadCount: jest.fn(),
      };
    },
  })
);

jest.mock("@/modules/activities/application/use-cases/CreateActivity", () => ({
  CreateActivity: jest.fn().mockImplementation(() => ({ execute: mockCreate })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { withAuth } from "@/lib/api/with-auth";

const mockWithAuth = withAuth as jest.Mock;

const storedActivity = {
  id: "activity-1",
  leadId: "lead-1",
  userId: "user-1",
  type: "EMAIL",
  title: "Correo 1",
  status: "COMPLETED",
  completed: true,
  externalId: "cafe-lindo.cl#correo-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const validBody = {
  title: "Correo 1",
  type: "EMAIL",
  leadId: "11111111-1111-4111-8111-111111111111",
  status: "COMPLETED",
  completedAt: "2026-11-12T15:04:00.000Z",
};

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/activities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetForLead.mockClear();
  mockGetForIdea.mockClear();
  mockCreate.mockClear();
  mockUpsert.mockReset();
  mockRepository.mockReset();
  mockWithAuth.mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
    authType: "session",
  });
});

describe("GET /api/activities", () => {
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
      authType: "session",
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

  it("opts in to API keys and scopes the repository to the key owner", async () => {
    mockWithAuth.mockResolvedValue({
      supabase: {},
      user: { id: "user-1", email: null },
      authType: "api_key",
      scopedUserId: "user-1",
    });
    mockCreate.mockResolvedValue(storedActivity);

    await POST(post(validBody));

    expect(withAuth).toHaveBeenCalledWith(expect.anything(), { allowApiKey: true });
    expect(mockRepository).toHaveBeenCalledWith({}, "user-1");
  });

  it("logs a sent email as a completed activity with its date", async () => {
    mockCreate.mockResolvedValue(storedActivity);

    const response = await POST(post(validBody));

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EMAIL",
        status: "COMPLETED",
        completedAt: new Date("2026-11-12T15:04:00.000Z"),
      })
    );
  });

  it("upserts by externalId and returns 201 the first time", async () => {
    mockUpsert.mockResolvedValue({ activity: storedActivity, created: true });

    const response = await POST(
      post({ ...validBody, externalId: "cafe-lindo.cl#correo-1" })
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: "cafe-lindo.cl#correo-1" })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 200 when the same externalId is sent again, instead of duplicating", async () => {
    mockUpsert.mockResolvedValue({ activity: storedActivity, created: false });

    const response = await POST(
      post({ ...validBody, externalId: "cafe-lindo.cl#correo-1" })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe("activity-1");
  });

  it("answers 400 with field-keyed messages", async () => {
    const response = await POST(post({ ...validBody, completedAt: "not-a-date" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.completedAt).toBeDefined();
  });
});
