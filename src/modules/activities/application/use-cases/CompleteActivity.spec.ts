import { CompleteActivity } from "./CompleteActivity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { Activity } from "../../domain/entities/Activity";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

describe("CompleteActivity Use Case (P3.2)", () => {
  let completeActivity: CompleteActivity;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const pendingActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Task to complete",
    type: ActivityType.TASK,
    completed: false,
    status: ActivityStatus.PENDING,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const completedActivity: Activity = {
    ...pendingActivity,
    completed: true,
    status: ActivityStatus.COMPLETED,
    completedAt: new Date("2024-06-01"),
  };

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      getById: jest.fn(),
      getForLead: jest.fn(),
      getForIdea: jest.fn(),
      getPending: jest.fn(),
      search: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    };
    completeActivity = new CompleteActivity(mockRepository);
  });

  it("should complete via moveStatus(COMPLETED) — dual-write invariant (BR-4)", async () => {
    mockRepository.getById.mockResolvedValue(pendingActivity);
    mockRepository.moveStatus.mockResolvedValue(completedActivity);

    const result = await completeActivity.execute("activity-1");

    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    // complete() is re-pointed to the status surface (design):
    // it no longer goes through the legacy binary verb.
    expect(mockRepository.moveStatus).toHaveBeenCalledWith("activity-1", ActivityStatus.COMPLETED);
    expect(mockRepository.complete).not.toHaveBeenCalled();
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completed).toBe(true);
  });

  it("should throw NotFoundError (404) when activity not found — same as MoveActivityStatus", async () => {
    mockRepository.getById.mockResolvedValue(null);

    const promise = completeActivity.execute("non-existent");
    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ statusCode: 404 });

    expect(mockRepository.moveStatus).not.toHaveBeenCalled();
  });

  it("should be an idempotent no-op when already COMPLETED (no write, no re-stamp)", async () => {
    mockRepository.getById.mockResolvedValue(completedActivity);

    const result = await completeActivity.execute("activity-1");

    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    // COMPLETED→COMPLETED must not re-write completed_at / audit old===new.
    expect(mockRepository.moveStatus).not.toHaveBeenCalled();
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completed).toBe(true);
  });
});