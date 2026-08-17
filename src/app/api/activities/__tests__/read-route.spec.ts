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
const mockMarkRead = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      getById: mockGetById,
      getForLead: jest.fn(),
      getForIdea: jest.fn(),
      getPending: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: mockMarkRead,
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    })),
  })
);

import { NextRequest } from "next/server";
import { PATCH } from "../[id]/read/route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

const mockUnreadActivity = {
  id: "act-1",
  title: "Instagram message",
  type: ActivityType.INSTAGRAM_MESSAGE,
  status: ActivityStatus.PENDING,
  completed: false,
  readAt: null,
  leadId: "lead-1",
  userId: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockReadActivity = {
  ...mockUnreadActivity,
  readAt: new Date("2024-06-01"),
};

// A non-Instagram row (e.g. a TASK): the read route's getById succeeds, but
// markRead's DB-level .eq('type', INSTAGRAM_MESSAGE) guard matches zero rows
// → PGRST116 → NotFoundError → 404.
const mockTaskActivity = {
  ...mockReadActivity,
  title: "Call John",
  type: ActivityType.TASK,
};

describe("PATCH /api/activities/[id]/read", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockMarkRead.mockClear();
  });

  it("should mark activity as read via markRead (status/completed untouched — BR-3)", async () => {
    mockGetById.mockResolvedValue(mockUnreadActivity);
    mockMarkRead.mockResolvedValue(mockReadActivity);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/read",
      { method: "PATCH" }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.readAt).toBeTruthy();
    // Read never implies completion (BR-3): status and completed untouched.
    expect(body.status).toBe(ActivityStatus.PENDING);
    expect(body.completed).toBe(false);
    // Delegate to MarkActivityRead → repo.markRead.
    expect(mockMarkRead).toHaveBeenCalledWith("act-1");
  });

  it("should be idempotent when re-reading an already-read activity (read_at re-stamped, status/completed untouched)", async () => {
    // SECOND read of the same INSTAGRAM_MESSAGE row: getById returns the
    // already-read row; markRead re-stamps read_at and leaves status and
    // completed untouched. Always 200 — never a conflict or error.
    const reReadActivity = {
      ...mockReadActivity,
      readAt: new Date("2024-06-02"),
    };
    mockGetById.mockResolvedValue(mockReadActivity);
    mockMarkRead.mockResolvedValue(reReadActivity);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/read",
      { method: "PATCH" }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(new Date(body.readAt)).toEqual(new Date("2024-06-02"));
    expect(body.status).toBe(ActivityStatus.PENDING);
    expect(body.completed).toBe(false);
    expect(mockMarkRead).toHaveBeenCalledWith("act-1");
  });

  it("should return 404 when activity not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/non-existent/read",
      { method: "PATCH" }
    );
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it("should return 404 when the activity is not an Instagram message (markRead guard matches zero rows)", async () => {
    // getById succeeds (the row exists and belongs to the user), but the
    // read marker only applies to INSTAGRAM_MESSAGE rows (BR-3): markRead's
    // .eq('type', INSTAGRAM_MESSAGE) matches zero rows → PGRST116, mapped by
    // the repository's handleError to the real NotFoundError → 404.
    mockGetById.mockResolvedValue(mockTaskActivity);
    mockMarkRead.mockRejectedValue(new NotFoundError("Actividad no encontrada"));

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/read",
      { method: "PATCH" }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });

    expect(response.status).toBe(404);
    expect(mockGetById).toHaveBeenCalledWith("act-1");
    expect(mockMarkRead).toHaveBeenCalledWith("act-1");
  });
});