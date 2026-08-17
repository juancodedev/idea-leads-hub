/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetById = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      getById: mockGetById,
      getForLead: jest.fn(),
      getForIdea: jest.fn(),
      getPending: jest.fn(),
      create: jest.fn(),
      update: mockUpdate,
      delete: mockDelete,
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    })),
  })
);

import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../[id]/route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

describe("GET /api/activities/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
  });

  it("should return activity by id", async () => {
    mockGetById.mockResolvedValue({
      id: "act-1",
      title: "Call",
      type: ActivityType.CALL,
      completed: false,
      userId: "user-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    const request = new NextRequest("http://localhost:3000/api/activities/act-1");
    const response = await GET(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("act-1");
    expect(mockGetById).toHaveBeenCalledWith("act-1");
  });

  it("should return 404 when activity not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/activities/non-existent");
    const response = await GET(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/activities/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdate.mockClear();
  });

  it("should update an activity and return 200", async () => {
    mockGetById.mockResolvedValue({
      id: "act-1",
      title: "Original",
      type: ActivityType.TASK,
      completed: false,
      userId: "user-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });
    mockUpdate.mockResolvedValue({
      id: "act-1",
      title: "Updated title",
      type: ActivityType.TASK,
      completed: false,
      userId: "user-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    const request = new NextRequest("http://localhost:3000/api/activities/act-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated title" }),
    });
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe("Updated title");
    expect(mockUpdate).toHaveBeenCalledWith({ id: "act-1", title: "Updated title" });
  });

  it("should return 404 when activity not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/activities/non-existent", {
      method: "PATCH",
      body: JSON.stringify({ title: "Nope" }),
    });
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });

  it("should silently strip completed from the update payload (contract: field ignored)", async () => {
    // api-rest spec: PATCH /api/activities/[id] has NO completed field during
    // rollout — status transitions go through the status surface. The Zod
    // schema strips unknown keys (no .strict()), so `completed` in the body
    // is silently ignored: neither status nor completed is mutated, while the
    // other fields still update.
    mockGetById.mockResolvedValue({
      id: "act-1",
      title: "Original",
      type: ActivityType.TASK,
      completed: false,
      userId: "user-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });
    mockUpdate.mockResolvedValue({
      id: "act-1",
      title: "Updated title",
      type: ActivityType.TASK,
      completed: false,
      userId: "user-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    const request = new NextRequest("http://localhost:3000/api/activities/act-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated title", completed: true }),
    });
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe("Updated title");
    // `completed` never reaches the repository — not even as a pass-through.
    expect(mockUpdate).toHaveBeenCalledWith({ id: "act-1", title: "Updated title" });
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("completed");
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status");
  });
});

describe("DELETE /api/activities/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockDelete.mockClear();
  });

  it("should delete an activity and return 204", async () => {
    mockGetById.mockResolvedValue({
      id: "act-1",
      title: "To delete",
      type: ActivityType.TASK,
      completed: false,
      userId: "user-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });
    mockDelete.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/activities/act-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "act-1" } });

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith("act-1");
  });

  it("should return 404 when activity not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/activities/non-existent", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});
