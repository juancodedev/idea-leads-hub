import { DeleteActivity } from "../DeleteActivity";
import { ActivityRepository } from "@/modules/activities/domain/repositories/ActivityRepository";
import { Activity } from "@/modules/activities/domain/entities/Activity";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

describe("DeleteActivity Use Case", () => {
  let deleteActivity: DeleteActivity;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const existingActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Activity to delete",
    type: ActivityType.TASK,
    completed: false,
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
    };
    deleteActivity = new DeleteActivity(mockRepository);
  });

  it("should delete an activity successfully", async () => {
    mockRepository.getById.mockResolvedValue(existingActivity);
    mockRepository.delete.mockResolvedValue(undefined);

    await deleteActivity.execute("activity-1");

    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    expect(mockRepository.delete).toHaveBeenCalledWith("activity-1");
  });

  it("should throw an error if activity does not exist", async () => {
    mockRepository.getById.mockResolvedValue(null);

    await expect(deleteActivity.execute("non-existent")).rejects.toThrow(
      "Actividad no encontrada"
    );

    expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it("should delete a different activity by id", async () => {
    const anotherActivity: Activity = {
      ...existingActivity,
      id: "activity-2",
    };
    mockRepository.getById.mockResolvedValue(anotherActivity);
    mockRepository.delete.mockResolvedValue(undefined);

    await deleteActivity.execute("activity-2");

    expect(mockRepository.delete).toHaveBeenCalledWith("activity-2");
  });
});
