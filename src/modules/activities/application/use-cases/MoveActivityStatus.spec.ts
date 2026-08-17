import { MoveActivityStatus } from "./MoveActivityStatus";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { Activity } from "../../domain/entities/Activity";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

describe("MoveActivityStatus Use Case (P3.2)", () => {
  let moveActivityStatus: MoveActivityStatus;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const existingActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Test activity",
    type: ActivityType.TASK,
    completed: false,
    status: ActivityStatus.PENDING,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const completedActivity: Activity = {
    ...existingActivity,
    completed: true,
    status: ActivityStatus.COMPLETED,
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
    moveActivityStatus = new MoveActivityStatus(mockRepository);
  });

  it("should move an activity to COMPLETED (free transition)", async () => {
    mockRepository.getById.mockResolvedValue(existingActivity);
    mockRepository.moveStatus.mockResolvedValue(completedActivity);

    const result = await moveActivityStatus.execute("activity-1", ActivityStatus.COMPLETED);

    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    expect(mockRepository.moveStatus).toHaveBeenCalledWith("activity-1", ActivityStatus.COMPLETED);
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completed).toBe(true);
  });

  it("should reopen a completed activity to PENDING (free transition)", async () => {
    mockRepository.getById.mockResolvedValue(completedActivity);
    mockRepository.moveStatus.mockResolvedValue(existingActivity);

    const result = await moveActivityStatus.execute("activity-1", ActivityStatus.PENDING);

    expect(mockRepository.moveStatus).toHaveBeenCalledWith("activity-1", ActivityStatus.PENDING);
    expect(result.status).toBe(ActivityStatus.PENDING);
    expect(result.completed).toBe(false);
  });

  it("should throw NotFoundError when the activity does not exist", async () => {
    mockRepository.getById.mockResolvedValue(null);

    await expect(
      moveActivityStatus.execute("non-existent", ActivityStatus.IN_PROGRESS)
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(mockRepository.moveStatus).not.toHaveBeenCalled();
  });
});