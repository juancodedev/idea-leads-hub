import { UpdateActivity } from "../UpdateActivity";
import { ActivityRepository } from "@/modules/activities/domain/repositories/ActivityRepository";
import { Activity } from "@/modules/activities/domain/entities/Activity";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

describe("UpdateActivity Use Case", () => {
  let updateActivity: UpdateActivity;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const existingActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Original title",
    type: ActivityType.TASK,
    completed: false,
    status: ActivityStatus.PENDING,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
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
    updateActivity = new UpdateActivity(mockRepository);
  });

  it("should update an activity successfully", async () => {
    mockRepository.getById.mockResolvedValue(existingActivity);
    const updated: Activity = {
      ...existingActivity,
      title: "Updated title",
      description: "New description",
    };
    mockRepository.update.mockResolvedValue(updated);

    const result = await updateActivity.execute("activity-1", {
      title: "Updated title",
      description: "New description",
    });

    expect(result).toEqual(updated);
    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    expect(mockRepository.update).toHaveBeenCalledWith({
      id: "activity-1",
      title: "Updated title",
      description: "New description",
    });
  });

  it("should throw an error if activity does not exist", async () => {
    mockRepository.getById.mockResolvedValue(null);

    await expect(
      updateActivity.execute("non-existent", { title: "Nope" })
    ).rejects.toThrow("Actividad no encontrada");

    expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it("should update with partial data", async () => {
    mockRepository.getById.mockResolvedValue(existingActivity);
    const updated: Activity = {
      ...existingActivity,
      title: "Just title changed",
    };
    mockRepository.update.mockResolvedValue(updated);

    const result = await updateActivity.execute("activity-1", {
      title: "Just title changed",
    });

    expect(result.title).toBe("Just title changed");
    expect(mockRepository.update).toHaveBeenCalledWith({
      id: "activity-1",
      title: "Just title changed",
    });
  });
});
