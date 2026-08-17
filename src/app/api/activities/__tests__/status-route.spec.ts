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
import { PATCH } from "../[id]/status/route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";
import { createAuditLog } from "@/modules/shared/infrastructure/actions/auditActions";

const mockCreateAuditLog = createAuditLog as jest.Mock;

const mockActivity = {
  id: "act-1",
  title: "Task",
  type: ActivityType.TASK,
  status: ActivityStatus.PENDING,
  completed: false,
  leadId: "lead-1",
  userId: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockUpdatedActivity = {
  ...mockActivity,
  status: ActivityStatus.IN_PROGRESS,
  completed: false,
};

describe("PATCH /api/activities/[id]/status", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockMoveStatus.mockClear();
    mockCreateAuditLog.mockClear();
  });

  it("should move status and audit changes.status.{old,new} (getById-first)", async () => {
    mockGetById.mockResolvedValue(mockActivity);
    mockMoveStatus.mockResolvedValue(mockUpdatedActivity);
    mockCreateAuditLog.mockResolvedValue({ success: true });

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: { "content-type": "application/json" },
      }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(ActivityStatus.IN_PROGRESS);
    // Delegate to the use case via moveStatus.
    expect(mockMoveStatus).toHaveBeenCalledWith("act-1", ActivityStatus.IN_PROGRESS);
    // getById-first audit delta: single call, correct old/new and parent.
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      entityType: "ACTIVITY",
      entityId: "act-1",
      parentId: "lead-1",
      action: "UPDATE",
      changes: {
        status: { old: ActivityStatus.PENDING, new: ActivityStatus.IN_PROGRESS },
      },
    });
  });

  it("should not write or audit when the target status equals the current status (idempotent no-op)", async () => {
    // COMPLETED→COMPLETED (or any old===new) must not re-write nor create an
    // audit row: the use case no-ops, and the route skips the delta log.
    const completedActivity = { ...mockActivity, status: ActivityStatus.COMPLETED, completed: true };
    mockGetById.mockResolvedValue(completedActivity);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
        headers: { "content-type": "application/json" },
      }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(ActivityStatus.COMPLETED);
    expect(mockMoveStatus).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("should return 400 when status is outside the enum", async () => {
    mockGetById.mockResolvedValue(mockActivity);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
        headers: { "content-type": "application/json" },
      }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });

    expect(response.status).toBe(400);
    expect(mockMoveStatus).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("should return 404 when activity not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/non-existent/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
        headers: { "content-type": "application/json" },
      }
    );
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
    expect(mockMoveStatus).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("should not audit when moveStatus fails", async () => {
    mockGetById.mockResolvedValue(mockActivity);
    mockMoveStatus.mockRejectedValue(new Error("db down"));

    const request = new NextRequest(
      "http://localhost:3000/api/activities/act-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: { "content-type": "application/json" },
      }
    );
    const response = await PATCH(request, { params: { id: "act-1" } });

    expect(response.status).toBe(500);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});