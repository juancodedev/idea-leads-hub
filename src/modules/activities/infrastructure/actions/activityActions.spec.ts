/**
 * Spec for the activities infrastructure actions (task 4.4).
 *
 * Asserted contract:
 * - changeActivityStatus is getById-first: it loads the current row to build
 *   the audit delta, delegates the transition to MoveActivityStatus
 *   (moveStatus), then writes changes.status.{old,new} exactly once.
 * - Unknown ids return { error } without an audit row (mirrors the 404 API
 *   contract of the same use case).
 * - createActivityAction passes `status` through to the repository create;
 *   the legacy completed:true → COMPLETED normalization lives at the repo
 *   boundary (BR-4).
 */

jest.mock("@/infrastructure/database/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/modules/shared/infrastructure/actions/auditActions", () => ({
  createAuditLog: jest.fn(),
}));

const mockGetById = jest.fn();
const mockCreate = jest.fn();
const mockMoveStatus = jest.fn();
const mockUseCaseExecute = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      getById: mockGetById,
      getForLead: jest.fn(),
      getForIdea: jest.fn(),
      getPending: jest.fn(),
      create: mockCreate,
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

jest.mock(
  "@/modules/activities/application/use-cases/MoveActivityStatus",
  () => ({
    MoveActivityStatus: jest.fn().mockImplementation(() => ({
      execute: mockUseCaseExecute,
    })),
  })
);

import { changeActivityStatus, createActivityAction } from "./activityActions";
import { createClient } from "@/infrastructure/database/server";
import { createAuditLog } from "@/modules/shared/infrastructure/actions/auditActions";
import { revalidatePath } from "next/cache";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { ActivityType } from "../../domain/enums/ActivityType";

const fakeSupabase = { auth: { getUser: jest.fn() } };

const pendingActivity = {
  id: "act-1",
  title: "Call John",
  type: ActivityType.CALL,
  status: ActivityStatus.PENDING,
  completed: false,
  leadId: "lead-1",
  userId: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const inProgressActivity = {
  ...pendingActivity,
  status: ActivityStatus.IN_PROGRESS,
};

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue(fakeSupabase);
});

describe("changeActivityStatus", () => {
  it("should load the current row first, delegate to MoveActivityStatus, and audit changes.status.{old,new}", async () => {
    mockGetById.mockResolvedValue(pendingActivity);
    mockUseCaseExecute.mockResolvedValue(inProgressActivity);

    const result = await changeActivityStatus("act-1", ActivityStatus.IN_PROGRESS);

    expect(mockGetById).toHaveBeenCalledWith("act-1");
    expect(mockUseCaseExecute).toHaveBeenCalledWith(
      "act-1",
      ActivityStatus.IN_PROGRESS
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "ACTIVITY",
        entityId: "act-1",
        parentId: "lead-1",
        action: "UPDATE",
        changes: {
          status: {
            old: ActivityStatus.PENDING,
            new: ActivityStatus.IN_PROGRESS,
          },
        },
      })
    );
    expect(revalidatePath).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("should not audit and return an error when the activity does not exist", async () => {
    mockGetById.mockResolvedValue(null);

    const result = await changeActivityStatus("missing", ActivityStatus.COMPLETED);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(mockUseCaseExecute).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});

describe("createActivityAction", () => {
  it("should pass `status` through to the repository create", async () => {
    mockCreate.mockResolvedValue(inProgressActivity);

    const result = await createActivityAction({
      title: "Call John",
      type: ActivityType.CALL,
      status: ActivityStatus.IN_PROGRESS,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: ActivityStatus.IN_PROGRESS })
    );
    expect(result.success).toBe(true);
  });
});
