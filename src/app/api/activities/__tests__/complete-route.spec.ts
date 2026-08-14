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
const mockMoveStatus = jest.fn();

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
      moveStatus: mockMoveStatus,
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    })),
  })
);

jest.mock("@/modules/shared/infrastructure/actions/auditActions", () => ({
  createAuditLog: jest.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH } from "../[id]/complete/route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";
import { createAuditLog } from "@/modules/shared/infrastructure/actions/auditActions";

const mockCreateAuditLog = createAuditLog as jest.Mock;

const mockActivity = {
  id: "act-1",
  title: "Task to complete",
  type: ActivityType.TASK,
  status: ActivityStatus.PENDING,
  completed: false,
  leadId: "lead-1",
  userId: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockCompletedActivity = {
  ...mockActivity,
  status: ActivityStatus.COMPLETED,
  completed: true,
  completedAt: new Date("2024-06-01"),
};

describe("PATCH /api/activities/[id]/complete", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockMoveStatus.mockClear();
    mockCreateAuditLog.mockClear();
  });

  it("should mark activity as complete and return 200", async () => {
    mockGetById.mockResolvedValue(mockActivity);
    mockMoveStatus.mockResolvedValue(mockCompletedActivity);
    mockCreateAuditLog.mockResolvedValue({ success: true });

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/complete",
      { method: "PATCH" }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.completed).toBe(true);
    expect(body.status).toBe(ActivityStatus.COMPLETED);
    // Delegate to the migrated CompleteActivity → moveStatus(COMPLETED).
    expect(mockMoveStatus).toHaveBeenCalledWith("act-1", ActivityStatus.COMPLETED);
    // CF-2: complete now audits the status delta exactly once (getById-first).
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      entityType: "ACTIVITY",
      entityId: "act-1",
      parentId: "lead-1",
      action: "UPDATE",
      changes: {
        status: { old: ActivityStatus.PENDING, new: ActivityStatus.COMPLETED },
      },
    });
  });

  it("should return 404 when activity not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/non-existent/complete",
      { method: "PATCH" }
    );
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});
