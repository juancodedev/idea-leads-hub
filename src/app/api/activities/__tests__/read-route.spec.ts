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
});